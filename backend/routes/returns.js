const router = require('express').Router();
const Return = require('../models/Return');
const auth   = require('../middleware/auth');

router.use(auth);

// GET /api/returns — list returns (queue view)
router.get('/', async (req, res) => {
  try {
    const { clientId, taxYear, status, consultant, priority, page = 1, limit = 100 } = req.query;
    const filter = {};
    if (clientId)   filter.clientId = clientId;
    if (taxYear)    filter.taxYear = parseInt(taxYear);
    if (status)     filter.status = status;
    if (consultant && consultant !== 'All') filter.consultant = consultant;
    if (priority)   filter.priority = priority;

    const returns = await Return.find(filter)
      .populate('clientId', 'firstName lastName email pps crmId')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-formSnapshot -history');  // exclude large fields from list

    const total = await Return.countDocuments(filter);
    res.json({ returns, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/returns/:id — single return with full snapshot and history
router.get('/:id', async (req, res) => {
  try {
    const ret = await Return.findById(req.params.id)
      .populate('clientId', 'firstName lastName email pps dob address phone crmId');
    if (!ret) return res.status(404).json({ error: 'Return not found' });
    res.json(ret);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/returns — create new return
router.post('/', async (req, res) => {
  try {
    const { clientId, clientRef, taxYear, formType, assessMode,
            status, priority, consultant, deadline, notes, fileRef,
            formSnapshot, resultSummary, returnRef } = req.body;

    if (!clientId || !taxYear)
      return res.status(400).json({ error: 'clientId and taxYear are required' });

    const ret = await Return.create({
      clientId, clientRef, taxYear, formType, assessMode,
      status: status || 'pending',
      priority: priority || 'normal',
      consultant: consultant || req.user.name,
      deadline, notes, fileRef, formSnapshot, resultSummary, returnRef,
      history: [{
        id: `h_${Date.now()}`,
        type: 'ev-created',
        ts: new Date(),
        who: req.user.name,
        body: `Return created for tax year ${taxYear}`
      }]
    });
    res.status(201).json(ret);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Return for this client/year already exists' });
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/returns/:id — partial update (status, consultant, snapshot etc.)
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['status','priority','consultant','deadline','notes',
                     'fileRef','formSnapshot','resultSummary','formType','assessMode'];
    const update = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

    const ret = await Return.findByIdAndUpdate(
      req.params.id, { $set: update }, { new: true, runValidators: true }
    );
    if (!ret) return res.status(404).json({ error: 'Return not found' });
    res.json(ret);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/returns/:id/status — update status + log to history
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, note } = req.body;
    const valid = ['pending','in-progress','review','done','archived'];
    if (!valid.includes(status))
      return res.status(400).json({ error: 'Invalid status value' });

    const histEntry = {
      id: `h_${Date.now()}`,
      type: 'ev-status',
      ts: new Date(),
      who: req.user.name,
      body: note || `Status changed to ${status}`
    };
    const ret = await Return.findByIdAndUpdate(req.params.id, {
      $set: { status },
      $push: { history: { $each: [histEntry], $position: 0 } }
    }, { new: true });
    if (!ret) return res.status(404).json({ error: 'Return not found' });
    res.json(ret);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/returns/:id/history — add note/event to timeline
router.post('/:id/history', async (req, res) => {
  try {
    const { type, body } = req.body;
    if (!body) return res.status(400).json({ error: 'body required' });

    const entry = {
      id: `h_${Date.now()}`,
      type: type || 'ev-note',
      ts: new Date(),
      who: req.user.name,
      body
    };
    const ret = await Return.findByIdAndUpdate(req.params.id,
      { $push: { history: { $each: [entry], $position: 0 } } },
      { new: true }
    );
    if (!ret) return res.status(404).json({ error: 'Return not found' });
    res.json({ entry });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/returns/sync — bulk upsert from localStorage (migration helper)
router.post('/sync', async (req, res) => {
  try {
    const { returns } = req.body;
    if (!Array.isArray(returns)) return res.status(400).json({ error: 'returns array required' });

    const results = await Promise.allSettled(
      returns.map(r => Return.findOneAndUpdate(
        { returnRef: r.id },
        { $set: { ...r, returnRef: r.id } },
        { upsert: true, new: true }
      ))
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    res.json({ synced: succeeded, total: returns.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/returns/:id
router.delete('/:id', async (req, res) => {
  try {
    const ret = await Return.findByIdAndDelete(req.params.id);
    if (!ret) return res.status(404).json({ error: 'Return not found' });
    res.json({ message: 'Return deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
