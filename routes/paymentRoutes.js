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

// 🔧 Initialize PhonePe SDK Client
const client = StandardCheckoutClient.getInstance(
  process.env.PHONEPE_CLIENT_ID,
  process.env.PHONEPE_CLIENT_SECRET,
  parseInt(process.env.PHONEPE_CLIENT_VERSION),
  process.env.PHONEPE_ENV === 'PRODUCTION' ? Env.PRODUCTION : Env.SANDBOX
);

const tempBookingStore = {}; // Holds booking data until payment callback

// ✅ Initiate PhonePe Payment
router.post('/phonepe/initiate', async (req, res) => {
  const { amount, bookingData } = req.body;

  if (!amount || !bookingData) {
    return res.status(400).json({ success: false, message: 'Invalid request' });
  }

  const merchantOrderId = uuidv4();

  try {
    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amount * 100)
      .redirectUrl(process.env.PHONEPE_REDIRECT_URL)
      .build({
        callbackUrl: process.env.PHONEPE_CALLBACK_URL
      });

    const response = await client.pay(request);

    // Store booking data temporarily
    tempBookingStore[merchantOrderId] = bookingData;

    res.json({
      success: true,
      redirectUrl: response.redirectUrl
    });

  } catch (err) {
    console.error('❌ PhonePe SDK Error:', err);
    res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// ✅ USER REDIRECT HANDLER (no verification here)
router.get('/phonepe/callback', (req, res) => {
  return res.redirect('/payment-status'); // simple UI, logic handled elsewhere
});

// ✅ WEBHOOK HANDLER — from PhonePe servers
router.post('/phonepe/webhook', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const bodyStr = JSON.stringify(req.body);

    const callback = client.validateCallback(
      process.env.PHONEPE_CLIENT_ID,
      process.env.PHONEPE_CLIENT_SECRET,
      authHeader,
      bodyStr
    );

    const { orderId, state, transactionId } = callback.payload;

    const bookingData = tempBookingStore[orderId];
    if (!bookingData) {
      console.warn('⚠️ Booking data not found for orderId:', orderId);
      return res.sendStatus(400);
    }

    if (state === 'COMPLETED') {
      const newBooking = new Booking({
        ...bookingData,
        paymentStatus: 'Paid',
        transactionId,
      });

      await newBooking.save();

      await sendSMS(
        newBooking.mobile,
        `Dear ${newBooking.name}, your prepaid booking is confirmed.\nFare: ₹${newBooking.totalFare}.\nThanks for choosing ItarsiTaxi.in!`
      );

      delete tempBookingStore[orderId];
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error('❌ Webhook callback error:', err);
    return res.sendStatus(400);
  }
});
module.exports = router;

