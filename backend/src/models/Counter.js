const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 },
});

// Get next sequence number for given name (atomic)
CounterSchema.statics.getNext = async function(name) {
  const doc = await this.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
};

module.exports = mongoose.model('Counter', CounterSchema);
