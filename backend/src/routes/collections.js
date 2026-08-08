const router = require('express').Router();
const c = require('../controllers/collectionController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.route('/')
  .get(c.getAll)
  .post(authorize('admin', 'nsm', 'rsm', 'asm', 'se', 'so'), c.create);
router.route('/:id')
  .get(c.getOne)
  .put(authorize('admin', 'nsm', 'rsm', 'asm', 'se', 'so'), c.update)
  .delete(authorize('admin', 'nsm'), c.remove);

module.exports = router;
