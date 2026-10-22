const Dealer = require('../models/Dealer');
const { scopeFilter, hierarchyFields } = require('../middleware/auth');

function validateCoordinates(latitude, longitude) {
  const hasLatitude = latitude !== undefined && latitude !== null && latitude !== '';
  const hasLongitude = longitude !== undefined && longitude !== null && longitude !== '';
  if (!hasLatitude && !hasLongitude) return { latitude: null, longitude: null };
  if (!hasLatitude || !hasLongitude) {
    throw new Error('Enter both latitude and longitude.');
  }

  if (
    (typeof latitude !== 'number' && typeof latitude !== 'string')
    || (typeof longitude !== 'number' && typeof longitude !== 'string')
    || (typeof latitude === 'string' && !latitude.trim())
    || (typeof longitude === 'string' && !longitude.trim())
  ) {
    throw new Error('Latitude and longitude must be valid numbers.');
  }
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  if (!Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90) {
    throw new Error('Latitude must be a number between -90 and 90.');
  }
  if (!Number.isFinite(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180) {
    throw new Error('Longitude must be a number between -180 and 180.');
  }
  return { latitude: parsedLatitude, longitude: parsedLongitude };
}

function validateGeofenceRadius(radius) {
  const parsedRadius = Number(radius);
  if (!Number.isFinite(parsedRadius) || parsedRadius < 1) {
    throw new Error('Geofence radius must be at least 1 metre.');
  }
  return parsedRadius;
}

// ── Core formula: Outstanding = openingBalance + sum(order remainingBalance) ──
async function calcOutstanding(dealerId) {
  const Order = require('../models/Order');
  const ACTIVE = ['pending', 'approved', 'hold', 'warehouse', 'out_for_delivery', 'delivered', 'completed'];
  const orders = await Order.find({ dealer: dealerId, status: { $in: ACTIVE } })
    .select('grandTotal collectedAmount');
  const dealer = await Dealer.findById(dealerId).select('openingBalance creditLimit creditNotes');
  if (!dealer) return { outstandingAmount: 0, availableCredit: 0 };

  const invoiceRemaining = orders.reduce((sum, o) => {
    return sum + Math.max(0, (o.grandTotal || 0) - (o.collectedAmount || 0));
  }, 0);

  const outstandingAmount = Number(dealer.openingBalance || 0) + invoiceRemaining - Number(dealer.creditNotes || 0);
  const availableCredit = Math.max(0, Number(dealer.creditLimit || 0) - outstandingAmount);
  return { outstandingAmount: Math.max(0, outstandingAmount), availableCredit };
}

// Recalculate and persist outstanding on dealer document
async function syncOutstanding(dealerId) {
  const { outstandingAmount, availableCredit } = await calcOutstanding(dealerId);
  await Dealer.findByIdAndUpdate(dealerId, { outstandingAmount });
  return { outstandingAmount, availableCredit };
}
exports.getAll = async (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const filter = { ...scopeFilter(req, 'dealer') };
    if (req.query.status)   filter.status   = req.query.status;
    if (req.query.province) filter.province = req.query.province;
    if (req.query.district) filter.district = req.query.district;
    if (req.query.area)     filter.area     = req.query.area;
    if (req.query.se)       filter.se       = req.query.se;
    if (req.query.so)       filter.so       = req.query.so;
    if (req.query.asm)      filter.asm      = req.query.asm;
    if (req.query.rsm)      filter.rsm      = req.query.rsm;
    if (req.query.nsm)      filter.nsm      = req.query.nsm;
    if (req.query.search)   filter.$or = [
      { dealerName: new RegExp(req.query.search, 'i') },
      { dealerCode: new RegExp(req.query.search, 'i') },
      { phone:      new RegExp(req.query.search, 'i') },
    ];

    const total = await Dealer.countDocuments(filter);
    const dealers = await Dealer.find(filter)
      .populate('se',  'name employeeId phone')
      .populate('so',  'name employeeId phone')
      .populate('asm', 'name employeeId phone')
      .populate('rsm', 'name employeeId phone')
      .populate('nsm', 'name employeeId phone')
      .sort('-createdAt').skip((page - 1) * limit).limit(limit);

    // Attach live outstanding to each dealer
    const data = await Promise.all(dealers.map(async (d) => {
      const obj = d.toObject();
      const { outstandingAmount, availableCredit } = await calcOutstanding(d._id);
      obj.outstandingAmount = outstandingAmount;
      obj.availableCredit   = availableCredit;
      return obj;
    }));

    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const scope = scopeFilter(req, 'dealer');
    const data = await Dealer.findOne({ _id: req.params.id, ...scope })
      .populate('se so asm rsm nsm', 'name employeeId phone');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });

    // Always return live outstanding from actual invoice remaining balances
    const { outstandingAmount, availableCredit } = await calcOutstanding(req.params.id);
    const result = data.toObject();
    result.outstandingAmount = outstandingAmount;
    result.availableCredit   = availableCredit;

    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.create = async (req, res) => {
  try {
    const User = require('../models/User');

    // Determine creator: SE or SO creating directly, or manager specifying an SE
    let creator = req.user;
    if (['admin', 'nsm', 'rsm', 'asm'].includes(req.user.role) && req.body.se) {
      creator = await User.findById(req.body.se);
    } else if (['admin', 'nsm', 'rsm', 'asm'].includes(req.user.role) && req.body.so?.length) {
      creator = await User.findById(req.body.so[0]);
    }
    const hierarchy = await hierarchyFields(creator);

    // Also stamp rsm/asm/nsm directly from creator's stamped fields
    const rsmStamp = {
      rsm: creator?.rsm || (creator?.role === 'rsm' ? creator._id : null),
      asm: creator?.asm || (creator?.role === 'asm' ? creator._id : null),
      nsm: creator?.nsm || (creator?.role === 'nsm' ? creator._id : null),
    };

    const creditLimit = Number(req.body.creditLimit ?? 0);
    const creditDays = Number(req.body.creditDays ?? 0);
    const openingOutstanding = Number(req.body.openingOutstanding ?? req.body.outstandingAmount ?? req.body.openingBalance ?? 0);
    const coordinates = validateCoordinates(req.body.latitude, req.body.longitude);
    const geofenceRadius = validateGeofenceRadius(req.body.geofenceRadius ?? 75);

    if (creditLimit < 0) throw new Error('Credit Limit cannot be negative.');
    if (creditDays < 0) throw new Error('Credit Days cannot be negative.');
    if (openingOutstanding < 0) throw new Error('Opening Outstanding cannot be negative.');
    if (openingOutstanding > creditLimit) throw new Error('Opening Outstanding cannot exceed Credit Limit.');

    const normalized = {
      ...req.body,
      dealerName: req.body.dealerName?.trim(),
      ownerName: req.body.ownerName?.trim(),
      distributor: req.body.distributor?.trim(),
      phone: req.body.phone?.trim(),
      panNumber: req.body.panNumber?.trim(),
      nidNumber: req.body.nidNumber?.trim(),
      province: req.body.province?.trim(),
      district: req.body.district?.trim(),
      address: req.body.address?.trim(),
      ...coordinates,
      geofenceRadius,
      locationVerificationStatus: 'pending_approval',
      locationReviewedBy: null,
      locationReviewedAt: null,
      locationRejectionReason: '',
      locationAudit: coordinates.latitude === null && geofenceRadius === 75 ? [] : [{
        action: 'submitted',
        changedBy: req.user._id,
        status: 'pending_approval',
        newLocation: { ...coordinates, geofenceRadius },
      }],
      creditLimit,
      paymentType: req.body.paymentType || 'credit',
      creditDays,
      openingBalance: openingOutstanding,
      originalOpeningOutstanding: openingOutstanding,
      remainingOpeningOutstanding: openingOutstanding,
      outstandingAmount: openingOutstanding,
      openingBalanceDate: req.body.openingBalanceDate || null,
      creditStatus: req.body.creditStatus || 'allowed',
      status: req.body.status || 'active',
    };

    const data = await Dealer.create({
      ...normalized,
      ...hierarchy,
      ...rsmStamp,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.update = async (req, res) => {
  try {
    if (Object.prototype.hasOwnProperty.call(req.body, 'locationVerificationStatus')
      || Object.prototype.hasOwnProperty.call(req.body, 'locationAudit')
      || Object.prototype.hasOwnProperty.call(req.body, 'locationReviewedBy')
      || Object.prototype.hasOwnProperty.call(req.body, 'locationReviewedAt')
      || Object.prototype.hasOwnProperty.call(req.body, 'locationRejectionReason')) {
      return res.status(400).json({ success: false, message: 'Location approval fields can only be changed through the location review action.' });
    }

    // Accept openingOutstanding OR openingBalance — both mean the same thing
    const rawOpening = req.body.openingOutstanding ?? req.body.openingBalance;
    const openingBalance = rawOpening !== undefined ? Number(rawOpening) : undefined;
    const creditLimit    = req.body.creditLimit    !== undefined ? Number(req.body.creditLimit) : undefined;

    const updateData = { ...req.body };
    const dealerScope = scopeFilter(req, 'dealer');
    const hasLatitude = Object.prototype.hasOwnProperty.call(req.body, 'latitude');
    const hasLongitude = Object.prototype.hasOwnProperty.call(req.body, 'longitude');
    const hasRadius = Object.prototype.hasOwnProperty.call(req.body, 'geofenceRadius');
    let locationAuditEntry;
    if (hasLatitude || hasLongitude || hasRadius) {
      const existing = await Dealer.findOne({ _id: req.params.id, ...dealerScope });
      if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
      const coordinates = validateCoordinates(
        hasLatitude ? req.body.latitude : existing.latitude,
        hasLongitude ? req.body.longitude : existing.longitude,
      );
      const geofenceRadius = validateGeofenceRadius(hasRadius ? req.body.geofenceRadius : (existing.geofenceRadius ?? 75));
      const previousLocation = {
        latitude: existing.latitude ?? null,
        longitude: existing.longitude ?? null,
        geofenceRadius: existing.geofenceRadius ?? 75,
      };
      const newLocation = { ...coordinates, geofenceRadius };
      const locationChanged = previousLocation.latitude !== newLocation.latitude
        || previousLocation.longitude !== newLocation.longitude
        || previousLocation.geofenceRadius !== newLocation.geofenceRadius;
      Object.assign(updateData, coordinates);
      updateData.geofenceRadius = geofenceRadius;
      if (locationChanged) {
        updateData.locationVerificationStatus = 'pending_approval';
        updateData.locationReviewedBy = null;
        updateData.locationReviewedAt = null;
        updateData.locationRejectionReason = '';
        locationAuditEntry = {
          action: 'changed',
          changedBy: req.user._id,
          status: 'pending_approval',
          previousLocation,
          newLocation,
        };
      }
    }
    // Always save as openingBalance in DB, also update all related fields
    if (openingBalance !== undefined) {
      updateData.openingBalance                = openingBalance;
      updateData.originalOpeningOutstanding    = openingBalance;
      updateData.remainingOpeningOutstanding   = openingBalance;
      // Remove client-sent variants to avoid confusion
      delete updateData.openingOutstanding;
    }
    if (creditLimit !== undefined) updateData.creditLimit = creditLimit;

    // Never let client overwrite outstandingAmount — always recalculate below
    delete updateData.outstandingAmount;
    delete updateData.availableCredit;

    const updateOperation = { $set: updateData };
    if (locationAuditEntry) updateOperation.$push = { locationAudit: locationAuditEntry };
    const updated = await Dealer.findOneAndUpdate(
      { _id: req.params.id, ...dealerScope },
      updateOperation,
      { new: true, runValidators: false },
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });

    // Recalculate live outstanding using new openingBalance
    const { outstandingAmount, availableCredit } = await syncOutstanding(req.params.id);
    const data = await Dealer.findOne({ _id: req.params.id, ...dealerScope })
      .populate('se so asm rsm nsm', 'name employeeId phone');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });

    const result = data.toObject();
    result.outstandingAmount = outstandingAmount;
    result.availableCredit   = availableCredit;

    res.json({ success: true, data: result });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.verifyLocation = async (req, res) => {
  try {
    const { status, reason } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Choose Approved or Rejected.' });
    }
    const dealer = await Dealer.findById(req.params.id);
    if (!dealer) return res.status(404).json({ success: false, message: 'Not found' });
    const coordinates = validateCoordinates(dealer.latitude, dealer.longitude);
    if (coordinates.latitude === null) {
      throw new Error('Add the dealer shop coordinates before reviewing this location.');
    }
    validateGeofenceRadius(dealer.geofenceRadius ?? 75);

    const rejectionReason = status === 'rejected' ? String(reason || '').trim() : '';
    const update = {
      locationVerificationStatus: status,
      locationReviewedBy: req.user._id,
      locationReviewedAt: new Date(),
      locationRejectionReason: rejectionReason,
    };
    const updated = await Dealer.findOneAndUpdate(
      {
        _id: req.params.id,
        latitude: dealer.latitude ?? null,
        longitude: dealer.longitude ?? null,
        $and: [
          { $or: [{ geofenceRadius: dealer.geofenceRadius ?? 75 }, { geofenceRadius: null }] },
          { $or: [
            { locationVerificationStatus: dealer.locationVerificationStatus },
            { locationVerificationStatus: { $exists: false } },
          ] },
        ],
      },
      {
        $set: update,
        $push: {
          locationAudit: {
            action: status,
            changedBy: req.user._id,
            status,
            previousLocation: {
              latitude: dealer.latitude,
              longitude: dealer.longitude,
              geofenceRadius: dealer.geofenceRadius ?? 75,
            },
            newLocation: {
              latitude: dealer.latitude,
              longitude: dealer.longitude,
              geofenceRadius: dealer.geofenceRadius ?? 75,
            },
            reason: rejectionReason,
          },
        },
      },
      { new: true },
    );
    if (!updated) {
      return res.status(409).json({ success: false, message: 'Dealer location changed during review. Reload it and review the current coordinates.' });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const data = await Dealer.findOneAndDelete({
      _id: req.params.id,
      ...scopeFilter(req, 'dealer'),
    });
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Assign multiple Sales Officers to a dealer
exports.assignSO = async (req, res) => {
  try {
    const User = require('../models/User');
    const { soIds, assignments } = req.body;
    const roleAssignments = Array.isArray(assignments)
      ? assignments.filter(item => item?.id && ['so', 'se', 'asm', 'rsm', 'nsm'].includes(item.role))
      : (Array.isArray(soIds) ? soIds.map(id => ({ id, role: 'so' })) : []);
    if (!roleAssignments.length && !Array.isArray(assignments) && !Array.isArray(soIds))
      return res.status(400).json({ success: false, message: 'assignments must be an array' });

    const primary = roleAssignments[0];
    const primaryUser = primary ? await User.findById(primary.id).lean() : null;
    const soIdsToSave = roleAssignments.filter(item => item.role === 'so').map(item => item.id);
    const data = await Dealer.findByIdAndUpdate(
      req.params.id,
      {
        so: soIdsToSave,
        se: primary?.role === 'se' ? primary.id : primaryUser?.reportsTo || null,
        asm: primary?.role === 'asm' ? primary.id : primaryUser?.asm || null,
        rsm: primary?.role === 'rsm' ? primary.id : primaryUser?.rsm || null,
        nsm: primary?.role === 'nsm' ? primary.id : primaryUser?.nsm || null,
        assignedRole: primary?.role || null,
      },
      { new: true }
    ).populate('se so asm rsm nsm', 'name employeeId phone');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// Link a dealer-role user account to a dealer
exports.linkUser = async (req, res) => {
  try {
    const User = require('../models/User');
    const { userId } = req.body;
    const dealerId = req.params.id;

    // Update Dealer document
    const data = await Dealer.findByIdAndUpdate(
      dealerId,
      { linkedUser: userId },
      { new: true }
    );
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });

    // Update User document so scopeFilter works in dealer portal
    await User.findByIdAndUpdate(userId, { linkedDealer: dealerId });

    res.json({ success: true, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.collections = async (req, res) => {
  try {
    const filter = { dealer: req.params.id };
    const data = await require('../models/Collection').find(filter)
      .populate('dealer', 'dealerName dealerCode')
      .populate('allocations.sale', 'invoiceNumber date dueDate grandTotal paidAmount remainingBalance paymentStatus')
      .sort('-date');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.invoices = async (req, res) => {
  try {
    const ACTIVE = ['pending', 'approved', 'hold', 'warehouse', 'out_for_delivery', 'delivered', 'completed'];
    let invoices = await require('../models/Sale').find({ dealer: req.params.id, status: { $in: ACTIVE }, remainingBalance: { $gt: 0 } })
      .select('invoiceNumber date dueDate grandTotal paidAmount remainingBalance paymentStatus')
      .sort({ dueDate: 1, date: 1 });

    if (!invoices.length) {
      const orders = await require('../models/Order').find({ dealer: req.params.id, status: { $in: ACTIVE } })
        .select('orderNumber date grandTotal collectedAmount status').sort({ date: 1 });
      invoices = orders.map(o => ({
        _id: o._id,
        invoiceNumber: o.orderNumber,
        date: o.date,
        dueDate: o.date,
        grandTotal: o.grandTotal || 0,
        paidAmount: o.collectedAmount || 0,
        remainingBalance: Math.max(0, (o.grandTotal || 0) - (o.collectedAmount || 0)),
        paymentStatus: (o.collectedAmount >= o.grandTotal) ? 'PAID' : (o.collectedAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID'),
      }));
    }
    res.json({ success: true, data: invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.ledger = async (req, res) => {
  try {
    const entries = await require('../models/DealerLedger').find({ dealer: req.params.id })
      .sort('-date');
    res.json({ success: true, data: entries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
