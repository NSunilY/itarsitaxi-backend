const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking'); // adjust path based on your structure
const sendSMS = require('../utils/sendSMS');

// Replace with your admin number
const ADMIN_MOBILE = process.env.ADMIN_PHONE;

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

// Short and informative messages
const messageToCustomer = `Booking confirmed with ItarsiTaxi on ${pickupDate} at ${pickupTime}. Fare: ₹${totalFare}. Thank you!`;

const messageToAdmin = `Booking received: ${name} (${mobile}), ${pickupDate} at ${pickupTime}`;

    // Send SMS to both customer and admin
await sendSMS(mobile, messageToCustomer);
await sendSMS(ADMIN_MOBILE, messageToAdmin);
    res.json({ success: true, bookingId: booking._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Booking failed' });
  }
});

module.exports = router;

