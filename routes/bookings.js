// routes/bookings.js
const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');

router.post('/', async (req, res) => {
  try {
    const {
      name,
      mobile,
      email,
      paymentMode,
      carType,
      distance,
      totalFare,
      pickupDate,
      pickupTime,
      dropLocation,
      tripType,
      duration,
    } = req.body;

    // Log the incoming payload
    console.log('Incoming Booking:', req.body);

    // Minimal required fields validation
    if (!name || !mobile || !paymentMode || !carType || !distance || !totalFare) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const booking = new Booking({
      name,
      mobile,
      email: email || '',
      paymentMode,
      carType,
      distance,
      totalFare,
      pickupDate: pickupDate || '',
      pickupTime: pickupTime || '',
      dropLocation: dropLocation || '',
      tripType: tripType || '',
      duration: duration || '',
    });

    // Save to database
    const saved = await booking.save();

    console.log('Booking saved:', saved);

    res.status(200).json({
      success: true,
      message: 'Booking created successfully',
      bookingId: saved._id,
    });
  } catch (err) {
    console.error('❌ Error in POST /api/bookings:', err.message);
    res.status(500).json({
      success: false,
      message: 'Booking failed',
    });
  }
});

module.exports = router;

