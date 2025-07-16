// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Booking = require('../models/Booking');
const sendSMS = require('../utils/sendSMS');
require('dotenv').config();

const {
  StandardCheckoutClient,
  StandardCheckoutPayRequest,
  Env,
} = require('pg-sdk-node');

// Initialize PhonePe SDK Client
const client = StandardCheckoutClient.getInstance(
  process.env.PHONEPE_CLIENT_ID,
  process.env.PHONEPE_CLIENT_SECRET,
  parseInt(process.env.PHONEPE_CLIENT_VERSION),
  process.env.PHONEPE_ENV === 'PRODUCTION' ? Env.PRODUCTION : Env.SANDBOX
);

const tempBookingStore = {};

// ✅ Initiate Payment
router.post('/phonepe/initiate', async (req, res) => {
  const { amount, bookingData } = req.body;
  if (!amount || !bookingData) {
    return res.status(400).json({ success: false, message: 'Invalid request' });
  }

  const merchantOrderId = uuidv4();

  try {
    const redirectUrlWithOrder = `${process.env.PHONEPE_REDIRECT_URL}?merchantOrderId=${merchantOrderId}`;

    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amount * 100)
      .redirectUrl(redirectUrlWithOrder)
      .build({
        callbackUrl: process.env.PHONEPE_CALLBACK_URL,
      });

    const response = await client.pay(request);

    // Temporarily store booking data
    tempBookingStore[merchantOrderId] = bookingData;

    res.json({
      success: true,
      redirectUrl: response.redirectUrl,
    });
  } catch (err) {
    console.error('❌ PhonePe SDK Error:', err);
    res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// ✅ USER REDIRECT HANDLER
router.get('/phonepe/callback', (req, res) => {
  const merchantOrderId = req.query.merchantOrderId;
  return res.redirect(`/payment-status?merchantOrderId=${merchantOrderId}`);
});

// ✅ WEBHOOK HANDLER
router.post('/phonepe/callback', async (req, res) => {
  console.log('📩 PhonePe callback received:', req.body);

  const { payload } = req.body;
  const merchantOrderId = payload.merchantOrderId;
  const transactionId = payload.paymentDetails?.[0]?.transactionId || '';

  if (payload.state !== 'COMPLETED') {
    return res.redirect('/payment-failed');
  }

  const bookingData = tempBookingStore[merchantOrderId];
  if (!bookingData) {
    return res.status(400).send('⚠️ No booking data found for this transaction');
  }

  try {
    const newBooking = new Booking({
      ...bookingData,
      paymentStatus: 'Success',
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

module.exports = router;

