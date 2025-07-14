// routes/paymentRoutes.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Booking = require('../models/Booking');
const sendSMS = require('../utils/sendSMS');
require('dotenv').config();
const router = express.Router();

const {
  StandardCheckoutClient,
  StandardCheckoutPayRequest,
  StandardCheckoutStatusRequest,
  Env,
} = require('pg-sdk-node');

// ✅ SDK Client Setup
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

    const txnId = uuidv4();

    const request = StandardCheckoutPayRequest.builder()
      .merchantTransactionId(txnId)
      .merchantUserId(bookingData.mobile)
      .amount(amount * 100)
      .redirectUrl(`${process.env.PHONEPE_CALLBACK_URL}?txnId=${txnId}`)
      .redirectMode('REDIRECT')
      .paymentInstrument({ type: 'PAY_PAGE' })
      .build();

    const response = await client.pay(request);
    const redirectUrl = response.redirectUrl;

    req.app.locals.tempBookings = req.app.locals.tempBookings || {};
    req.app.locals.tempBookings[txnId] = {
      ...bookingData,
      advanceAmount: amount,
    };

    res.json({ success: true, redirectUrl });
  } catch (err) {
    console.error('❌ Payment initiation error:', err?.response?.data || err.message);
    res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// ✅ CALLBACK AFTER PAYMENT
router.get('/phonepe/callback', async (req, res) => {
  const txnId = req.query.txnId;
  console.log('📩 [GET] PhonePe redirect received — txnId:', txnId);

  if (!txnId) {
    return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
  }

  try {
    const statusRequest = StandardCheckoutStatusRequest.builder()
      .merchantTransactionId(txnId)
      .build();

    const result = await client.status(statusRequest);

    console.log('📦 [GET] Payment status result:', result);

    if (result.success && result.code === 'PAYMENT_SUCCESS') {
      const tempData = req.app.locals.tempBookings?.[txnId];

      if (!tempData) {
        console.error('❌ No temp booking found for txnId:', txnId);
        return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
      }

      const booking = new Booking({
        ...tempData,
        paymentStatus: 'Paid',
        transactionId: txnId,
      });

      await booking.save();

      // 📲 Send SMS
      await sendSMS(
        booking.mobile,
        `Dear ${booking.name}, your prepaid booking is confirmed.\nAdvance Paid: ₹${booking.advanceAmount}\nTotal Fare: ₹${booking.totalFare}.\nThanks - ItarsiTaxi.in`
      );
      await sendSMS(
        '7000771918',
        `🆕 Prepaid Booking:\nName: ${booking.name}\nMobile: ${booking.mobile}\nCar: ${booking.carType}\nFare: ₹${booking.totalFare}\nAdvance: ₹${booking.advanceAmount}`
      );

      return res.redirect(
        `${process.env.PHONEPE_REDIRECT_URL}/payment-success?bookingId=${booking._id}&name=${encodeURIComponent(
          booking.name
        )}&carType=${encodeURIComponent(booking.carType)}&distance=${booking.distance}&fare=${booking.totalFare}`
      );
    } else {
      return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
    }
  } catch (err) {
    console.error('❌ Callback error:', err?.response?.data || err.message);
    return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
  }
});

module.exports = router;

