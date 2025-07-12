// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Booking = require('../models/Booking');
const sendSMS = require('../utils/sendSMS');
require('dotenv').config();

// 🆕 PhonePe SDK Import
const { StandardCheckoutClient, StandardCheckoutPayRequest, Env } = require('pg-sdk-node');

// 🛠️ SDK Setup
const client = StandardCheckoutClient.getInstance(
  process.env.PHONEPE_CLIENT_ID,
  process.env.PHONEPE_CLIENT_SECRET,
  parseInt(process.env.PHONEPE_CLIENT_VERSION),
  Env.PRODUCTION // Change to Env.SANDBOX for testing
);

const tempBookingStore = {}; // For holding temporary booking data

// 🟢 INITIATE PhonePe Payment
router.post('/phonepe/initiate', async (req, res) => {
  const { amount, mobile, bookingData } = req.body;

  if (!amount || amount < 1 || !bookingData) {
    return res.status(400).json({ success: false, message: 'Invalid request' });
  }

  const merchantOrderId = uuidv4();

  try {
    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amount * 100)
      .redirectUrl(process.env.PHONEPE_REDIRECT_URL || 'https://itarsitaxi.in/payment-success')
      .build();

    const response = await client.pay(request);
    const redirectUrl = response.redirectUrl;

    // Store temporary booking for callback
    tempBookingStore[merchantOrderId] = bookingData;

    res.json({ success: true, redirectUrl });
  } catch (err) {
    console.error('❌ PhonePe SDK Error:', err);
    res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// 🟢 CALLBACK after PhonePe Payment
router.post('/phonepe/callback', async (req, res) => {
  const { transactionId, merchantOrderId, code } = req.body;

  console.log('📩 Callback received:', req.body);

  if (code !== 'PAYMENT_SUCCESS') {
    return res.redirect('/payment-failed');
  }

  const bookingData = tempBookingStore[merchantOrderId];
  if (!bookingData) {
    return res.status(400).send('⚠️ No booking data found for this transaction');
  }

  try {
    const newBooking = new Booking({
      ...bookingData,
      paymentStatus: 'Paid',
      transactionId,
    });

    await newBooking.save();

    const smsText = `Dear ${newBooking.name}, your prepaid booking is confirmed.\nFare: ₹${newBooking.totalFare}.\nThanks for choosing ItarsiTaxi.in!`;
    await sendSMS(newBooking.mobile, smsText);

    delete tempBookingStore[merchantOrderId];

    res.redirect(
      `/thank-you?name=${newBooking.name}&carType=${newBooking.carType}&fare=${newBooking.totalFare}`
    );
  } catch (err) {
    console.error('❌ DB Save Error:', err);
    res.status(500).send('Booking failed. Please contact support.');
  }
});

// 🟢 NEW: Cash on Arrival Booking Route
router.post('/cash-booking', async (req, res) => {
  const bookingData = req.body;

  if (!bookingData || !bookingData.name || !bookingData.mobile) {
    return res.status(400).json({ success: false, message: 'Invalid booking data' });
  }

  try {
    const newBooking = new Booking({
      ...bookingData,
      paymentStatus: 'Cash on Arrival',
    });

    await newBooking.save();

    const smsText = `Dear ${newBooking.name}, your booking is confirmed (Cash on Arrival).\nFare: ₹${newBooking.totalFare}.\nThanks for choosing ItarsiTaxi.in!`;
    await sendSMS(newBooking.mobile, smsText);

    res.status(200).json({ success: true, message: 'Booking confirmed', bookingId: newBooking._id });
  } catch (error) {
    console.error('❌ Cash Booking Error:', error);
    res.status(500).json({ success: false, message: 'Booking failed' });
  }
});

module.exports = router;

