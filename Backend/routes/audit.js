const router  = require('express').Router();
const AuditLog = require('../models/AuditLog');
const auth     = require('../middleware/auth');

router.use(auth);

// GET /api/audit — query audit log
router.get('/', async (req, res) => {
  try {
    const { clientId, action, from, to, page = 1, limit = 100 } = req.query;
    const filter = {};
    if (clientId) filter.clientId = clientId;
    if (action)   filter.action = action;
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to)   filter.timestamp.$lte = new Date(to);
    }
    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const total = await AuditLog.countDocuments(filter);
    res.json({ logs, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/audit — write an audit entry (from the frontend tool)
router.post('/', async (req, res) => {
  try {
    const { action, clientId, field, oldValue, newValue, notes } = req.body;
    if (!action) return res.status(400).json({ error: 'action required' });
    const entry = await AuditLog.create({
      action, clientId, field, oldValue, newValue, notes,
      userId: req.user.id,
      ip: req.ip
    });
    res.status(201).json(entry);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
