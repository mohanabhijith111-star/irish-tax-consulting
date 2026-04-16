const mongoose = require('mongoose');

// History entry sub-schema — matches the tool's timeline events
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

const ClientSchema = new mongoose.Schema({
  // Matches tool's client ID (UUID generated in browser)
  clientRef:  { type: String, unique: true, sparse: true },   // browser-generated ID for sync
  crmId:      { type: String, trim: true },

  // Personal details
  firstName:  { type: String, required: true, trim: true },
  lastName:   { type: String, required: true, trim: true },
  pps:        { type: String, trim: true },           // stored encrypted in tool (Fix 4)
  dob:        { type: String },                        // ISO date string
  email:      { type: String, trim: true, lowercase: true },
  phone:      { type: String, trim: true },
  address:    { type: String, trim: true },

  // CRM fields
  source:     { type: String, trim: true },            // how they came in
  received:   { type: Date, default: Date.now },       // when first received
  consultant: { type: String, default: 'Unassigned' },
  active:     { type: Boolean, default: true },

  history:    [HistoryEntrySchema],
}, { timestamps: true });

// Full-text search index
ClientSchema.index({ firstName: 'text', lastName: 'text', email: 'text', crmId: 'text' });

module.exports = mongoose.model('Client', ClientSchema);
