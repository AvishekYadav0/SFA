const router = require('express').Router();
const {
  getUsers, getUser, createStaff, updateUser, deleteUser, toggleStatus, resetPassword
} = require('../controllers/userController');
const { authenticateUser, authorizeAdmin } = require('../middleware/auth');

router.use(authenticateUser, authorizeAdmin);

router.get('/', getUsers);
router.post('/create-staff', createStaff);
router.get('/:id', getUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.patch('/:id/status', toggleStatus);
router.patch('/:id/reset-password', resetPassword);

module.exports = router;
