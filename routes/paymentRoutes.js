// routes/paymentRoutes.js
const express = require('express');
const Razorpay = require('razorpay');
const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

router.post('/create-order', async (req, res) => {
  const { amount } = req.body;

  if (!amount || amount < 1) {
    return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
  }

  const options = {
    amount: amount * 100, // in paise
    currency: 'INR',
    receipt: `receipt_${Date.now()}`,
  };

  try {
    const order = await razorpay.orders.create(options);
    res.json({ success: true, order });
  } catch (err) {
    console.error('❌ Razorpay order creation failed:', err);
    res.status(500).json({ success: false, message: 'Failed to create Razorpay order' });
  }
});

module.exports = router;

