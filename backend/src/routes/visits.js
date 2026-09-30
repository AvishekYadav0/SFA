const router = require('express').Router();
const { getAll, getOne, create, checkOut, update, remove, getStats } = require('../controllers/visitController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/stats', authorize('admin'), getStats);
router.get('/',      authorize('admin', 'nsm', 'rsm', 'asm', 'se', 'so'), getAll);
router.get('/:id',   authorize('admin', 'nsm', 'rsm', 'asm', 'se', 'so'), getOne);
router.post('/',     authorize('admin', 'nsm', 'rsm', 'asm', 'se', 'so'), create);
router.patch('/:id/checkout', authorize('admin', 'nsm', 'rsm', 'asm', 'se', 'so'), checkOut);
router.put('/:id',   authorize('admin'), update);
router.delete('/:id', authorize('admin'), remove);

module.exports = router;
