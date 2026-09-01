const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/monthlyPlanningController');

router.use(protect);
router.get('/current', ctrl.getCurrent);
router.get('/', authorize('admin', 'nsm', 'rsm', 'asm', 'se'), ctrl.list);
router.post('/', authorize('admin', 'nsm', 'rsm', 'asm', 'se'), ctrl.create);
router.put('/:id', authorize('admin', 'nsm', 'rsm', 'asm', 'se'), ctrl.update);

module.exports = router;
