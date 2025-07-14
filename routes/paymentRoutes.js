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

// ✅ PhonePe SDK Client (v2.0.2)
const client = StandardCheckoutClient.getInstance(
  process.env.PHONEPE_CLIENT_ID,
  process.env.PHONEPE_CLIENT_SECRET,
  parseInt(process.env.PHONEPE_CLIENT_VERSION),
  Env.PRODUCTION
);

// ✅ INITIATE PAYMENT
router.post('/phonepe/initiate', async (req, res) => {
  try {
    const { amount, bookingData } = req.body;
    if (!amount || !bookingData) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    const merchantOrderId = uuidv4();

    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amount * 100)
      .redirectUrl(`${process.env.PHONEPE_CALLBACK_URL}?txnId=${merchantOrderId}`)
      .build();

    const response = await client.pay(request);
    const redirectUrl = response.redirectUrl;

    req.app.locals.tempBookings = req.app.locals.tempBookings || {};
    req.app.locals.tempBookings[merchantOrderId] = {
      ...bookingData,
      advanceAmount: amount,
    };

    return res.json({ success: true, redirectUrl });
  } catch (err) {
    console.error('❌ Payment initiation error:', err);
    return res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// ✅ HANDLE PhonePe REDIRECT
router.get('/phonepe/callback', async (req, res) => {
  const merchantOrderId = req.query.txnId;

  console.log('📩 [GET] PhonePe redirect received — txnId:', merchantOrderId);

  if (!merchantOrderId) {
    console.warn('⚠️ Missing txnId in query — treating as failure');
    return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
  }

  try {
const statusRes = await client.status(merchantOrderId);
    const result = statusRes.data;

    console.log('📦 [GET] Payment status result:', result);

    if (result.success && result.code === 'PAYMENT_SUCCESS') {
      const tempBookingData = req.app.locals.tempBookings?.[merchantOrderId];

      if (!tempBookingData) {
        console.error('❌ [GET] No temp booking data found for txnId:', merchantOrderId);
        return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
      }

      const booking = new Booking({
        ...tempBookingData,
        paymentStatus: 'Paid',
        transactionId: merchantOrderId,
      });

      await booking.save();

      console.log(`✅ [GET] Booking saved: ${booking._id}`);

      // 🔔 SMS to customer
      const customerSMS = `Dear ${booking.name}, your prepaid booking is confirmed.\nAdvance Paid: ₹${booking.advanceAmount}\nTotal Fare: ₹${booking.totalFare}.\nThanks - ItarsiTaxi.in`;
      await sendSMS(booking.mobile, customerSMS);

      // 🔔 SMS to admin
      const adminSMS = `🆕 Prepaid Booking:\nName: ${booking.name}\nMobile: ${booking.mobile}\nCar: ${booking.carType}\nFare: ₹${booking.totalFare}\nAdvance: ₹${booking.advanceAmount}`;
      await sendSMS('7000771918', adminSMS);

      return res.redirect(
        `${process.env.PHONEPE_REDIRECT_URL}/payment-success?bookingId=${booking._id}&name=${encodeURIComponent(
          booking.name
        )}&carType=${encodeURIComponent(booking.carType)}&distance=${booking.distance}&fare=${booking.totalFare}`
      );
    } else {
      console.warn('❌ [GET] Payment not successful:', result);
      return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
    }
  } catch (err) {
    console.error('❌ Callback error:', err.response?.data || err.message);
    return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
  }
});

// ✅ CASH ON ARRIVAL BOOKING
router.post('/cash-booking', async (req, res) => {
  try {
    const bookingData = req.body;

    const newBooking = new Booking({
      ...bookingData,
      paymentStatus: 'Cash on Arrival',
    });

    await newBooking.save();

    const smsText = `Dear ${newBooking.name}, your booking is confirmed.\nFare: ₹${newBooking.totalFare}.\nPlease pay in cash to the driver.\nThanks - ItarsiTaxi.in`;
    const adminSMS = `🆕 COD Booking:\nName: ${newBooking.name}\nMobile: ${newBooking.mobile}\nCar: ${newBooking.carType}\nFare: ₹${newBooking.totalFare}`;

    await sendSMS(newBooking.mobile, smsText);
    await sendSMS('7000771918', adminSMS);

    res.json({ success: true, message: 'Booking successful', bookingId: newBooking._id });
  } catch (err) {
    console.error('❌ Cash Booking Error:', err);
    res.status(500).json({ success: false, message: 'Booking failed' });
  }
});

module.exports = router;

