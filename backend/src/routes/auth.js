const router = require('express').Router();
const {
  registerAdmin, checkAdmin, login, getMe, updateProfile, changePassword
} = require('../controllers/authController');
const { authenticateUser } = require('../middleware/auth');

router.get('/check-admin', checkAdmin);
router.post('/register-admin', registerAdmin);
router.post('/login', login);
router.get('/me', authenticateUser, getMe);
router.put('/profile', authenticateUser, updateProfile);
router.put('/change-password', authenticateUser, changePassword);

module.exports = router;
