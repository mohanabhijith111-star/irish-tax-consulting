const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  timestamp:  { type: Date, default: Date.now },
  action:     { type: String, required: true },   // create, update, delete, export, compute
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  clientId:   { type: String },
  field:      { type: String },
  oldValue:   { type: String },
  newValue:   { type: String },
  notes:      { type: String },
  ip:         { type: String },
}, { timestamps: false });

// Auto-expire logs after 7 years (Revenue compliance — TCA 1997 s.469)
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 365 * 24 * 60 * 60 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
