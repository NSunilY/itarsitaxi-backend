// routes/paymentRoutes.js
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const router = express.Router();
const Booking = require('../models/Booking'); // make sure this path is correct

const tempBookingStore = {}; // in-memory store (reset on server restart)

// ✅ PhonePe config (use your actual credentials)
const phonepeConfig = {
  merchantId: process.env.PHONEPE_MERCHANT_ID || 'YOUR_PHONEPE_MERCHANT_ID',
  saltKey: process.env.PHONEPE_SALT_KEY || 'YOUR_SALT_KEY',
  saltIndex: process.env.PHONEPE_SALT_INDEX || '1',
  baseUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
  callbackUrl: 'https://itarsitaxi.in/payment-success',
};

// 🟢 Step 1: Initiate PhonePe Payment
router.post('/phonepe/initiate', async (req, res) => {
  const { amount, mobile, bookingData } = req.body;

  if (!amount || amount < 1 || !bookingData) {
    return res.status(400).json({ success: false, message: 'Invalid request' });
  }

  const orderId = `ORDER_${Date.now()}`;

  const payload = {
    merchantId: phonepeConfig.merchantId,
    merchantTransactionId: orderId,
    merchantUserId: mobile || 'GUEST_USER',
    amount: amount * 100, // convert to paisa
    redirectUrl: phonepeConfig.callbackUrl,
    redirectMode: 'POST',
    callbackUrl: phonepeConfig.callbackUrl,
    paymentInstrument: { type: 'PAY_PAGE' },
  };

  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const checksum = crypto
    .createHash('sha256')
    .update(base64Payload + '/pg/v1/pay' + phonepeConfig.saltKey)
    .digest('hex');

  try {
    const response = await axios.post(
      `${phonepeConfig.baseUrl}/pg/v1/pay`,
      { request: base64Payload },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': `${checksum}###${phonepeConfig.saltIndex}`,
        },
      }
    );

    const resData = response.data;

    if (resData.success && resData.data?.instrumentResponse?.redirectInfo?.url) {
      // 🔐 Store booking data temporarily for this order
      tempBookingStore[orderId] = bookingData;

      return res.json({
        success: true,
        redirectUrl: resData.data.instrumentResponse.redirectInfo.url,
      });
    }

    res.status(500).json({ success: false, message: 'PhonePe error', data: resData });
  } catch (err) {
    console.error('❌ Payment error:', err.response?.data || err.message);
    res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// 🟢 Step 2: Handle Payment Callback
router.post('/phonepe/callback', async (req, res) => {
  const callbackData = req.body;

  const transactionId = callbackData.transactionId;
  const merchantTransactionId = callbackData.merchantTransactionId;
  const code = callbackData.code;

  console.log('📩 PhonePe callback:', callbackData);

  if (code !== 'PAYMENT_SUCCESS') {
    console.warn(`❌ Payment failed or cancelled for ${merchantTransactionId}`);
    return res.redirect('/payment-failed');
  }

  // ✅ Fetch stored booking data
  const bookingData = tempBookingStore[merchantTransactionId];

  if (!bookingData) {
    return res.status(400).send('⚠️ No booking data found for this transaction');
  }

  try {
    // Create booking in DB
    const newBooking = new Booking({
      ...bookingData,
      paymentStatus: 'Paid',
      transactionId,
    });

    await newBooking.save();

    // Clear temp store
    delete tempBookingStore[merchantTransactionId];

    // Redirect to Thank You page
    res.redirect(`/thank-you?name=${bookingData.name}&carType=${bookingData.carType}&fare=${bookingData.totalFare}`);
  } catch (err) {
    console.error('❌ DB save failed:', err);
    res.status(500).send('Booking failed. Please contact support.');
  }
});
module.exports = router;

