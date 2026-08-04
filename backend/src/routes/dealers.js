const router = require('express').Router();
const c = require('../controllers/dealerController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/my-profile', c.getMyProfile);
router.route('/').get(c.getAll).post(authorize('admin', 'se', 'asm', 'rsm', 'nsm'), c.create);
router.route('/:id').get(c.getOne).put(authorize('admin', 'se', 'asm', 'rsm', 'nsm'), c.update).delete(authorize('admin'), c.remove);
router.post('/:id/link-user', authorize('admin'), c.linkUser);

module.exports = router;
