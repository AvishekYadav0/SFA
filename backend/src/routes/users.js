const router = require('express').Router();
const {
  getUsers, getUser, createStaff, updateUser, deleteUser, toggleStatus, resetPassword
} = require('../controllers/userController');
const { authenticateUser, authorize } = require('../middleware/auth');

// All routes require login
router.use(authenticateUser);

// Read: any logged-in role can call GET / (scoped in controller)
router.get('/', getUsers);
router.get('/:id', getUser);

// Write: admin, nsm, rsm, asm can manage users below them
const canManage = authorize('admin', 'nsm', 'rsm', 'asm');
router.post('/create-staff', canManage, createStaff);
router.put('/:id', canManage, updateUser);
router.delete('/:id', canManage, deleteUser);
router.patch('/:id/status', canManage, toggleStatus);
router.patch('/:id/reset-password', canManage, resetPassword);

module.exports = router;
