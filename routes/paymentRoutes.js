// routes/paymentRoutes.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const Booking = require('../models/Booking');
const sendSMS = require('../utils/sendSMS');
require('dotenv').config();

const router = express.Router();

// ✅ INITIATE PAYMENT
router.post('/phonepe/initiate', async (req, res) => {
  try {
    const { amount, bookingData } = req.body;
    if (!amount || !bookingData) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    const merchantTransactionId = uuidv4();
    const merchantId = process.env.PHONEPE_MERCHANT_ID;

    const payload = {
      merchantId,
      merchantTransactionId,
      merchantUserId: bookingData.mobile,
      amount: amount * 100,
      redirectUrl: `${process.env.PHONEPE_CALLBACK_URL}?txnId=${merchantTransactionId}`,
      redirectMode: 'REDIRECT',
      paymentInstrument: {
        type: 'PAY_PAGE',
      },
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const xVerify = crypto
      .createHash('sha256')
      .update(base64Payload + '/pg/v1/pay' + process.env.PHONEPE_CLIENT_SECRET)
      .digest('hex') + '###1';

    const response = await axios.post(
      'https://api.phonepe.com/apis/pg-sandbox/pg/v1/pay',
      { request: base64Payload },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
          'X-MERCHANT-ID': merchantId,
        },
      }
    );

    req.app.locals.tempBookings = req.app.locals.tempBookings || {};
    req.app.locals.tempBookings[merchantTransactionId] = {
      ...bookingData,
      advanceAmount: amount,
    };

    const redirectUrl = response.data.data.instrumentResponse.redirectInfo.url;

    res.json({ success: true, redirectUrl });
  } catch (err) {
    console.error('❌ Payment initiation error:', err?.response?.data || err.message);
    res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// ✅ PAYMENT CALLBACK
router.get('/phonepe/callback', async (req, res) => {
  const merchantTransactionId = req.query.txnId;

  console.log('📩 [GET] PhonePe redirect received — txnId:', merchantTransactionId);

  if (!merchantTransactionId) {
    return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
  }

  try {
    const merchantId = process.env.PHONEPE_MERCHANT_ID;
    const statusUrl = `https://api.phonepe.com/apis/pg-sandbox/pg/v1/status/${merchantId}/${merchantTransactionId}`;
    const xVerify = crypto
      .createHash('sha256')
      .update(`/pg/v1/status/${merchantId}/${merchantTransactionId}${process.env.PHONEPE_CLIENT_SECRET}`)
      .digest('hex') + '###1';

    const statusRes = await axios.get(statusUrl, {
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify,
        'X-MERCHANT-ID': merchantId,
      },
    });

    const result = statusRes.data;

    console.log('📦 Payment status result:', result);

    if (result.success && result.code === 'PAYMENT_SUCCESS') {
      const bookingData = req.app.locals.tempBookings?.[merchantTransactionId];

      if (!bookingData) {
        return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
      }

      const booking = new Booking({
        ...bookingData,
        paymentStatus: 'Paid',
        transactionId: merchantTransactionId,
      });

      await booking.save();

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

