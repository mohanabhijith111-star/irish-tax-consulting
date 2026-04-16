const router = require('express').Router();
const Client = require('../models/Client');
const auth   = require('../middleware/auth');

// All client routes require authentication
router.use(auth);

// GET /api/clients — list all clients (with optional search)
router.get('/', async (req, res) => {
  try {
    const { q, consultant, active = 'true', page = 1, limit = 50 } = req.query;
    const filter = { active: active === 'true' };
    if (consultant && consultant !== 'All') filter.consultant = consultant;
    if (q) filter.$text = { $search: q };

    const clients = await Client.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-history');  // history is big — exclude from list view

    const total = await Client.countDocuments(filter);
    res.json({ clients, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/clients/:id — single client with history
router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/clients — create new client
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, pps, dob, email, phone, address,
            crmId, clientRef, source, consultant } = req.body;

    if (!firstName || !lastName)
      return res.status(400).json({ error: 'firstName and lastName are required' });

    const client = await Client.create({
      firstName, lastName, pps, dob, email, phone, address,
      crmId, clientRef, source, consultant,
      history: [{
        id: `h_${Date.now()}`,
        type: 'ev-created',
        ts: new Date(),
        who: req.user.name,
        body: `Client record created by ${req.user.name}`
      }]
    });
    res.status(201).json(client);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Client reference already exists' });
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/clients/:id — update client details
router.put('/:id', async (req, res) => {
  try {
    const allowed = ['firstName','lastName','pps','dob','email','phone',
                     'address','crmId','source','consultant','active'];
    const update = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

    const client = await Client.findByIdAndUpdate(
      req.params.id, { $set: update }, { new: true, runValidators: true }
    );
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/clients/:id/history — add history event
router.post('/:id/history', async (req, res) => {
  try {
    const { type, body } = req.body;
    if (!body) return res.status(400).json({ error: 'body is required' });

    const entry = {
      id: `h_${Date.now()}`,
      type: type || 'ev-note',
      ts: new Date(),
      who: req.user.name,
      body
    };
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { $push: { history: { $each: [entry], $position: 0 } } },
      { new: true }
    );
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json({ entry, client });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/clients/:id — soft delete (GDPR: use hard delete for erasure)
router.delete('/:id', async (req, res) => {
  try {
    const { hard } = req.query;
    if (hard === 'true' && req.user.role === 'admin') {
      await Client.findByIdAndDelete(req.params.id);
      return res.json({ message: 'Client permanently deleted (GDPR Article 17)' });
    }
    const client = await Client.findByIdAndUpdate(
      req.params.id, { active: false }, { new: true }
    );
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json({ message: 'Client archived', client });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
