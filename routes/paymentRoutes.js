// routes/paymentRoutes.js
const express = require('express');
const axios = require('axios');
const qs = require('qs');
const router = express.Router();
const Booking = require('../models/Booking');

const tempBookingStore = {};

const phonepeConfig = {
  clientId: process.env.PHONEPE_CLIENT_ID,
  clientSecret: process.env.PHONEPE_CLIENT_SECRET,
  merchantId: process.env.PHONEPE_MERCHANT_ID,
  baseUrl: 'https://api.phonepe.com',
  callbackUrl: 'https://itarsitaxi.in/payment-success',
};

// ✅ Fetch Access Token
async function fetchAccessToken() {
  try {
    const body = qs.stringify({ grant_type: 'client_credentials' });

    const response = await axios.post(
      `${phonepeConfig.baseUrl}/apis/identity-manager/v1/oauth/token`,
      body,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:
            'Basic ' +
            Buffer.from(`${phonepeConfig.clientId}:${phonepeConfig.clientSecret}`).toString('base64'),
        },
      }
    );

    return response.data?.accessToken;
  } catch (error) {
    console.error('❌ Token Fetch Error:', error.response?.data || error.message);
    throw new Error('Failed to fetch PhonePe token');
  }
}

// 🟢 Initiate Payment
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

  try {
    const token = await fetchAccessToken();

    const response = await axios.post(
      `${phonepeConfig.baseUrl}/apis/pg/checkout/v2/pay`,
      { request: base64Payload },
      {
        headers: {
          'Content-Type': 'application/json',
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
    }
    res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// 🟢 Callback
router.post('/phonepe/callback', async (req, res) => {
  const { transactionId, merchantTransactionId, code } = req.body;

  console.log('📩 PhonePe callback received:', req.body);

  if (code !== 'PAYMENT_SUCCESS') {
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
    console.error('❌ DB Save Error:', err);
    res.status(500).send('Booking failed. Please contact support.');
  }
});

module.exports = router;

