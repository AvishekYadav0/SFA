const router = require('express').Router();
const SoleDealer = require('../models/SoleDealer');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin', 'staff'));

router.get('/', async (req, res) => {
  const data = await SoleDealer.find().sort('name');
  res.json({ success: true, data });
});

router.post('/', authorize('admin'), async (req, res) => {
  const data = await SoleDealer.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json({ success: true, data });
});

router.put('/:id', authorize('admin'), async (req, res) => {
  const data = await SoleDealer.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!data) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data });
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  await SoleDealer.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Deleted' });
});

module.exports = router;
