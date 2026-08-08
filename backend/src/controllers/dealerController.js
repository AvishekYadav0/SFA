const Dealer = require('../models/Dealer');
const { scopeFilter, hierarchyFields } = require('../middleware/auth');

exports.getAll = async (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const filter = { ...scopeFilter(req, 'dealer') };
    if (req.query.status)   filter.status   = req.query.status;
    if (req.query.province) filter.province = req.query.province;
    if (req.query.district) filter.district = req.query.district;
    if (req.query.area)     filter.area     = req.query.area;
    if (req.query.se)       filter.se       = req.query.se;
    if (req.query.asm)      filter.asm      = req.query.asm;
    if (req.query.search)   filter.$or = [
      { dealerName: new RegExp(req.query.search, 'i') },
      { dealerCode: new RegExp(req.query.search, 'i') },
      { phone:      new RegExp(req.query.search, 'i') },
    ];

    const total = await Dealer.countDocuments(filter);
    const data  = await Dealer.find(filter)
      .populate('se',  'name employeeId phone')
      .populate('so',  'name employeeId phone')
      .populate('asm', 'name employeeId phone')
      .populate('rsm', 'name employeeId phone')
      .populate('nsm', 'name employeeId phone')
      .sort('-createdAt').skip((page - 1) * limit).limit(limit);

    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const { scopeFilter } = require('../middleware/auth');
    const scope = scopeFilter(req, 'dealer');
    const data = await Dealer.findOne({ _id: req.params.id, ...scope })
      .populate('se so asm rsm nsm', 'name employeeId phone');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.create = async (req, res) => {
  try {
    const User = require('../models/User');

    // Determine creator: SE or SO creating directly, or manager specifying an SE
    let creator = req.user;
    if (['admin', 'nsm', 'rsm', 'asm'].includes(req.user.role) && req.body.se) {
      creator = await User.findById(req.body.se);
    } else if (['admin', 'nsm', 'rsm', 'asm'].includes(req.user.role) && req.body.so?.length) {
      creator = await User.findById(req.body.so[0]);
    }
    const hierarchy = await hierarchyFields(creator);

    // Also stamp rsm/asm/nsm directly from creator's stamped fields
    const rsmStamp = {
      rsm: creator?.rsm || (creator?.role === 'rsm' ? creator._id : null),
      asm: creator?.asm || (creator?.role === 'asm' ? creator._id : null),
      nsm: creator?.nsm || (creator?.role === 'nsm' ? creator._id : null),
    };

    const data = await Dealer.create({
      ...req.body,
      ...hierarchy,
      ...rsmStamp,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const data = await Dealer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.remove = async (req, res) => {
  try {
    await Dealer.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Assign multiple Sales Officers to a dealer
exports.assignSO = async (req, res) => {
  try {
    const User = require('../models/User');
    const { soIds, assignments } = req.body;
    const roleAssignments = Array.isArray(assignments)
      ? assignments.filter(item => item?.id && ['so', 'se', 'asm', 'rsm', 'nsm'].includes(item.role))
      : (Array.isArray(soIds) ? soIds.map(id => ({ id, role: 'so' })) : []);
    if (!roleAssignments.length && !Array.isArray(assignments) && !Array.isArray(soIds))
      return res.status(400).json({ success: false, message: 'assignments must be an array' });

    const primary = roleAssignments[0];
    const primaryUser = primary ? await User.findById(primary.id).lean() : null;
    const soIdsToSave = roleAssignments.filter(item => item.role === 'so').map(item => item.id);
    const data = await Dealer.findByIdAndUpdate(
      req.params.id,
      {
        so: soIdsToSave,
        se: primary?.role === 'se' ? primary.id : primaryUser?.reportsTo || null,
        asm: primary?.role === 'asm' ? primary.id : primaryUser?.asm || null,
        rsm: primary?.role === 'rsm' ? primary.id : primaryUser?.rsm || null,
        nsm: primary?.role === 'nsm' ? primary.id : primaryUser?.nsm || null,
        assignedRole: primary?.role || null,
      },
      { new: true }
    ).populate('se so asm rsm nsm', 'name employeeId phone');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// Link a dealer-role user account to a dealer
exports.linkUser = async (req, res) => {
  try {
    const User = require('../models/User');
    const { userId } = req.body;
    const dealerId = req.params.id;

    // Update Dealer document
    const data = await Dealer.findByIdAndUpdate(
      dealerId,
      { linkedUser: userId },
      { new: true }
    );
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });

    // Update User document so scopeFilter works in dealer portal
    await User.findByIdAndUpdate(userId, { linkedDealer: dealerId });

    res.json({ success: true, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};
