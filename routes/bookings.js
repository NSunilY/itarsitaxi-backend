const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const sendSMS = require('../utils/sendSMS');

const ADMIN_MOBILE = process.env.ADMIN_PHONE;

router.post('/', async (req, res) => {
  const {
    name,
    mobile,
    carType,
    distance,
    totalFare,
    tollCount,
    pickupDate,
    pickupTime
  } = req.body;

  try {
    // Save full booking to DB
    const booking = new Booking(req.body);
    await booking.save();

    // Short SMS messages
    const messageToCustomer = `Booking confirmed with ItarsiTaxi on ${pickupDate} at ${pickupTime}. Fare: ₹${totalFare}. Thank you!`;
    const messageToAdmin = `Booking received: ${name} (${mobile}), ${pickupDate} at ${pickupTime}`;

    // Send SMS
    await sendSMS(mobile, messageToCustomer);
    await sendSMS(ADMIN_MOBILE, messageToAdmin);

    res.json({ success: true, bookingId: booking._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Booking failed' });
  }
});

module.exports = router;

