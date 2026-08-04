const Claim = require('../models/Claim');
const User  = require('../models/User');
const Dealer = require('../models/Dealer');

// ── Auto-calculation rules ────────────────────────────────────────────────────
const calculateAmount = (claimType, body) => {
  const qty    = parseFloat(body.quantity)   || 0;
  const rate   = parseFloat(body.rate)       || 0;
  const km     = parseFloat(body.km)         || 0;
  const rateKm = parseFloat(body.ratePerKm)  || 15;

  switch (claimType) {
    case 'Primary Scheme':   return qty * rate;
    case 'Secondary Scheme': return qty * rate * 0.5;
    case 'SLSB':             return qty * rate;
    case 'RD':               return qty * rate * 0.02;
    case 'Transportation':   return km  * rateKm;
    case 'Sampling':         return qty * rate;
    case 'Leakage':          return qty * rate;
    case 'Breakage':         return qty * rate;
    case 'Display':          return parseFloat(body.displayAmount) || 0;
    case 'Others':           return parseFloat(body.otherAmount)   || 0;
    default:                 return 0;
  }
};

const extractCalcInputs = (claimType, body) => {
  switch (claimType) {
    case 'Transportation': return { km: body.km, ratePerKm: body.ratePerKm || 15 };
    case 'Display':        return { displayAmount: body.displayAmount };
    case 'Others':         return { otherAmount: body.otherAmount };
    default:               return { quantity: body.quantity, rate: body.rate };
  }
};

// ── Approval chain ────────────────────────────────────────────────────────────
// SE → ASM → RSM → NSM → Accounts(admin) → Paid
// If submitter IS one of these roles, their own step is skipped
const CHAIN = [
  { status: 'Pending ASM Approval',      role: 'asm',   field: 'asmApprover'     },
  { status: 'Pending RSM Approval',      role: 'rsm',   field: 'rsmApprover'     },
  { status: 'Pending NSM Approval',      role: 'nsm',   field: 'nsmApprover'     },
  { status: 'Pending Accounts Approval', role: 'admin', field: 'accountApprover' },
];

// Role index — higher = more senior
const ROLE_RANK = { se: 0, asm: 1, rsm: 2, nsm: 3, admin: 4 };

// Find approver scoped to submitter's province/area.
const findApprover = async (role, province, area) => {
  const query = { role, isActive: true };
  if (role === 'asm' && province && area) { query.province = province; query.area = area; }
  else if (role === 'asm' && area)        { query.area = area; }
  if (role === 'rsm' && province)         { query.province = province; }
  return User.findOne(query).select('_id');
};

const buildChainApprovers = async (submitter) => {
  const approvers = {};
  for (const step of CHAIN) {
    // If submitter's role is at or above this step's role, skip assigning
    if ((ROLE_RANK[submitter.role] || 0) >= ROLE_RANK[step.role]) {
      approvers[step.field] = null;
      continue;
    }
    const u = await findApprover(step.role, submitter.province, submitter.area);
    approvers[step.field] = u?._id || null;
  }
  return approvers;
};

// Get the first chain step this submitter needs approval from
const getInitialStatus = (submitterRole, approvers) => {
  const submitterRank = ROLE_RANK[submitterRole] || 0;
  // Find first step above submitter's rank that has an approver (or skip if none)
  for (const step of CHAIN) {
    if (ROLE_RANK[step.role] > submitterRank) {
      if (approvers[step.field]) return step.status;
      // No approver found for this step — continue to next
    }
  }
  // Admin submitting — goes straight to Accounts (themselves), or Approved
  if (submitterRole === 'admin') return 'Pending Accounts Approval';
  return 'Pending Accounts Approval'; // fallback
};

// ── GET /api/claims ───────────────────────────────────────────────────────────
exports.getClaims = async (req, res) => {
  try {
    const { user } = req;
    let filter = {};

    if (user.role === 'se') {
      filter.submittedBy = user._id;
    } else if (user.role === 'asm') {
      // Only claims where this ASM is the assigned asmApprover
      filter.asmApprover = user._id;
    } else if (user.role === 'rsm') {
      filter.rsmApprover = user._id;
    } else if (user.role === 'nsm') {
      filter.nsmApprover = user._id;
    }
    // admin: no filter — sees all claims

    const claims = await Claim.find(filter)
      .populate('submittedBy',  'name role province area')
      .populate('dealer',       'dealerName')
      .populate('product',      'productName sku')
      .populate('asmApprover',  'name')
      .populate('rsmApprover',  'name')
      .populate('nsmApprover',  'name')
      .populate('accountApprover', 'name')
      .populate('approvalHistory.approver', 'name role')
      .sort('-createdAt');

    res.json({ success: true, data: claims });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/claims/:id ───────────────────────────────────────────────────────
exports.getOneClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id)
      .populate('submittedBy',  'name role province area')
      .populate('dealer',       'dealerName')
      .populate('product',      'productName sku')
      .populate('asmApprover',  'name')
      .populate('rsmApprover',  'name')
      .populate('nsmApprover',  'name')
      .populate('accountApprover', 'name')
      .populate('approvalHistory.approver', 'name role');

    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });

    const { user } = req;

    // admin sees everything — never block
    if (user.role === 'admin') return res.json({ success: true, data: claim });

    // SE: own claims only
    if (user.role === 'se') {
      const ownerId = claim.submittedBy?._id?.toString() || claim.submittedBy?.toString();
      if (ownerId !== user._id.toString())
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // ASM: only claims routed to them
    if (user.role === 'asm') {
      const asmId = claim.asmApprover?._id?.toString() || claim.asmApprover?.toString();
      if (asmId !== user._id.toString())
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // RSM: only claims routed to them
    if (user.role === 'rsm') {
      const rsmId = claim.rsmApprover?._id?.toString() || claim.rsmApprover?.toString();
      if (rsmId !== user._id.toString())
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // NSM: only claims routed to them
    if (user.role === 'nsm') {
      const nsmId = claim.nsmApprover?._id?.toString() || claim.nsmApprover?.toString();
      if (nsmId !== user._id.toString())
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: claim });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/claims ──────────────────────────────────────────────────────────
exports.createClaim = async (req, res) => {
  try {
    const { user } = req;
    const { claimType } = req.body;

    const calculatedAmount = calculateAmount(claimType, req.body);
    const calcInputs = extractCalcInputs(claimType, req.body);
    let approvers = {};
    let initialStatus;

    if (user.role === 'dealer') {
      // Dealer is the submitter, find the SE for their area/province
      const seApprover = await findApprover('se', user.province, user.area);
      approvers.asmApprover = seApprover?._id || null; // The first step is SE, but the field is asmApprover in the logic. Let's find the SE and put them in the first slot.
      initialStatus = 'Pending ASM Approval'; // This status corresponds to the first step in the chain (SE)
    } else {
      // Existing logic for staff members
      approvers = await buildChainApprovers(user);
      initialStatus = getInitialStatus(user.role, approvers);
    }

    const claim = await Claim.create({
      ...req.body,
      dealer:      req.body.dealer   || undefined,
      product:     req.body.product  || undefined,
      attachments: req.body.attachments || {},
      calculatedAmount,
      calcInputs,
      submittedBy: user._id,
      status:      initialStatus,
      ...approvers,
      approvalHistory: [{
        approver:     user._id,
        action:       'Submitted',
        statusAtTime: 'Draft',
        remarks:      'Claim submitted',
      }],
    });

    // If a dealer user is created, also create a corresponding dealer profile
    if (claim.role === 'dealer') {
      await Dealer.create({
        userId:       claim._id,
        dealerName:   claim.name,
        ownerName:    claim.name,
        phone:        claim.phone,
        email:        claim.email,
        province:     claim.province,
        area:         claim.area,
        status:       'active',
      });
    }

    res.status(201).json({ success: true, data: claim });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/claims/:id/action ───────────────────────────────────────────────
exports.processClaimAction = async (req, res) => {
  try {
    const { user } = req;
    const { action, remarks } = req.body;

    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });

    // ── Mark as Paid (admin only, after Approved) ─────────────────────────────
    if (action === 'paid') {
      if (user.role !== 'admin')
        return res.status(403).json({ success: false, message: 'Only Accounts can mark as Paid.' });
      if (claim.status !== 'Approved')
        return res.status(400).json({ success: false, message: 'Claim must be Approved before marking Paid.' });

      claim.status = 'Paid';
      claim.paidAt = new Date();
      claim.paidBy = user._id;
      claim.approvalHistory.push({ approver: user._id, action: 'Paid', statusAtTime: 'Approved', remarks: remarks || '' });
      await claim.save();
      return res.json({ success: true, data: claim });
    }

    // ── Verify current step ───────────────────────────────────────────────────
    const stepMap = {
      'Pending ASM Approval':      { field: 'asmApprover',     role: 'asm'   },
      'Pending RSM Approval':      { field: 'rsmApprover',     role: 'rsm'   },
      'Pending NSM Approval':      { field: 'nsmApprover',     role: 'nsm'   },
      'Pending Accounts Approval': { field: 'accountApprover', role: 'admin' },
    };

    const step = stepMap[claim.status];
    if (!step)
      return res.status(400).json({ success: false, message: `Claim is not pending approval (status: ${claim.status})` });

    // Role check first
    if (user.role !== step.role)
      return res.status(403).json({ success: false, message: `This step requires a ${step.role.toUpperCase()} approver.` });

    // If an approver is assigned, enforce it strictly (hierarchy isolation)
    // If null (no approver was found at submission time), any user of the correct role can act
    const assignedId = claim[step.field]?.toString();
    if (assignedId && assignedId !== user._id.toString())
      return res.status(403).json({ success: false, message: 'You are not the assigned approver for this step.' });

    const historyEntry = { approver: user._id, remarks: remarks || '', statusAtTime: claim.status };

    if (action === 'approve') {
      historyEntry.action = 'Approved';
      const chainIdx = CHAIN.findIndex(c => c.status === claim.status);

      if (chainIdx < CHAIN.length - 1) {
        // Advance to next step
        claim.status = CHAIN[chainIdx + 1].status;
        // Lazily assign next approver if not already set
        const nextStep  = CHAIN[chainIdx + 1];
        if (!claim[nextStep.field]) {
          const submitter = await User.findById(claim.submittedBy);
          const next = await findApprover(nextStep.role, submitter?.province, submitter?.area);
          claim[nextStep.field] = next?._id || null;
        }
      } else {
        // Last step (Accounts) approved → ready to be paid
        claim.status = 'Approved';
      }

    } else if (action === 'reject') {
      if (!remarks)
        return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
      historyEntry.action   = 'Rejected';
      claim.status          = 'Rejected';
      claim.rejectionReason = remarks;

    } else {
      return res.status(400).json({ success: false, message: 'Invalid action. Use approve / reject / paid.' });
    }

    claim.approvalHistory.push(historyEntry);
    await claim.save();
    res.json({ success: true, data: claim });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/claims/:id/resubmit ─────────────────────────────────────────────
exports.resubmitClaim = async (req, res) => {
  try {
    const { user } = req;
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });

    if (claim.submittedBy.toString() !== user._id.toString())
      return res.status(403).json({ success: false, message: 'Only the original submitter can resubmit.' });
    if (claim.status !== 'Rejected')
      return res.status(400).json({ success: false, message: 'Only rejected claims can be resubmitted.' });

    const approvers = await buildChainApprovers(user);
    const initialStatus = getInitialStatus(user.role, approvers);

    claim.status          = initialStatus;
    claim.rejectionReason = '';
    Object.assign(claim, approvers);
    claim.approvalHistory.push({
      approver:     user._id,
      action:       'Submitted',
      statusAtTime: 'Rejected',
      remarks:      req.body.remarks || 'Resubmitted after rejection',
    });

    await claim.save();
    res.json({ success: true, data: claim });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
