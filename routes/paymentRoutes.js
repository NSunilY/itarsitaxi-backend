// routes/paymentRoutes.js
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const router = express.Router();
const Booking = require('../models/Booking');

const tempBookingStore = {}; // Memory store (cleared on restart)

// ✅ PhonePe Production Config
const phonepeConfig = {
  clientId: process.env.PHONEPE_CLIENT_ID,
  clientSecret: process.env.PHONEPE_CLIENT_SECRET,
  merchantId: process.env.PHONEPE_MERCHANT_ID,
  saltKey: process.env.PHONEPE_SALT_KEY,
  saltIndex: process.env.PHONEPE_SALT_INDEX || '1',
  baseUrl: 'https://api.phonepe.com',
  callbackUrl: 'https://itarsitaxi.in/payment-success',
};

// ✅ Fetch Bearer Token using client_id & client_secret
async function fetchAccessToken() {
  try {
    const response = await axios.post(
      `${phonepeConfig.baseUrl}/apis/identity-manager/v1/oauth/token`,
      {
        clientId: phonepeConfig.clientId,
        clientSecret: phonepeConfig.clientSecret,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data?.accessToken;
  } catch (error) {
    console.error('❌ Token Fetch Error:', error.response?.data || error.message);
    throw new Error('Failed to fetch PhonePe token');
  }
}

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
    amount: amount * 100,
    redirectUrl: phonepeConfig.callbackUrl,
    redirectMode: 'POST',
    callbackUrl: phonepeConfig.callbackUrl,
    paymentInstrument: { type: 'PAY_PAGE' },
  };

  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const checksum = crypto
    .createHash('sha256')
    .update(base64Payload + '/pg/checkout/v2/pay' + phonepeConfig.saltKey)
    .digest('hex');

  try {
    const token = await fetchAccessToken();

    const response = await axios.post(
      `${phonepeConfig.baseUrl}/apis/pg/checkout/v2/pay`,
      { request: base64Payload },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': `${checksum}###${phonepeConfig.saltIndex}`,
          Authorization: `Bearer ${token}`,
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

    console.error('❌ PhonePe responded with failure:', resData);
    res.status(500).json({ success: false, message: 'PhonePe error', data: resData });
  } catch (err) {
    console.error('❌ Final PhonePe Payment Error');
    if (err.response) {
      console.error('🔴 Response Data:', err.response.data);
      console.error('🔴 Status:', err.response.status);
    } else {
      console.error('🔴 Error:', err.message);
    }
    res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// 🟢 Step 2: Callback Handler
router.post('/phonepe/callback', async (req, res) => {
  const { transactionId, merchantTransactionId, code } = req.body;

  console.log('📩 PhonePe callback received:', req.body);

  if (code !== 'PAYMENT_SUCCESS') {
    console.warn(`❌ Payment failed or cancelled for transaction: ${merchantTransactionId}`);
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

