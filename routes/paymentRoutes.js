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

const client = StandardCheckoutClient.getInstance(
  process.env.PHONEPE_CLIENT_ID,
  process.env.PHONEPE_CLIENT_SECRET,
  parseInt(process.env.PHONEPE_CLIENT_VERSION),
  Env.PRODUCTION
);

// 🟢 INITIATE PAYMENT — NO BOOKING CREATED YET
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
      .redirectUrl(
        `${process.env.PHONEPE_REDIRECT_URL}?merchantOrderId=${merchantOrderId}&data=${encodeURIComponent(JSON.stringify(bookingData))}&advance=${amount}`
      )
      .build();

    const response = await client.pay(request);
    const redirectUrl = response.redirectUrl;

    res.json({ success: true, redirectUrl });
  } catch (err) {
    console.error('❌ PhonePe SDK Error:', err);
    res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// ✅ CALLBACK — CREATE BOOKING ONLY ON PAYMENT SUCCESS
router.post('/phonepe/callback', async (req, res) => {
  console.log('📩 Callback hit:', req.body);

  const { merchantOrderId } = req.body;

  try {
    const statusRes = await client.status(merchantOrderId);
    const result = statusRes.data;

    if (result.success && result.code === 'PAYMENT_SUCCESS') {
      // Read query params from redirect URL
      const rawUrl = req.headers.referer || '';
      const url = new URL(rawUrl);
      const bookingData = JSON.parse(decodeURIComponent(url.searchParams.get('data')));
      const advanceAmount = parseInt(url.searchParams.get('advance')) || 0;

      const newBooking = new Booking({
        ...bookingData,
        paymentStatus: 'Paid',
        transactionId: merchantOrderId,
        advanceAmount,
      });

      await newBooking.save();

      // 🔔 SMS to customer
      const customerSMS = `Dear ${newBooking.name}, your prepaid booking is confirmed.\nAdvance Paid: ₹${newBooking.advanceAmount}\nTotal Fare: ₹${newBooking.totalFare}.\nThanks - ItarsiTaxi.in`;
      await sendSMS(newBooking.mobile, customerSMS);

      // 🔔 SMS to admin
      const adminSMS = `🆕 Prepaid Booking:\nName: ${newBooking.name}\nMobile: ${newBooking.mobile}\nCar: ${newBooking.carType}\nFare: ₹${newBooking.totalFare}\nAdvance: ₹${newBooking.advanceAmount}`;
      await sendSMS('7000771918', adminSMS);

      return res.redirect(
        `${process.env.PHONEPE_REDIRECT_URL}?bookingId=${newBooking._id}&name=${encodeURIComponent(
          newBooking.name
        )}&carType=${encodeURIComponent(newBooking.carType)}&fare=${newBooking.totalFare}&distance=${newBooking.distance}`
      );
    } else {
      console.warn('❌ Payment failed:', result);
      return res.redirect('/payment-failed');
    }
  } catch (err) {
    console.error('❌ Callback error:', err.response?.data || err.message);
    return res.redirect('/payment-failed');
  }
});

// ✅ CASH ON ARRIVAL BOOKING (no change here)
router.post('/cash-booking', async (req, res) => {
  try {
    const bookingData = req.body;

    const newBooking = new Booking({
      ...bookingData,
      paymentStatus: 'Cash on Arrival',
    });

    await newBooking.save();

    // 🔔 SMS to customer
    const smsText = `Dear ${newBooking.name}, your booking is confirmed.\nFare: ₹${newBooking.totalFare}.\nPlease pay in cash to the driver.\nThanks - ItarsiTaxi.in`;
    await sendSMS(newBooking.mobile, smsText);

    // 🔔 SMS to admin
    const adminSMS = `🆕 COD Booking:\nName: ${newBooking.name}\nMobile: ${newBooking.mobile}\nCar: ${newBooking.carType}\nFare: ₹${newBooking.totalFare}`;
    await sendSMS('7000771918', adminSMS);

    res.json({ success: true, message: 'Booking successful', bookingId: newBooking._id });
  } catch (err) {
    console.error('❌ Cash Booking Error:', err);
    res.status(500).json({ success: false, message: 'Booking failed' });
  }
});

module.exports = router;

