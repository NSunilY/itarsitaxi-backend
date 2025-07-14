// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
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
  console.log('📩 PhonePe Callback hit:', req.body);

  const { merchantOrderId } = req.body;

  if (!merchantOrderId) {
    return res.status(400).send('Missing transaction ID');
  }

  try {
    // ✅ Use SDK correctly
    const statusRes = await client.status(merchantOrderId);

    console.log('📦 PhonePe SDK status:', statusRes);

    if (statusRes.success && statusRes.code === 'PAYMENT_SUCCESS') {
      const booking = await Booking.findOne({ transactionId: merchantOrderId });

      if (!booking) {
        console.error('⚠️ Booking not found for txn:', merchantOrderId);
        return res.status(404).send('Booking not found');
      }

      booking.paymentStatus = 'Paid';
      await booking.save();

      console.log(`✅ Booking marked as Paid: ${booking._id}`);

      // 🔔 SMS to customer
      const customerSMS = `Dear ${booking.name}, your prepaid booking is confirmed.\nAdvance Paid: ₹${booking.advanceAmount || 0}\nTotal Fare: ₹${booking.totalFare}.\nThanks - ItarsiTaxi.in`;
      await sendSMS(booking.mobile, customerSMS);

      // 🔔 SMS to admin
      const adminSMS = `🆕 Prepaid Booking:\nName: ${booking.name}\nMobile: ${booking.mobile}\nCar: ${booking.carType}\nFare: ₹${booking.totalFare}\nAdvance: ₹${booking.advanceAmount || 0}`;
      await sendSMS('7000771918', adminSMS);

      return res.redirect(
        `${process.env.PHONEPE_REDIRECT_URL}?bookingId=${booking._id}&name=${encodeURIComponent(
          booking.name
        )}&carType=${encodeURIComponent(booking.carType)}&distance=${booking.distance}&fare=${booking.totalFare}`
      );
    } else {
      console.warn('❌ Payment status not successful:', statusRes);
      return res.redirect('/payment-failed');
    }
  } catch (err) {
    console.error('❌ Payment callback error:', err);
    return res.status(500).send('Callback processing failed');
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

    // 🔔 SMS to customer
    const smsText = `Dear ${newBooking.name}, your booking is confirmed.\nFare: ₹${newBooking.totalFare}.\nPlease pay in cash to the driver.\nThanks - ItarsiTaxi.in`;
    await sendSMS(newBooking.mobile, smsText);

    // 🔔 SMS to admin
    const adminSMS = `🆕 COD Booking:\nName: ${newBooking.name}\nMobile: ${newBooking.mobile}\nCar: ${newBooking.carType}\nFare: ₹${newBooking.totalFare}`;
    await sendSMS('7000771918', adminSMS); // ✅ Fixed admin number

    res.json({ success: true, message: 'Booking successful', bookingId: newBooking._id });
  } catch (err) {
    console.error('❌ Cash Booking Error:', err);
    res.status(500).json({ success: false, message: 'Booking failed' });
  }
});

module.exports = router;

