const router = require('express').Router();
const { getAll, getOne, getActive, create, checkOut, resolveCheckOut, update, remove, getStats } = require('../controllers/visitController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/stats', authorize('admin'), getStats);
router.get('/active', authorize('admin', 'nsm', 'rsm', 'asm', 'se', 'so'), getActive);
router.get('/',      authorize('admin', 'nsm', 'rsm', 'asm', 'se', 'so'), getAll);
router.get('/:id',   authorize('admin', 'nsm', 'rsm', 'asm', 'se', 'so'), getOne);
router.post('/',     authorize('admin', 'nsm', 'rsm', 'asm', 'se', 'so'), create);
router.patch('/:id/checkout', authorize('nsm', 'rsm', 'asm', 'se', 'so'), checkOut);
router.patch('/:id/resolve-checkout', authorize('admin', 'asm'), resolveCheckOut);
router.put('/:id',   authorize('admin'), update);
router.delete('/:id', authorize('admin'), remove);

module.exports = router;
