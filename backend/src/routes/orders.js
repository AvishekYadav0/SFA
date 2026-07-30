const router = require('express').Router();
const c = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Get all orders with filtering
router.get('/', c.getAll);

// Create a new order
router.post('/', authorize('admin', 'staff'), c.create);

// Get single order
router.get('/:id', c.getOne);

// Update an order
router.put('/:id', authorize('admin', 'staff'), c.update);

// Delete an order (admin only)
router.delete('/:id', authorize('admin'), c.remove);

// Admin review actions (edit items, remarks, approve/reject/hold)
router.patch('/:id/review', authorize('admin'), c.review);

// Update order status (admin only)
router.patch('/:id/status', authorize('admin'), c.updateStatus);

// Staff can also mark delivered
router.patch('/:id/deliver', authorize('admin', 'staff'), async (req, res) => {
  const Order = require('../models/Order');
  try {
    const data = await Order.findByIdAndUpdate(req.params.id, { status: 'delivered', deliveredAt: new Date() }, { new: true });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
