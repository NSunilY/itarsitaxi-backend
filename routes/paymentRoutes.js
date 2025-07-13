// routes/paymentRoutes.js (Stable & Fixed Version with Admin SMS & Booking ID)
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Booking = require('../models/Booking');
const sendSMS = require('../utils/sendSMS');
require('dotenv').config();

// ✅ Admin number
const ADMIN_MOBILE = '9876543210'; // Replace with your actual admin number

// 🆕 PhonePe SDK Import
const {
  StandardCheckoutClient,
  StandardCheckoutPayRequest,
  Env,
} = require('pg-sdk-node');

// 🛠️ SDK Setup
const client = StandardCheckoutClient.getInstance(
  process.env.PHONEPE_CLIENT_ID,
  process.env.PHONEPE_CLIENT_SECRET,
  parseInt(process.env.PHONEPE_CLIENT_VERSION),
  Env.PRODUCTION
);

// 🟢 Initiate Payment
router.post('/phonepe/initiate', async (req, res) => {
  const { amount, mobile, bookingData } = req.body;

  if (!amount || amount < 1 || !bookingData) {
    return res.status(400).json({ success: false, message: 'Invalid request' });
  }

  const merchantOrderId = uuidv4();

  try {
    const tempBooking = new Booking({
      ...bookingData,
      paymentStatus: 'Pending',
      transactionId: merchantOrderId,
    });
    await tempBooking.save();

    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amount * 100)
      .redirectUrl(process.env.PHONEPE_REDIRECT_URL || 'https://itarsitaxi.in/payment-success')
      .build();

    const response = await client.pay(request);
    const redirectUrl = response.redirectUrl;

    res.json({ success: true, redirectUrl });
  } catch (err) {
    console.error('❌ PhonePe SDK Error:', err);
    res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// 🟢 Callback Handling (Prepaid)
router.post('/phonepe/callback', async (req, res) => {
  console.log('📩 Callback hit! Raw Body:', req.body);
  const { transactionId, merchantOrderId, code } = req.body;

  if (code !== 'PAYMENT_SUCCESS') {
    return res.redirect('/payment-failed');
  }

  try {
    const booking = await Booking.findOne({ transactionId: merchantOrderId });

    if (!booking) {
      return res.status(400).send('⚠️ No booking found for this transaction');
    }

    booking.paymentStatus = 'Paid';
    await booking.save();

    const smsToCustomer = `Dear ${booking.name}, your prepaid booking is confirmed.\nFare: ₹${booking.totalFare}.\nThanks for choosing ItarsiTaxi.in!`;
    const smsToAdmin = `✅ Prepaid Booking: ${booking.name}, ${booking.mobile}, ${booking.carType}, ₹${booking.totalFare}`;

    await sendSMS(booking.mobile, smsToCustomer);
    await sendSMS(ADMIN_MOBILE, smsToAdmin);

    console.log(`✅ Booking confirmed & saved: ID ${booking._id}`);

    res.redirect(
      `/thank-you?name=${booking.name}&carType=${booking.carType}&fare=${booking.totalFare}&bookingId=${booking._id}`
    );
  } catch (err) {
    console.error('❌ Callback Processing Error:', err);
    res.status(500).send('Booking failed. Please contact support.');
  }
});

// 🟢 Cash on Arrival Booking
router.post('/cash-booking', async (req, res) => {
  try {
    const bookingData = req.body;
    const newBooking = new Booking({
      ...bookingData,
      paymentStatus: 'Cash on Arrival',
    });

    await newBooking.save();

    const smsToCustomer = `Dear ${newBooking.name}, your booking is confirmed.\nFare: ₹${newBooking.totalFare}.\nPlease pay in cash to the driver.\nThanks - ItarsiTaxi.in`;
    const smsToAdmin = `🟡 COD Booking: ${newBooking.name}, ${newBooking.mobile}, ${newBooking.carType}, ₹${newBooking.totalFare}`;

    await sendSMS(newBooking.mobile, smsToCustomer);
    await sendSMS(ADMIN_MOBILE, smsToAdmin);

    res.json({ success: true, bookingId: newBooking._id });
  } catch (err) {
    console.error('❌ Cash Booking Error:', err);
    res.status(500).json({ success: false, message: 'Booking failed' });
  }
});

module.exports = router;

