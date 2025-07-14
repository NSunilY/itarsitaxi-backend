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
    const merchantOrderId = uuidv4();

    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amount * 100)
      .redirectUrl(`${process.env.PHONEPE_CALLBACK_URL}?txnId=${merchantOrderId}`)
      .build();

    const response = await client.pay(request);

    req.app.locals.tempBookings = req.app.locals.tempBookings || {};
    req.app.locals.tempBookings[merchantOrderId] = {
      ...bookingData,
      advanceAmount: amount,
    };

    return res.json({ success: true, redirectUrl: response.redirectUrl });
  } catch (err) {
    console.error('❌ Payment initiation error:', err.message);
    return res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// ✅ CALLBACK AFTER PAYMENT
router.get('/phonepe/callback', async (req, res) => {
  const merchantOrderId = req.query.txnId;

  console.log('📩 [GET] PhonePe redirect received — txnId:', merchantOrderId);

  if (!merchantOrderId) {
    return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
  }

  try {
    const statusRes = await client.status(merchantOrderId); // ✅ VALID CALL
    const result = statusRes.data;

    console.log('📦 [GET] Payment status result:', result);

    // ✅ Only save if payment successful
    if (result.success && result.code === 'PAYMENT_SUCCESS') {
      const tempBookingData = req.app.locals.tempBookings?.[merchantOrderId];
      if (!tempBookingData) {
        console.warn('❌ No temp booking data found');
        return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
      }

      const booking = new Booking({
        ...tempBookingData,
        paymentStatus: 'Paid',
        transactionId: merchantOrderId,
      });

      await booking.save();

      const customerSMS = `Dear ${booking.name}, your prepaid booking is confirmed.\nAdvance Paid: ₹${booking.advanceAmount}\nTotal Fare: ₹${booking.totalFare}.\nThanks - ItarsiTaxi.in`;
      await sendSMS(booking.mobile, customerSMS);

      const adminSMS = `🆕 Prepaid Booking:\nName: ${booking.name}\nMobile: ${booking.mobile}\nCar: ${booking.carType}\nFare: ₹${booking.totalFare}\nAdvance: ₹${booking.advanceAmount}`;
      await sendSMS('7000771918', adminSMS);

      return res.redirect(
        `${process.env.PHONEPE_REDIRECT_URL}/payment-success?bookingId=${booking._id}&name=${encodeURIComponent(
          booking.name
        )}&carType=${encodeURIComponent(booking.carType)}&distance=${booking.distance}&fare=${booking.totalFare}`
      );
    } else {
      console.warn('❌ Payment not successful');
      return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
    }
  } catch (err) {
    console.error('❌ Callback error:', err.message);
    return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
  }
});

module.exports = router;

