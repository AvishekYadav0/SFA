// auth.js
const express = require('express');
const r = express.Router();
const c = require('../controllers/authController');
const { protect } = require('../middleware/auth');
r.get('/check-admin', c.checkAdmin);
r.post('/login', c.login);
r.get('/me', protect, c.getMe);
r.put('/change-password', protect, c.changePassword);
module.exports = r;
