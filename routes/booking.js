// routes/booking.js
const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');

router.post('/bookings', async (req, res) => {
  try {
    const newBooking = new Booking(req.body);
    await newBooking.save();
    res.status(201).json({ success: true, bookingId: newBooking._id });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ success: false, message: 'Booking failed' });
  }
});

module.exports = router;

