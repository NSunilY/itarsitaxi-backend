const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking'); // adjust path based on your structure
const sendSMS = require('../utils/sendSMS');

// Replace with your admin number
const ADMIN_MOBILE = '9876543210';

router.post('/', async (req, res) => {
  const {
    name,
    mobile,
    carType,
    distance,
    totalFare,
    tollCount,
  } = req.body;

  try {
    const booking = new Booking(req.body);
    await booking.save();

    const messageToCustomer = `Dear ${name}, your ItarsiTaxi booking for ${carType} (${distance} km) is confirmed. Fare: ₹${totalFare}. Thank you!`;
    const messageToAdmin = `New Booking: ${name} - ${mobile}, ${carType}, ${distance} km, ₹${totalFare}.`;

    // Send SMS to both customer and admin
    await sendSMS(messageToCustomer, mobile);
    await sendSMS(messageToAdmin, ADMIN_MOBILE);

    res.json({ success: true, bookingId: booking._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Booking failed' });
  }
});

module.exports = router;

