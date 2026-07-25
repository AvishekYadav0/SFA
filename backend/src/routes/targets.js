const router = require('express').Router();
const Target = require('../models/Target');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.staffId) filter.staffId = req.query.staffId;
  if (req.query.period)  filter.period  = req.query.period;
  if (req.query.year)    filter.year    = parseInt(req.query.year);
  if (req.query.month)   filter.month   = req.query.month;
  const data = await Target.find(filter).populate('staffId', 'name province designation');
  res.json({ success: true, data });
});

router.post('/', async (req, res) => {
  const data = await Target.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json({ success: true, data });
});

router.put('/:id', async (req, res) => {
  const data = await Target.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!data) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data });
});

router.delete('/:id', async (req, res) => {
  await Target.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Deleted' });
});

module.exports = router;
