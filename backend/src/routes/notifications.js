const router = require('express').Router();
const { getAll, markRead, create, deleteOne } = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/',           getAll);
router.post('/',          create);
router.patch('/:id/read', markRead);
router.delete('/:id',     deleteOne);

module.exports = router;
