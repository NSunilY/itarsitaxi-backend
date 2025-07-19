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

const pickupShort = req.body.pickupLocation?.split(',')[0] || 'Unknown';
const dropShort = req.body.dropLocation?.split(',')[0] || 'Unknown';
const carTypeShort = carType?.split('–')[0].trim() || carType;
const pickupDate = req.body.pickupDate;
const pickupTime = req.body.pickupTime;

const messageToCustomer = `Booking confirmed: ${pickupShort} to ${dropShort}, ${pickupDate} ${pickupTime}. Car: ${carTypeShort}, Fare: ₹${totalFare}. ItarsiTaxi.in`;

const messageToAdmin = `New booking by ${name} (${mobile}): ${pickupShort} to ${dropShort} on ${pickupDate} ${pickupTime}, ${carTypeShort}, ₹${totalFare}`;

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

