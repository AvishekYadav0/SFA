const router = require('express').Router();
const { getAll, markRead, create, deleteOne } = require('../controllers/notificationController');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);
router.get('/',           getAll);
router.post('/',          create);
router.patch('/:id/read', markRead);
router.delete('/:id',     deleteOne);

module.exports = router;
