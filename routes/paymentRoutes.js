// routes/paymentRoutes.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const router = express.Router();
const Booking = require('../models/Booking');
const {
  StandardCheckoutClient,
  Env,
} = require('pg-sdk-node');

const {
  PHONEPE_CLIENT_ID,
  PHONEPE_CLIENT_SECRET,
  PHONEPE_CLIENT_VERSION,
  PHONEPE_REDIRECT_URL,
  PHONEPE_CALLBACK_URL,
  PHONEPE_MERCHANT_ID,
  PHONEPE_ENV,
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

// 🔐 Get OAuth Token
const getAuthToken = async () => {
  const response = await axios.post(
    'https://api.phonepe.com/apis/identity-manager/v3/merchant/authenticate',
    {},
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': PHONEPE_CLIENT_ID,
        'X-Client-Secret': PHONEPE_CLIENT_SECRET,
      },
    }
  );
  return response.data.data.accessToken;
};

// 🔐 Create Payment Order
router.post('/phonepe/create-order', async (req, res) => {
  const { amount, bookingId } = req.body;

  try {
    const token = await getAuthToken();
    const orderId = bookingId; // or uuidv4() if you want to separate it

    const payload = {
      merchantId: PHONEPE_MERCHANT_ID,
      merchantTransactionId: orderId,
      merchantUserId: 'user_' + bookingId,
      amount: amount * 100, // ₹ to paise
      redirectUrl: `${PHONEPE_REDIRECT_URL}?orderId=${orderId}`,
      redirectMode: 'POST',
      callbackUrl: PHONEPE_CALLBACK_URL,
      paymentInstrument: {
        type: 'PAY_PAGE',
      },
    };

    const response = await axios.post(
      'https://api.phonepe.com/apis/hermes/pg/v1/create',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const redirectUrl = response.data.data.instrumentResponse.redirectInfo.url;

    res.json({
      success: true,
      orderId,
      token: redirectUrl,
    });

  } catch (error) {
    console.error('PhonePe Create Order Error:', error?.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to create order' });
  }
});

// 🔁 Status Check
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

// 📩 Webhook (Callback)
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
        paymentStatus: state === 'COMPLETED' ? 'Success' : 'Failed'
      }
    );

    return res.sendStatus(200);
  } catch (err) {
    console.error('PhonePe callback error:', err);
    return res.sendStatus(400);
  }
});

module.exports = router;

