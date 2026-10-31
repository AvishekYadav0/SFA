const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/dailyVisitController');
const visitCtrl = require('../controllers/visitController');

router.use(protect);

router.get('/mine', authorize('admin', 'asm', 'rsm', 'nsm', 'so', 'se'), ctrl.getMine);
router.get('/report', authorize('admin', 'rsm', 'asm', 'se'), ctrl.getReport);
router.get('/', authorize('admin', 'rsm', 'asm', 'se'), ctrl.getAll);
router.post('/', authorize('admin', 'rsm', 'asm', 'se'), ctrl.assign);
router.patch('/:id/start', authorize('asm', 'rsm', 'nsm', 'so', 'se'), ctrl.start);
router.post('/:id/gps-failure', authorize('asm', 'rsm', 'nsm', 'so', 'se'), visitCtrl.recordCheckInGpsFailure);
router.patch('/:id/resolve-review', authorize('admin', 'asm'), ctrl.resolveCheckInReview);
router.patch('/:id', authorize('admin', 'rsm', 'asm', 'se'), ctrl.updateStatus);
router.delete('/:id', authorize('admin', 'rsm', 'asm', 'se'), ctrl.remove);

module.exports = router;
