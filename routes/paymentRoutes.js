// routes/paymentRoutes.js
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const router = express.Router();

// ✅ PhonePe config (replace with your actual credentials or use env vars)
const phonepeConfig = {
  merchantId: process.env.PHONEPE_MERCHANT_ID || 'YOUR_PHONEPE_MERCHANT_ID',
  saltKey: process.env.PHONEPE_SALT_KEY || 'YOUR_SALT_KEY',
  saltIndex: process.env.PHONEPE_SALT_INDEX || '1',
  baseUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox', // change to prod when live
  callbackUrl: 'https://itarsitaxi.in/payment-success',
};

// 🟢 INITIATE PHONEPE PAYMENT
router.post('/phonepe/initiate', async (req, res) => {
  const { amount, mobile } = req.body;

  if (!amount || amount < 1) {
    return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
  }

  const orderId = `ORDER_${Date.now()}`;
  const payload = {
    merchantId: phonepeConfig.merchantId,
    merchantTransactionId: orderId,
    merchantUserId: mobile || 'GUEST_USER',
    amount: amount * 100, // in paisa
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

    if (resData.success && resData.data && resData.data.instrumentResponse) {
      const redirectUrl = resData.data.instrumentResponse.redirectInfo.url;
      res.json({ success: true, redirectUrl });
    } else {
      res.status(500).json({ success: false, message: 'PhonePe response error', data: resData });
    }
  } catch (error) {
    console.error('❌ PhonePe error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'PhonePe payment initiation failed' });
  }
});

// 🟢 OPTIONAL: Payment Callback Endpoint (from PhonePe)
router.post('/phonepe/callback', (req, res) => {
  console.log('📩 PhonePe callback received:', req.body);
  // TODO: Save or verify payment result here
  res.send("✅ Callback received. Thank you!");
});

module.exports = router;

