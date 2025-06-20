// routes/admin.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Booking = require('../models/Booking');

// ✅ Admin Login Route
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });
    return res.json({ token });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

// ✅ JWT Middleware
const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') throw new Error();
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

// ✅ GET /api/admin/bookings (protected)
router.get('/bookings', verifyAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });

    const today = new Date().toISOString().split('T')[0];
    const todayBookings = bookings.filter(b => b.createdAt.toISOString().startsWith(today));
    const revenue = bookings.reduce((sum, b) => sum + (b.totalFare || 0), 0);

    const byCarType = ['Hatchback', 'Sedan', 'MUV', 'SUV'].map((type) => ({
      type,
      count: bookings.filter(b => b.carType?.toLowerCase().includes(type.toLowerCase())).length
    }));

    res.json({
      bookings,
      summary: {
        total: bookings.length,
        today: todayBookings.length,
        revenue,
        byCarType
      }
    });
  } catch (err) {
    console.error('Error fetching admin data:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ✅ PUT /api/admin/bookings/:id/complete (protected)
router.put('/bookings/:id/complete', verifyAdmin, async (req, res) => {
  try {
    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: 'completed' },
      { new: true }
    );
    res.json({ success: true, updated });
  } catch (err) {
    console.error('Error marking booking as completed:', err);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

// ✅ DELETE /api/admin/bookings/:id (protected)
router.delete('/bookings/:id', verifyAdmin, async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting booking:', err);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

module.exports = router;

