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

// ✅ PhonePe client setup
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
      .redirectUrl(`${process.env.PHONEPE_CALLBACK_URL}?txnId=${merchantOrderId}`) // ✅ redirect to /payment/callback
      .build();

    const response = await client.pay(request);
    const redirectUrl = response.redirectUrl;

    // ✅ Temporarily store bookingData in memory or DB with txnId (optional)
    // We'll use callback to save it properly after success

    // Store basic details in memory (not saved until success)
    req.app.locals.tempBookings = req.app.locals.tempBookings || {};
    req.app.locals.tempBookings[merchantOrderId] = { ...bookingData, advanceAmount: amount };

    return res.json({ success: true, redirectUrl });
  } catch (err) {
    console.error('❌ Payment initiation error:', err);
    return res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// ✅ CALLBACK AFTER PAYMENT
router.post('/phonepe/callback', async (req, res) => {
  const { merchantOrderId } = req.body;

  console.log('📩 Callback received for txnId:', merchantOrderId);

  try {
    const statusRes = await client.status(merchantOrderId);
    const result = statusRes.data;

    if (result.success && result.code === 'PAYMENT_SUCCESS') {
      // Retrieve stored booking data
      const tempBookingData = req.app.locals.tempBookings?.[merchantOrderId];

      if (!tempBookingData) {
        console.error('❌ No booking data found for:', merchantOrderId);
        return res.redirect('/payment-failed');
      }

      // Save final booking
      const booking = new Booking({
        ...tempBookingData,
        paymentStatus: 'Paid',
        transactionId: merchantOrderId,
      });

      await booking.save();

      console.log(`✅ Booking saved: ${booking._id}`);

      // 🔔 SMS to customer
      const customerSMS = `Dear ${booking.name}, your prepaid booking is confirmed.\nAdvance Paid: ₹${booking.advanceAmount}\nTotal Fare: ₹${booking.totalFare}.\nThanks - ItarsiTaxi.in`;
      await sendSMS(booking.mobile, customerSMS);

      // 🔔 SMS to admin
      const adminSMS = `🆕 Prepaid Booking:\nName: ${booking.name}\nMobile: ${booking.mobile}\nCar: ${booking.carType}\nFare: ₹${booking.totalFare}\nAdvance: ₹${booking.advanceAmount}`;
      await sendSMS('7000771918', adminSMS);

      // ✅ Redirect to payment-success
      return res.redirect(
        `${process.env.PHONEPE_REDIRECT_URL}?bookingId=${booking._id}&name=${encodeURIComponent(
          booking.name
        )}&carType=${encodeURIComponent(booking.carType)}&distance=${booking.distance}&fare=${booking.totalFare}`
      );
    } else {
      console.warn('❌ Payment not successful:', result.code);
      return res.redirect('/payment-failed');
    }
  } catch (err) {
    console.error('❌ Callback error:', err.response?.data || err.message);
    return res.redirect('/payment-failed');
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

