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

// 🔧 Setup PhonePe client
const client = StandardCheckoutClient.getInstance(
  process.env.PHONEPE_CLIENT_ID,
  process.env.PHONEPE_CLIENT_SECRET,
  parseInt(process.env.PHONEPE_CLIENT_VERSION),
  process.env.PHONEPE_ENV === 'PRODUCTION' ? Env.PRODUCTION : Env.SANDBOX
);

const tempBookingStore = {}; // memory store for booking data

// ✅ INITIATE PAYMENT
router.post('/phonepe/initiate', async (req, res) => {
  const { amount, mobile, bookingData } = req.body;

  if (!amount || !bookingData || !mobile) {
    return res.status(400).json({ success: false, message: 'Invalid request' });
  }

  const merchantOrderId = uuidv4();

  try {
    const request = new StandardCheckoutPayRequest({
      merchantId: process.env.PHONEPE_MERCHANT_ID,
      merchantTransactionId: merchantOrderId,
      merchantUserId: `user_${mobile}`,
      amount: amount * 100, // in paise
      redirectMode: 'REDIRECT',
      redirectUrl: `${process.env.PHONEPE_REDIRECT_URL}?orderId=${merchantOrderId}`,
      callbackUrl: process.env.PHONEPE_CALLBACK_URL,
      paymentInstrument: {
        type: 'PAY_PAGE',
      },
    });

    const response = await client.pay(request);
    tempBookingStore[merchantOrderId] = bookingData;

    res.json({ success: true, redirectUrl: response.instrumentResponse.redirectInfo.url });
  } catch (err) {
    console.error('❌ PhonePe SDK Error:', err);
    res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// ✅ CALLBACK (POST)
router.post('/phonepe/callback', async (req, res) => {
  const { transactionId, merchantOrderId, code } = req.body;

  console.log('📩 PhonePe Callback:', req.body);

  if (code !== 'PAYMENT_SUCCESS') {
    return res.redirect('/payment-failed');
  }

  const bookingData = tempBookingStore[merchantOrderId];
  if (!bookingData) {
    return res.status(400).send('❌ Booking not found for this transaction');
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

// ✅ CASH ON ARRIVAL
router.post('/cash-booking', async (req, res) => {
  const bookingData = req.body;

  if (!bookingData) {
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

    res.status(200).json({ success: true, bookingId: newBooking._id });
  } catch (err) {
    console.error('❌ Cash Booking Error:', err);
    res.status(500).json({ success: false, message: 'Booking failed' });
  }
});

module.exports = router;

