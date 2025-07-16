// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Booking = require('../models/Booking');
const {
  StandardCheckoutClient,
  Env,
  StandardCheckoutPayRequest,
} = require('pg-sdk-node');

const {
  PHONEPE_CLIENT_ID,
  PHONEPE_CLIENT_SECRET,
  PHONEPE_CLIENT_VERSION,
  PHONEPE_MERCHANT_ID,
  PHONEPE_ENV,
  PHONEPE_REDIRECT_URL,
  PHONEPE_CALLBACK_URL,
} = process.env;

// 🌍 Set environment
const env = PHONEPE_ENV === 'PRODUCTION' ? Env.PRODUCTION : Env.SANDBOX;

// 🚀 Create PhonePe SDK client
const client = StandardCheckoutClient.getInstance(
  PHONEPE_CLIENT_ID,
  PHONEPE_CLIENT_SECRET,
  parseInt(PHONEPE_CLIENT_VERSION),
  env
);

// 📦 Create PhonePe Payment Order
router.post('/phonepe/create-order', async (req, res) => {
  const { amount, bookingId } = req.body;

  try {
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const safeBookingId = bookingId.toString().replace(/[^a-zA-Z0-9]/g, '');

    const request = new StandardCheckoutPayRequest({
      merchantId: PHONEPE_MERCHANT_ID,
      merchantTransactionId: safeBookingId,
      merchantUserId: 'user_' + safeBookingId,
      amount: amount * 100, // in paise
      redirectUrl: `${PHONEPE_REDIRECT_URL}?orderId=${safeBookingId}`,
      redirectMode: 'REDIRECT',
      callbackUrl: PHONEPE_CALLBACK_URL,
      paymentInstrument: {
        type: 'PAY_PAGE',
      },
    });

    const response = await client.pay(request);
    const redirectUrl = response.instrumentResponse.redirectInfo.url;

    res.json({
      success: true,
      orderId: safeBookingId,
      redirectUrl,
    });
  } catch (error) {
    console.error('PhonePe Create Order Error:', error?.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to create order' });
  }
});

// 🔁 Status Check Endpoint
router.get('/phonepe/status/:orderId', async (req, res) => {
  const { orderId } = req.params;

  try {
    const response = await client.getOrderStatus(orderId);
    return res.json({ success: true, status: response.state });
  } catch (err) {
    console.error('PhonePe status check failed:', err);
    return res.status(500).json({ success: false });
  }
});

// 📩 Webhook / Callback Handler
router.post('/payment/phonepe/callback', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const bodyStr = JSON.stringify(req.body);

    const callback = client.validateCallback(
      PHONEPE_CLIENT_ID,
      PHONEPE_CLIENT_SECRET,
      authHeader,
      bodyStr
    );

    const { orderId, state } = callback.payload;

    await Booking.findOneAndUpdate(
      { bookingId: orderId },
      {
        paymentStatus: state === 'COMPLETED' ? 'Success' : 'Failed',
      }
    );

    return res.sendStatus(200);
  } catch (err) {
    console.error('PhonePe callback error:', err);
    return res.sendStatus(400);
  }
});

module.exports = router;

