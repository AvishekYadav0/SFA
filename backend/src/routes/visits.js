const router = require('express').Router();
const { getAll, getOne, create, checkOut, update, remove, getStats } = require('../controllers/visitController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/stats', getStats);
router.get('/',      getAll);
router.get('/:id',   getOne);
router.post('/',     create);
router.patch('/:id/checkout', checkOut);
router.put('/:id',   update);
router.delete('/:id', remove);

module.exports = router;
