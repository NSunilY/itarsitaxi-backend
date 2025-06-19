// routes/admin.js
const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking'); // adjust path if needed

// GET all bookings and summary
router.get('/bookings', async (req, res) => {
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

// ✅ PUT /api/admin/bookings/:id/complete
router.put('/bookings/:id/complete', async (req, res) => {
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
// DELETE /api/admin/bookings/:id
router.delete('/bookings/:id', async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting booking:', err);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

module.exports = router;

