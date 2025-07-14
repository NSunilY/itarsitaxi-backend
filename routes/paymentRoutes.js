// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const Booking = require('../models/Booking');
const sendSMS = require('../utils/sendSMS');
require('dotenv').config();

const {
  StandardCheckoutClient,
  StandardCheckoutPayRequest,
  Env,
} = require('pg-sdk-node');

const client = StandardCheckoutClient.getInstance(
  process.env.PHONEPE_CLIENT_ID,
  process.env.PHONEPE_CLIENT_SECRET,
  parseInt(process.env.PHONEPE_CLIENT_VERSION),
  Env.PRODUCTION
);

// 🔐 Generate X-VERIFY Header for Secure Status Check
const generateXVerify = (merchantOrderId) => {
  const payload = `/pg/v1/status/${process.env.PHONEPE_MERCHANT_ID}/${merchantOrderId}${process.env.PHONEPE_SALT}`;
  const crypto = require('crypto');
  const sha256 = crypto.createHash('sha256').update(payload).digest('hex');
  return sha256 + '###' + process.env.PHONEPE_SALT_INDEX;
};

// 🟢 INITIATE PAYMENT
router.post('/phonepe/initiate', async (req, res) => {
  const { amount, mobile, bookingData } = req.body;

  if (!amount || amount < 1 || !bookingData) {
    return res.status(400).json({ success: false, message: 'Invalid request' });
  }

  const merchantOrderId = uuidv4();

  try {
    const tempBooking = new Booking({
      ...bookingData,
      paymentStatus: 'Pending',
      transactionId: merchantOrderId,
      advanceAmount: amount,
    });
    await tempBooking.save();

    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amount * 100)
      .redirectUrl(
        `${process.env.PHONEPE_REDIRECT_URL}?bookingId=${tempBooking._id}&name=${encodeURIComponent(
          tempBooking.name
        )}&carType=${encodeURIComponent(tempBooking.carType)}&fare=${tempBooking.totalFare}&distance=${tempBooking.distance}`
      )
      .build();

    const response = await client.pay(request);
    const redirectUrl = response.redirectUrl;

    res.json({ success: true, redirectUrl });
  } catch (err) {
    console.error('❌ PhonePe SDK Error:', err);
    res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// ✅ CALLBACK AFTER PAYMENT
router.post('/phonepe/callback', async (req, res) => {
  console.log('📩 Callback hit! Raw Body:', req.body);

  const { merchantOrderId } = req.body;

  try {
    const response = await axios.get(
      `https://api.phonepe.com/apis/hermes/pg/v1/status/${process.env.PHONEPE_MERCHANT_ID}/${merchantOrderId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': generateXVerify(merchantOrderId),
        },
      }
    );

    const result = response.data;

    if (result.success && result.code === 'PAYMENT_SUCCESS') {
      const booking = await Booking.findOne({ transactionId: merchantOrderId });
      if (!booking) {
        console.log('⚠️ Booking not found for transaction ID:', merchantOrderId);
        return res.status(400).send('⚠️ No booking found for this transaction');
      }

      booking.paymentStatus = 'Paid';
      await booking.save();

      console.log('✅ Booking marked as Paid:', booking._id);

      const smsToCustomer = `Dear ${booking.name}, your prepaid booking is confirmed.\nAdvance Paid: ₹${booking.advanceAmount || 0}\nTotal Fare: ₹${booking.totalFare}.\nThanks - ItarsiTaxi.in`;
      await sendSMS(booking.mobile, smsToCustomer);

      const adminSMS = `🆕 Prepaid Booking:\nName: ${booking.name}\nMobile: ${booking.mobile}\nCar: ${booking.carType}\nFare: ₹${booking.totalFare}\nAdvance: ₹${booking.advanceAmount || 0}`;
      await sendSMS(process.env.ADMIN_MOBILE || '8305639491', adminSMS);

      return res.redirect(
        `/thank-you?bookingId=${booking._id}&name=${encodeURIComponent(
          booking.name
        )}&carType=${encodeURIComponent(booking.carType)}&distance=${booking.distance}&fare=${booking.totalFare}`
      );
    } else {
      console.warn('❌ Payment Failed or Status Unknown');
      return res.redirect('/payment-failed');
    }
  } catch (err) {
    console.error('❌ Callback Processing Error:', err);
    res.status(500).send('Booking failed. Please contact support.');
  }
});

// ✅ CASH ON ARRIVAL BOOKING
router.post('/cash-booking', async (req, res) => {
  try {
    const bookingData = req.body;
    const newBooking = new Booking({
      ...bookingData,
      paymentStatus: 'Cash on Arrival',
    });

    await newBooking.save();

    const smsText = `Dear ${newBooking.name}, your booking is confirmed.\nFare: ₹${newBooking.totalFare}.\nPlease pay in cash to the driver.\nThanks - ItarsiTaxi.in`;
    await sendSMS(newBooking.mobile, smsText);

    const adminSMS = `🆕 COD Booking:\nName: ${newBooking.name}\nMobile: ${newBooking.mobile}\nCar: ${newBooking.carType}\nFare: ₹${newBooking.totalFare}`;
    await sendSMS(process.env.ADMIN_MOBILE || '8305639491', adminSMS);

    res.json({ success: true, message: 'Booking successful', bookingId: newBooking._id });
  } catch (err) {
    console.error('❌ Cash Booking Error:', err);
    res.status(500).json({ success: false, message: 'Booking failed' });
  }
});

module.exports = router;

