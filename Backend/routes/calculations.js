const router = require('express').Router();
const Return = require('../models/Return');
const auth   = require('../middleware/auth');

router.use(auth);

// POST /api/calculations/:returnId — save a computation result to a return
router.post('/:returnId', async (req, res) => {
  try {
    const { formSnapshot, resultSummary } = req.body;
    if (!resultSummary) return res.status(400).json({ error: 'resultSummary required' });

    const histEntry = {
      id: `h_${Date.now()}`,
      type: 'ev-computation',
      ts: new Date(),
      who: req.user.name,
      body: `Computation run for tax year. Balance: ${resultSummary.balance >= 0 ? 'Refund' : 'Payable'} €${Math.abs(resultSummary.balance || 0).toFixed(2)}`
    };

    const ret = await Return.findByIdAndUpdate(req.params.returnId, {
      $set: {
        formSnapshot: formSnapshot || undefined,
        resultSummary: { ...resultSummary, computedAt: new Date() }
      },
      $push: { history: { $each: [histEntry], $position: 0 } }
    }, { new: true });

    if (!ret) return res.status(404).json({ error: 'Return not found' });
    res.json({ message: 'Computation saved', resultSummary: ret.resultSummary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/calculations/:returnId — retrieve latest computation for a return
router.get('/:returnId', async (req, res) => {
  try {
    const ret = await Return.findById(req.params.returnId)
      .select('resultSummary taxYear assessMode formType');
    if (!ret) return res.status(404).json({ error: 'Return not found' });
    res.json(ret);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/calculations/summary/year/:year — aggregate summary for a tax year
router.get('/summary/year/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const summary = await Return.aggregate([
      { $match: { taxYear: year, 'resultSummary.balance': { $exists: true } } },
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRefunds:   { $sum: { $cond: [{ $gte: ['$resultSummary.balance', 0] }, '$resultSummary.balance', 0] } },
        totalPayable:   { $sum: { $cond: [{ $lt:  ['$resultSummary.balance', 0] }, '$resultSummary.balance', 0] } },
      }}
    ]);
    res.json({ year, summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
