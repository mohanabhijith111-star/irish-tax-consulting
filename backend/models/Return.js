const mongoose = require('mongoose');

const HistoryEntrySchema = new mongoose.Schema({
  id:   { type: String, required: true },
  type: {
    type: String,
    enum: ['ev-created','ev-status','ev-note','ev-computation','ev-assigned','ev-document','ev-system'],
    required: true
  },
  ts:   { type: Date, default: Date.now },
  who:  { type: String, default: 'System' },
  body: { type: String, required: true },
}, { _id: false });

const ReturnSchema = new mongoose.Schema({
  // Browser-generated ID for sync
  returnRef:  { type: String, unique: true, sparse: true },

  clientId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  clientRef:  { type: String },   // browser client ID — for sync without ObjectId lookup

  taxYear:    { type: Number, required: true, min: 2018, max: 2030 },
  formType:   { type: String, enum: ['f11','f12','auto'], default: 'auto' },
  assessMode: { type: String, enum: ['single','joint','separate','treatment'], default: 'single' },

  status: {
    type: String,
    enum: ['pending','in-progress','review','done','archived'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low','normal','high','urgent'],
    default: 'normal'
  },

  consultant:  { type: String, default: 'Unassigned' },
  deadline:    { type: Date },
  notes:       { type: String, default: '' },
  fileRef:     { type: String },

  // The complete form state — large JSON blob (income, credits, deductions etc.)
  formSnapshot:   { type: mongoose.Schema.Types.Mixed },

  // The computed result summary (not the full proforma HTML)
  resultSummary: {
    totalLiability: { type: Number },
    totalPaid:      { type: Number },
    balance:        { type: Number },
    netIT:          { type: Number },
    totalUSC:       { type: Number },
    totalPRSI:      { type: Number },
    assessType:     { type: String },
    computedAt:     { type: Date },
  },

  history: [HistoryEntrySchema],
}, { timestamps: true });

// Compound index — one return per client per year
ReturnSchema.index({ clientId: 1, taxYear: 1 }, { unique: true });

module.exports = mongoose.model('Return', ReturnSchema);
