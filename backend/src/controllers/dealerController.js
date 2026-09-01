const Dealer = require('../models/Dealer');
const { scopeFilter, hierarchyFields } = require('../middleware/auth');

// ── Core formula: Outstanding = openingBalance + sum(order remainingBalance) ──
async function calcOutstanding(dealerId) {
  const Order = require('../models/Order');
  const ACTIVE = ['pending', 'approved', 'hold', 'warehouse', 'out_for_delivery', 'delivered', 'completed'];
  const orders = await Order.find({ dealer: dealerId, status: { $in: ACTIVE } })
    .select('grandTotal collectedAmount');
  const dealer = await Dealer.findById(dealerId).select('openingBalance creditLimit creditNotes');
  if (!dealer) return { outstandingAmount: 0, availableCredit: 0 };

  const invoiceRemaining = orders.reduce((sum, o) => {
    return sum + Math.max(0, (o.grandTotal || 0) - (o.collectedAmount || 0));
  }, 0);

  const outstandingAmount = Number(dealer.openingBalance || 0) + invoiceRemaining - Number(dealer.creditNotes || 0);
  const availableCredit = Math.max(0, Number(dealer.creditLimit || 0) - outstandingAmount);
  return { outstandingAmount: Math.max(0, outstandingAmount), availableCredit };
}

// Recalculate and persist outstanding on dealer document
async function syncOutstanding(dealerId) {
  const { outstandingAmount, availableCredit } = await calcOutstanding(dealerId);
  await Dealer.findByIdAndUpdate(dealerId, { outstandingAmount });
  return { outstandingAmount, availableCredit };
}
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
    const dealers = await Dealer.find(filter)
      .populate('se',  'name employeeId phone')
      .populate('so',  'name employeeId phone')
      .populate('asm', 'name employeeId phone')
      .populate('rsm', 'name employeeId phone')
      .populate('nsm', 'name employeeId phone')
      .sort('-createdAt').skip((page - 1) * limit).limit(limit);

    // Attach live outstanding to each dealer
    const data = await Promise.all(dealers.map(async (d) => {
      const obj = d.toObject();
      const { outstandingAmount, availableCredit } = await calcOutstanding(d._id);
      obj.outstandingAmount = outstandingAmount;
      obj.availableCredit   = availableCredit;
      return obj;
    }));

    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const scope = scopeFilter(req, 'dealer');
    const data = await Dealer.findOne({ _id: req.params.id, ...scope })
      .populate('se so asm rsm nsm', 'name employeeId phone');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });

    // Always return live outstanding from actual invoice remaining balances
    const { outstandingAmount, availableCredit } = await calcOutstanding(req.params.id);
    const result = data.toObject();
    result.outstandingAmount = outstandingAmount;
    result.availableCredit   = availableCredit;

    res.json({ success: true, data: result });
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

    const creditLimit = Number(req.body.creditLimit ?? 0);
    const creditDays = Number(req.body.creditDays ?? 0);
    const openingOutstanding = Number(req.body.openingOutstanding ?? req.body.outstandingAmount ?? req.body.openingBalance ?? 0);

    if (creditLimit < 0) throw new Error('Credit Limit cannot be negative.');
    if (creditDays < 0) throw new Error('Credit Days cannot be negative.');
    if (openingOutstanding < 0) throw new Error('Opening Outstanding cannot be negative.');
    if (openingOutstanding > creditLimit) throw new Error('Opening Outstanding cannot exceed Credit Limit.');

    const normalized = {
      ...req.body,
      dealerName: req.body.dealerName?.trim(),
      ownerName: req.body.ownerName?.trim(),
      distributor: req.body.distributor?.trim(),
      phone: req.body.phone?.trim(),
      panNumber: req.body.panNumber?.trim(),
      nidNumber: req.body.nidNumber?.trim(),
      province: req.body.province?.trim(),
      district: req.body.district?.trim(),
      address: req.body.address?.trim(),
      creditLimit,
      paymentType: req.body.paymentType || 'credit',
      creditDays,
      openingBalance: openingOutstanding,
      originalOpeningOutstanding: openingOutstanding,
      remainingOpeningOutstanding: openingOutstanding,
      outstandingAmount: openingOutstanding,
      openingBalanceDate: req.body.openingBalanceDate || null,
      creditStatus: req.body.creditStatus || 'allowed',
      status: req.body.status || 'active',
    };

    const data = await Dealer.create({
      ...normalized,
      ...hierarchy,
      ...rsmStamp,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.update = async (req, res) => {
  try {
    // Accept openingOutstanding OR openingBalance — both mean the same thing
    const rawOpening = req.body.openingOutstanding ?? req.body.openingBalance;
    const openingBalance = rawOpening !== undefined ? Number(rawOpening) : undefined;
    const creditLimit    = req.body.creditLimit    !== undefined ? Number(req.body.creditLimit) : undefined;

    const updateData = { ...req.body };

    // Always save as openingBalance in DB, also update all related fields
    if (openingBalance !== undefined) {
      updateData.openingBalance                = openingBalance;
      updateData.originalOpeningOutstanding    = openingBalance;
      updateData.remainingOpeningOutstanding   = openingBalance;
      // Remove client-sent variants to avoid confusion
      delete updateData.openingOutstanding;
    }
    if (creditLimit !== undefined) updateData.creditLimit = creditLimit;

    // Never let client overwrite outstandingAmount — always recalculate below
    delete updateData.outstandingAmount;
    delete updateData.availableCredit;

    await Dealer.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: false });

    // Recalculate live outstanding using new openingBalance
    const { outstandingAmount, availableCredit } = await syncOutstanding(req.params.id);
    const data = await Dealer.findById(req.params.id)
      .populate('se so asm rsm nsm', 'name employeeId phone');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });

    const result = data.toObject();
    result.outstandingAmount = outstandingAmount;
    result.availableCredit   = availableCredit;

    res.json({ success: true, data: result });
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

exports.collections = async (req, res) => {
  try {
    const filter = { dealer: req.params.id };
    const data = await require('../models/Collection').find(filter)
      .populate('dealer', 'dealerName dealerCode')
      .populate('allocations.sale', 'invoiceNumber date dueDate grandTotal paidAmount remainingBalance paymentStatus')
      .sort('-date');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.invoices = async (req, res) => {
  try {
    const ACTIVE = ['pending', 'approved', 'hold', 'warehouse', 'out_for_delivery', 'delivered', 'completed'];
    let invoices = await require('../models/Sale').find({ dealer: req.params.id, status: { $in: ACTIVE }, remainingBalance: { $gt: 0 } })
      .select('invoiceNumber date dueDate grandTotal paidAmount remainingBalance paymentStatus')
      .sort({ dueDate: 1, date: 1 });

    if (!invoices.length) {
      const orders = await require('../models/Order').find({ dealer: req.params.id, status: { $in: ACTIVE } })
        .select('orderNumber date grandTotal collectedAmount status').sort({ date: 1 });
      invoices = orders.map(o => ({
        _id: o._id,
        invoiceNumber: o.orderNumber,
        date: o.date,
        dueDate: o.date,
        grandTotal: o.grandTotal || 0,
        paidAmount: o.collectedAmount || 0,
        remainingBalance: Math.max(0, (o.grandTotal || 0) - (o.collectedAmount || 0)),
        paymentStatus: (o.collectedAmount >= o.grandTotal) ? 'PAID' : (o.collectedAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID'),
      }));
    }
    res.json({ success: true, data: invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.ledger = async (req, res) => {
  try {
    const entries = await require('../models/DealerLedger').find({ dealer: req.params.id })
      .sort('-date');
    res.json({ success: true, data: entries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
