const express = require('express');
const axios = require('axios');
const router = express.Router();
const Booking = require('../models/booking'); // adjust path if needed

const {
  PHONEPE_CLIENT_ID,
  PHONEPE_CLIENT_SECRET,
  PHONEPE_MERCHANT_ID,
  PHONEPE_REDIRECT_URL,
  PHONEPE_CALLBACK_URL,
} = process.env;

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

// 📦 Create Order API
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

// ✅ Webhook Callback
router.post('/payment/phonepe/callback', async (req, res) => {
  const event = req.body?.event;

  const transactionId = req.body?.data?.merchantTransactionId;
  const status = event === 'checkout.order.completed' ? 'success' : 'failed';

  try {
    await Booking.findOneAndUpdate(
      { bookingId: transactionId },
      { paymentStatus: status }
    );
    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(500);
  }
});

// 🔄 Fallback Status Check API
router.get('/phonepe/status/:orderId', async (req, res) => {
  const orderId = req.params.orderId;

  try {
    const token = await getAuthToken();
    const statusResponse = await axios.get(
      `https://api.phonepe.com/apis/pg/v1/status/${PHONEPE_MERCHANT_ID}/${orderId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const status = statusResponse.data.data?.state || 'UNKNOWN';
    res.json({ success: true, status });
  } catch (err) {
    console.error('Status check failed:', err?.response?.data || err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;

