// routes/paymentRoutes.js — Raw REST version (no SDK)
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const Booking = require('../models/Booking');
const sendSMS = require('../utils/sendSMS');
require('dotenv').config();

const router = express.Router();

const BASE_URL = 'https://api.phonepe.com/apis/hermes/pg/v1';

// ✅ INITIATE PAYMENT
router.post('/phonepe/initiate', async (req, res) => {
  try {
    const { amount, bookingData } = req.body;
    if (!amount || !bookingData) return res.status(400).json({ success: false, message: 'Missing data' });

    const transactionId = uuidv4();
    const payLoad = {
      merchantId: process.env.PHONEPE_MERCHANT_ID,
      merchantTransactionId: transactionId,
      merchantUserId: bookingData.mobile,
      amount: amount * 100,
      redirectUrl: `${process.env.PHONEPE_CALLBACK_URL}?txnId=${transactionId}`,
      redirectMode: 'POST',
      mobileNumber: bookingData.mobile,
      paymentInstrument: {
        type: 'PAY_PAGE',
      },
    };

    const base64Payload = Buffer.from(JSON.stringify(payLoad)).toString('base64');
    const xVerify = crypto
      .createHash('sha256')
      .update(base64Payload + '/pg/v1/pay' + process.env.PHONEPE_CLIENT_SECRET)
      .digest('hex') + '###' + process.env.PHONEPE_CLIENT_ID;

    const response = await axios.post(`${BASE_URL}/pay`, { request: base64Payload }, {
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify,
      },
    });

    if (response.data.success) {
      req.app.locals.tempBookings = req.app.locals.tempBookings || {};
      req.app.locals.tempBookings[transactionId] = {
        ...bookingData,
        advanceAmount: amount,
      };
      return res.json({ success: true, redirectUrl: response.data.data.instrumentResponse.redirectInfo.url });
    } else {
      return res.status(500).json({ success: false, message: 'PhonePe response failed' });
    }
  } catch (err) {
    console.error('❌ Payment initiation error:', err.response?.data || err.message);
    return res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// ✅ CALLBACK AFTER PAYMENT
router.post('/phonepe/callback', async (req, res) => {
  try {
    const txnId = req.query.txnId;
    if (!txnId) return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);

    const xVerify = crypto
      .createHash('sha256')
      .update(`/pg/v1/status/${process.env.PHONEPE_MERCHANT_ID}/${txnId}` + process.env.PHONEPE_CLIENT_SECRET)
      .digest('hex') + '###' + process.env.PHONEPE_CLIENT_ID;

    const statusRes = await axios.get(
      `${BASE_URL}/status/${process.env.PHONEPE_MERCHANT_ID}/${txnId}`,
      {
        headers: { 'X-VERIFY': xVerify },
      }
    );

    const result = statusRes.data;
    console.log('📦 Payment Status:', result);

    if (result.success && result.code === 'PAYMENT_SUCCESS') {
      const tempBookingData = req.app.locals.tempBookings?.[txnId];
      if (!tempBookingData) return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);

      const booking = new Booking({
        ...tempBookingData,
        paymentStatus: 'Paid',
        transactionId: txnId,
      });
      await booking.save();

      await sendSMS(booking.mobile, `Dear ${booking.name}, your booking is confirmed. Paid ₹${booking.advanceAmount}. Fare: ₹${booking.totalFare}.`);
      await sendSMS('7000771918', `🆕 Prepaid Booking: ${booking.name}, ₹${booking.totalFare}, Paid: ₹${booking.advanceAmount}`);

      return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-success?bookingId=${booking._id}&name=${encodeURIComponent(
        booking.name
      )}&carType=${encodeURIComponent(booking.carType)}&distance=${booking.distance}&fare=${booking.totalFare}`);
    } else {
      return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
    }
  } catch (err) {
    console.error('❌ Callback error:', err.response?.data || err.message);
    return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
  }
});

// ✅ CASH ON ARRIVAL
router.post('/cash-booking', async (req, res) => {
  try {
    const data = req.body;
    const booking = new Booking({ ...data, paymentStatus: 'Cash on Arrival' });
    await booking.save();

    await sendSMS(booking.mobile, `Dear ${booking.name}, your booking is confirmed. Fare: ₹${booking.totalFare}. Pay to driver.`);
    await sendSMS('7000771918', `🆕 COD Booking: ${booking.name}, ₹${booking.totalFare}`);

    res.json({ success: true, bookingId: booking._id });
  } catch (err) {
    console.error('❌ Cash booking error:', err.message);
    res.status(500).json({ success: false });
  }
});

module.exports = router;

