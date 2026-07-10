const router = require('express').Router();
const c = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.route('/').get(c.getAll).post(authorize('admin', 'staff'), c.create);
router.route('/:id').get(c.getOne).put(authorize('admin', 'staff'), c.update).delete(authorize('admin'), c.remove);
router.put('/:id/status', authorize('admin'), c.updateStatus);

module.exports = router;
