const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  staffId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:      { type: String, required: true }, // YYYY-MM-DD
  status:    { type: String, enum: ['present', 'absent', 'half_day', 'leave', 'holiday'], default: 'present' },
  checkIn:   { type: Date },
  checkOut:  { type: Date },
  remarks:   { type: String },
  province:  { type: String },
  markedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

attendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
