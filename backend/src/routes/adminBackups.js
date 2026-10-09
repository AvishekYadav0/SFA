const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const controller = require('../controllers/adminBackupController');

const router = express.Router();

router.use(protect, authorize('admin'));
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id/archive', controller.downloadArchive);
router.get('/:id/download', controller.download);
router.delete('/:id', controller.remove);

module.exports = router;
