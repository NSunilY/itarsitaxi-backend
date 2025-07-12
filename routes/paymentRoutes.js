// routes/paymentRoutes.js
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const router = express.Router();
const Booking = require('../models/Booking');

const tempBookingStore = {}; // Memory store (cleared on restart)

// ✅ Production PhonePe config
const phonepeConfig = {
  merchantId: process.env.PHONEPE_MERCHANT_ID,
  saltKey: process.env.PHONEPE_SALT_KEY,
  saltIndex: process.env.PHONEPE_SALT_INDEX || '1',
  baseUrl: 'https://api.phonepe.com/apis/pg', // ✅ Production URL
  callbackUrl: 'https://itarsitaxi.in/payment-success', // ✅ Same for both redirect & callback
};

// 🟢 Step 1: Initiate Payment
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
    amount: amount * 100, // amount in paisa
    redirectUrl: phonepeConfig.callbackUrl,
    redirectMode: 'POST',
    callbackUrl: phonepeConfig.callbackUrl,
    paymentInstrument: {
      type: 'PAY_PAGE',
    },
  };

  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const checksum = crypto
    .createHash('sha256')
    .update(base64Payload + '/checkout/v2/pay' + phonepeConfig.saltKey)
    .digest('hex');

  try {
    const response = await axios.post(
      `${phonepeConfig.baseUrl}/checkout/v2/pay`,
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

// 🟢 Step 2: Payment Callback Handler
router.post('/phonepe/callback', async (req, res) => {
  const { transactionId, merchantTransactionId, code } = req.body;

  console.log('📩 Callback received:', req.body);

  if (code !== 'PAYMENT_SUCCESS') {
    console.warn(`❌ Payment failed or cancelled: ${merchantTransactionId}`);
    return res.redirect('/payment-failed');
  }

  const bookingData = tempBookingStore[merchantTransactionId];

  if (!bookingData) {
    return res.status(400).send('⚠️ No booking data found for this transaction');
  }

  try {
    const newBooking = new Booking({
      ...bookingData,
      paymentStatus: 'Paid',
      transactionId,
    });

    await newBooking.save();
    delete tempBookingStore[merchantTransactionId];

    res.redirect(
      `/thank-you?name=${bookingData.name}&carType=${bookingData.carType}&fare=${bookingData.totalFare}`
    );
  } catch (err) {
    console.error('❌ DB save error:', err);
    res.status(500).send('Booking failed. Please contact support.');
  }
});

module.exports = router;

