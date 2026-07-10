const router = require('express').Router();
const c = require('../controllers/liftingController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.route('/').get(c.getAll).post(authorize('admin', 'staff'), c.create);
router.route('/:id').get(c.getOne).put(authorize('admin', 'staff'), c.update).delete(authorize('admin'), c.remove);

module.exports = router;
