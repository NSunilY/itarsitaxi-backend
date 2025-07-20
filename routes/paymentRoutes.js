// routes/paymentRoutes.js (Razorpay version)
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const razorpay = require('../utils/razorpay');
const Booking = require('../models/Booking');
const sendSMS = require('../utils/sendSMS');
require('dotenv').config();

// ✅ CREATE RAZORPAY ORDER
router.post('/razorpay/create-order', async (req, res) => {
  const { amount, bookingData } = req.body;

  if (!amount || !bookingData) {
    return res.status(400).json({ success: false, message: 'Invalid request' });
  }

const receiptId = `rzp_${Math.random().toString(36).substring(2, 12)}`;

  const options = {
    amount: amount * 100, // amount in paise
    currency: 'INR',
    receipt: receiptId,
  };

  try {
    const order = await razorpay.orders.create(options);
    console.log('✅ Razorpay order created:', order.id);

    res.json({ success: true, order, bookingData });
  } catch (err) {
    console.error('❌ Razorpay Order Error:', err);
    res.status(500).json({ success: false, message: 'Failed to create Razorpay order' });
  }
});

// ✅ VERIFY PAYMENT & SAVE BOOKING
router.post('/razorpay/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingData } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingData) {
    return res.status(400).json({ success: false, message: 'Incomplete payment verification data' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    console.warn('⚠️ Invalid signature, possible tampering');
    return res.status(400).json({ success: false, message: 'Invalid payment signature' });
  }

  try {
    const newBooking = new Booking({
      ...bookingData,
      paymentStatus: 'Paid',
      transactionId: razorpay_payment_id,
      merchantOrderId: razorpay_order_id,
      advanceAmount: bookingData.advanceAmount || 0,
    });

    await newBooking.save();

    const smsText = `Dear ${newBooking.name}, your prepaid booking is confirmed.\nFare: ₹${newBooking.totalFare}.\nThanks for choosing ItarsiTaxi.in!`;
    await sendSMS(newBooking.mobile, smsText);

    console.log('✅ Booking saved and SMS sent:', newBooking._id);

    return res.json({ success: true });
  } catch (err) {
    console.error('❌ Error saving booking or sending SMS:', err);
    return res.status(500).json({ success: false, message: 'Booking failed. Please contact support.' });
  }
});

module.exports = router;

