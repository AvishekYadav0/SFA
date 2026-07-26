const DailyVisit = require('../models/DailyVisit');

const today = () => new Date().toISOString().split('T')[0];

// Admin: assign dealers to a staff for a date
exports.assign = async (req, res) => {
  try {
    const { date, staff, dealers } = req.body; // dealers = array of dealer IDs
    const d = date || today();

    const docs = dealers.map(dealer => ({
      date: d, staff, dealer, assignedBy: req.user._id,
    }));

    // insertMany with ordered:false so duplicates are skipped silently
    await DailyVisit.insertMany(docs, { ordered: false }).catch(() => {});

    res.json({ success: true, message: 'Dealers assigned' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: get all assignments (optionally filter by date/staff)
exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.date)  filter.date  = req.query.date;
    if (req.query.staff) filter.staff = req.query.staff;

    const visits = await DailyVisit.find(filter)
      .populate('staff',  'name email assignedArea')
      .populate('dealer', 'dealerName area province phone')
      .populate('assignedBy', 'name')
      .sort({ date: -1, createdAt: 1 });

    res.json({ success: true, data: visits });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Staff: get MY assigned shops for a date
exports.getMine = async (req, res) => {
  try {
    const date = req.query.date || today();
    const visits = await DailyVisit.find({ staff: req.user._id, date })
      .populate('dealer', 'dealerName area province phone address')
      .sort({ createdAt: 1 });

    res.json({ success: true, data: visits });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Staff/Admin: update visit status
exports.updateStatus = async (req, res) => {
  try {
    const { visitStatus, notes } = req.body;
    const visit = await DailyVisit.findByIdAndUpdate(
      req.params.id,
      { visitStatus, notes },
      { new: true }
    ).populate('dealer', 'dealerName area province phone');

    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
    res.json({ success: true, data: visit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: delete an assignment
exports.remove = async (req, res) => {
  try {
    await DailyVisit.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
