const { AsyncLocalStorage } = require('async_hooks');
const mongoose = require('mongoose');

const tenantStorage = new AsyncLocalStorage();

function getTenantContext() {
  return tenantStorage.getStore() || null;
}

function withTenantContext(context, callback) {
  return tenantStorage.run(context, callback);
}

function tenantFilter(context) {
  const companyId = new mongoose.Types.ObjectId(context.companyId);
  if (!context.legacy) return { companyId };
  return {
    $or: [
      { companyId },
      { companyId: { $exists: false } },
      { companyId: null },
    ],
  };
}

function tenantCollections() {
  return new Set(mongoose.modelNames()
    .map(name => mongoose.model(name))
    .filter(model => model.schema.options.tenantScoped === true)
    .map(model => model.collection.collectionName));
}

function addTenantMatchToLookups(stages, context) {
  const match = tenantFilter(context);
  const scopedCollections = tenantCollections();
  for (const stage of stages) {
    if (stage.$facet) {
      Object.values(stage.$facet).forEach(facetStages => addTenantMatchToLookups(facetStages, context));
    }
    if (stage.$lookup) {
      if (scopedCollections.has(stage.$lookup.from)) {
        stage.$lookup.pipeline ||= [];
        stage.$lookup.pipeline.unshift({ $match: match });
      }
      if (stage.$lookup.pipeline) addTenantMatchToLookups(stage.$lookup.pipeline, context);
    }
    if (stage.$unionWith && typeof stage.$unionWith === 'object') {
      if (scopedCollections.has(stage.$unionWith.coll)) {
        stage.$unionWith.pipeline ||= [];
        stage.$unionWith.pipeline.unshift({ $match: match });
      }
      if (stage.$unionWith.pipeline) addTenantMatchToLookups(stage.$unionWith.pipeline, context);
    }
    if (scopedCollections.has(stage.$graphLookup?.from)) {
      const currentMatch = stage.$graphLookup.restrictSearchWithMatch;
      stage.$graphLookup.restrictSearchWithMatch = currentMatch
        ? { $and: [currentMatch, match] }
        : match;
    }
  }
}

function addTenantFilter(query, context) {
  const filter = tenantFilter(context);
  query.setQuery({ $and: [query.getQuery(), filter] });
}

function scopeUpdate(update, context, operation) {
  if (!update) return update;
  const companyId = new mongoose.Types.ObjectId(context.companyId);
  if (Array.isArray(update)) {
    return [...update, { $set: { companyId } }];
  }

  const usesOperators = Object.keys(update).some(key => key.startsWith('$'));
  delete update.companyId;
  delete update.tenantId;
  for (const operator of Object.keys(update)) {
    if (update[operator] && typeof update[operator] === 'object') {
      delete update[operator].companyId;
      delete update[operator].tenantId;
    }
  }
  if (operation === 'replaceOne' || !usesOperators) {
    update.companyId = companyId;
  } else {
    update.$set ||= {};
    update.$set.companyId = companyId;
    delete update.$unset?.companyId;
  }
  return update;
}

function tenantPlugin(schema) {
  if (schema.options.tenantScoped !== true) return;

  if (!schema.path('companyId')) {
    schema.add({
      companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true },
    });
  }

  schema.pre('save', function stampTenant(next) {
    const context = getTenantContext();
    if (context) this.companyId = context.companyId;
    next();
  });

  schema.pre('insertMany', function stampInsertedTenants(next, documents) {
    const context = getTenantContext();
    if (context) {
      documents.forEach(document => {
        document.companyId = context.companyId;
      });
    }
    next();
  });

  schema.pre(
    ['find', 'findOne', 'count', 'countDocuments', 'distinct', 'updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'findOneAndDelete', 'replaceOne', 'deleteOne', 'deleteMany'],
    function scopeTenantQuery() {
      const context = getTenantContext();
      if (!context) return;
      addTenantFilter(this, context);
      const update = this.getUpdate?.();
      if (update) this.setUpdate(scopeUpdate(update, context, this.op));
    },
  );

  schema.pre('aggregate', function scopeTenantAggregate() {
    const context = getTenantContext();
    if (context) {
      addTenantMatchToLookups(this.pipeline(), context);
      this.pipeline().unshift({ $match: tenantFilter(context) });
    }
  });
}

module.exports = { getTenantContext, tenantCollections, tenantFilter, tenantPlugin, withTenantContext };
