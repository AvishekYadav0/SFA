const router = require('express').Router();
const {
  getClaims, getOneClaim, createClaim, processClaimAction, resubmitClaim,
} = require('../controllers/claimController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getClaims)
  .post(authorize('se', 'asm', 'rsm', 'nsm', 'admin', 'dealer'), createClaim);

router.get('/:id', getOneClaim);

// Approve / reject
router.post('/:id/action',   authorize('asm', 'rsm', 'nsm', 'admin'), processClaimAction);

// Resubmit after rejection
router.post('/:id/resubmit', authorize('se', 'asm', 'rsm', 'nsm', 'admin', 'dealer'), resubmitClaim);

module.exports = router;
