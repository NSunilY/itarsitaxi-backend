// routes/paymentRoutes.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
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
  PHONEPE_REDIRECT_URL,
  PHONEPE_ENV
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

// 🔐 Create Payment Order
router.post('/phonepe/create-order', async (req, res) => {
  const { amount, bookingId } = req.body;

  try {
    const token = await getAuthToken();

    const orderId = bookingId; // use bookingId as orderId
    const payload = {
      merchantId: PHONEPE_MERCHANT_ID,
      merchantTransactionId: orderId,
      merchantUserId: bookingId,
      amount: amount * 100, // ₹ to paise
      redirectUrl: `${PHONEPE_REDIRECT_URL}/${orderId}`,
      redirectMode: 'REDIRECT',
      callbackUrl: PHONEPE_CALLBACK_URL,
      paymentInstrument: {
        type: 'PAY_PAGE',
      },
    };

    const orderResponse = await axios.post(
      'https://api.phonepe.com/apis/pg/v1/orders',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const { token: orderToken } = orderResponse.data.data;

    res.json({
      success: true,
      orderId,
      token: orderToken,
    });
  } catch (error) {
    console.error('PhonePe Create Order Error:', error?.response?.data || error);
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
      { paymentStatus: state === 'COMPLETED' ? 'success' : 'failed' }
    );

    return res.sendStatus(200);
  } catch (err) {
    console.error('PhonePe callback error:', err);
    return res.sendStatus(400);
  }
});

module.exports = router;

