const router = require('express').Router();
const Target = require('../models/Target');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin', 'nsm', 'rsm', 'asm', 'se'));

router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.user)  filter.user  = req.query.user;
    if (req.query.year)  filter.year  = parseInt(req.query.year);
    if (req.query.month) filter.month = parseInt(req.query.month);
    if (req.query.role)  {
      const User = require('../models/User');
      const users = await User.find({ role: req.query.role }).select('_id').lean();
      filter.user = { $in: users.map(u => u._id) };
    }
    const data = await Target.find(filter).populate('user', 'name role employeeId province area').sort('-year -month');
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const data = await Target.findOneAndUpdate(
      { user: req.body.user, month: req.body.month, year: req.body.year },
      { ...req.body, setBy: req.user._id },
      { upsert: true, new: true }
    );
    res.status(201).json({ success: true, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const data = await Target.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await Target.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
