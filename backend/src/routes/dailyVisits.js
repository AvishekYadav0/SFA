const router = require('express').Router();
const { protect, authorizeAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/dailyVisitController');

router.use(protect);

router.get('/mine',    ctrl.getMine);           // staff: my shops today
router.get('/',        authorizeAdmin, ctrl.getAll);    // admin: all assignments
router.post('/',       authorizeAdmin, ctrl.assign);    // admin: assign dealers
router.patch('/:id',   ctrl.updateStatus);              // staff/admin: mark visited
router.delete('/:id',  authorizeAdmin, ctrl.remove);    // admin: remove assignment

module.exports = router;
