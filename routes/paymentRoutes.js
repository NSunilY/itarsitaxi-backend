// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Booking = require('../models/Booking');
const sendSMS = require('../utils/sendSMS');
require('dotenv').config();

// 📦 PhonePe SDK Imports
const {
  StandardCheckoutClient,
  StandardCheckoutPayRequest,
  Env
} = require('pg-sdk-node');

// 🌐 PhonePe Client Setup
const client = StandardCheckoutClient.getInstance(
  process.env.PHONEPE_CLIENT_ID,
  process.env.PHONEPE_CLIENT_SECRET,
  parseInt(process.env.PHONEPE_CLIENT_VERSION || '1'),
  process.env.PHONEPE_ENV === 'PRODUCTION' ? Env.PRODUCTION : Env.SANDBOX
);

const tempBookingStore = {}; // 🔒 In-memory booking storage before payment

// 🟢 INITIATE PAYMENT
router.post('/phonepe/initiate', async (req, res) => {
  const { amount, bookingData } = req.body;

  if (!amount || !bookingData) {
    return res.status(400).json({ success: false, message: 'Invalid request' });
  }

  const merchantOrderId = uuidv4(); // unique transaction ID
  const amountInPaise = amount * 100;

  try {
    // ✅ Safely build PhonePe request using SDK
    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amountInPaise)
      .redirectUrl(`${process.env.PHONEPE_REDIRECT_URL}?orderId=${merchantOrderId}`)
      .callbackUrl(process.env.PHONEPE_CALLBACK_URL)
      .build();

    const response = await client.pay(request);

    // 🔒 Save booking temporarily
    tempBookingStore[merchantOrderId] = bookingData;

    return res.json({
      success: true,
      redirectUrl: response.redirectUrl,
      orderId: merchantOrderId
    });
  } catch (err) {
    console.error('❌ PhonePe SDK Error:', err);
    return res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// 🟣 CALLBACK HANDLER
router.post('/phonepe/callback', async (req, res) => {
  const { transactionId, merchantOrderId, code } = req.body;

  console.log('📩 PhonePe callback received:', req.body);

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
      transactionId,
      paymentStatus: 'Paid'
    });

    await newBooking.save();

    const smsText = `Dear ${newBooking.name}, your prepaid booking is confirmed.\nFare: ₹${newBooking.totalFare}.\nThanks for choosing ItarsiTaxi.in!`;
    await sendSMS(newBooking.mobile, smsText);

    // Clean up memory
    delete tempBookingStore[merchantOrderId];

    return res.redirect(
      `/thank-you?name=${newBooking.name}&carType=${newBooking.carType}&fare=${newBooking.totalFare}`
    );
  } catch (err) {
    console.error('❌ Error saving booking:', err);
    return res.status(500).send('Booking failed. Please contact support.');
  }
});

// 🟢 CASH BOOKING HANDLER
router.post('/cash-booking', async (req, res) => {
  const bookingData = req.body;

  if (!bookingData) {
    return res.status(400).json({ success: false, message: 'Invalid booking data' });
  }

  try {
    const newBooking = new Booking({
      ...bookingData,
      paymentStatus: 'Cash on Arrival'
    });

    await newBooking.save();

    const smsText = `Dear ${newBooking.name}, your booking is confirmed (Cash on Arrival).\nFare: ₹${newBooking.totalFare}.\nThanks for choosing ItarsiTaxi.in!`;
    await sendSMS(newBooking.mobile, smsText);

    return res.status(200).json({ success: true, message: 'Booking confirmed' });
  } catch (err) {
    console.error('❌ Cash booking error:', err);
    return res.status(500).json({ success: false, message: 'Booking failed' });
  }
});

module.exports = router;

