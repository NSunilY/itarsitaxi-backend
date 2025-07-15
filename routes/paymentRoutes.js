const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Booking = require('../models/Booking');
const sendSMS = require('../utils/sendSMS');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const {
  StandardCheckoutClient,
  StandardCheckoutPayRequest,
  Env,
} = require('pg-sdk-node');

// ✅ PhonePe SDK Client for initiating payment only
const client = StandardCheckoutClient.getInstance(
  process.env.PHONEPE_CLIENT_ID,
  process.env.PHONEPE_CLIENT_SECRET,
  parseInt(process.env.PHONEPE_CLIENT_VERSION),
  Env.PRODUCTION
);

// ✅ INITIATE PAYMENT
router.post('/phonepe/initiate', async (req, res) => {
  try {
    const { amount, bookingData } = req.body;
    if (!amount || !bookingData) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    const merchantOrderId = uuidv4();

    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amount * 100)
      .redirectUrl(`${process.env.PHONEPE_CALLBACK_URL}?txnId=${merchantOrderId}`)
      .build();

    const response = await client.pay(request);
    const redirectUrl = response.redirectUrl;

    // Store booking data temporarily
    req.app.locals.tempBookings = req.app.locals.tempBookings || {};
    req.app.locals.tempBookings[merchantOrderId] = {
      ...bookingData,
      advanceAmount: amount,
    };

    return res.json({ success: true, redirectUrl });
  } catch (err) {
    console.error('❌ Payment initiation error:', err);
    return res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// ✅ GET CALLBACK (Browser redirect after PhonePe payment)
router.get('/phonepe/callback', async (req, res) => {
  const merchantOrderId = req.query.txnId;
  console.log('📩 [GET] PhonePe redirect received — txnId:', merchantOrderId);

  if (!merchantOrderId) {
    console.warn('⚠️ Missing txnId in query — treating as failure');
    return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
  }

  const urlPath = `/pg/v1/status/${process.env.PHONEPE_MERCHANT_ID}/${merchantOrderId}`;
  const fullUrl = `https://api.phonepe.com/apis/hermes${urlPath}`;
  const saltKey = process.env.PHONEPE_CLIENT_SECRET;
  const saltIndex = process.env.PHONEPE_CLIENT_ID;

  const xVerify = crypto
    .createHash('sha256')
    .update(urlPath + saltKey) // ✅ correct way (no payload)
    .digest('hex') + `###${saltIndex}`;

  try {
    console.log('🧪 Calling PhonePe status API:', fullUrl);
    console.log('🔐 X-VERIFY:', xVerify);
    console.log('🆔 X-MERCHANT-ID:', process.env.PHONEPE_MERCHANT_ID);

    const statusResponse = await axios.get(fullUrl, {
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify,
        'X-MERCHANT-ID': process.env.PHONEPE_MERCHANT_ID,
      },
    });

    const result = statusResponse.data;
    console.log('📦 [GET] Payment status result:', result);

    if (result.success && result.code === 'PAYMENT_SUCCESS') {
      const tempBookingData = req.app.locals.tempBookings?.[merchantOrderId];
      if (!tempBookingData) {
        console.error('❌ [GET] No temp booking data found for txnId:', merchantOrderId);
        return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
      }

      const booking = new Booking({
        ...tempBookingData,
        paymentStatus: 'Paid',
        transactionId: merchantOrderId,
      });

      await booking.save();
      console.log(`✅ [GET] Booking saved: ${booking._id}`);

      const customerSMS = `Dear ${booking.name}, your prepaid booking is confirmed.\nAdvance Paid: ₹${booking.advanceAmount}\nTotal Fare: ₹${booking.totalFare}.\nThanks - ItarsiTaxi.in`;
      const adminSMS = `🆕 Prepaid Booking:\nName: ${booking.name}\nMobile: ${booking.mobile}\nCar: ${booking.carType}\nFare: ₹${booking.totalFare}\nAdvance: ₹${booking.advanceAmount}`;
      await sendSMS(booking.mobile, customerSMS);
      await sendSMS('7000771918', adminSMS);

      return res.redirect(
        `${process.env.PHONEPE_REDIRECT_URL}?bookingId=${booking._id}&name=${encodeURIComponent(
          booking.name
        )}&carType=${encodeURIComponent(booking.carType)}&distance=${booking.distance}&fare=${booking.totalFare}`
      );
    } else {
      console.warn('❌ [GET] Payment not successful:', result);
      return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
    }
  } catch (err) {
    console.error('❌ Callback error:', err.response?.data || err.message);
    return res.redirect(`${process.env.PHONEPE_REDIRECT_URL}/payment-failed`);
  }
});

// ✅ POST: PhonePe Webhook
router.post('/phonepe/webhook', async (req, res) => {
  try {
    console.log('📥 [Webhook] Incoming webhook hit:', JSON.stringify(req.body, null, 2));

    const receivedSignature = req.headers.authorization?.replace('SHA256 ', '');
    const username = process.env.PHONEPE_WEBHOOK_USER;
    const password = process.env.PHONEPE_WEBHOOK_PASS;

    const computedSignature = crypto.createHash('sha256')
      .update(`${username}:${password}`)
      .digest('hex');

    if (receivedSignature !== computedSignature) {
      console.log('⚠️ Invalid webhook signature');
      return res.status(401).send('Unauthorized');
    }

    const payload = req.body.payload;
    const event = req.body.event;

    console.log('✅ Webhook Event:', event);
    console.log('🧾 Payload:', payload);

    if (event === 'checkout.order.completed' && payload.state === 'COMPLETED') {
      const bookingData = JSON.parse(payload.metaInfo.udf1 || '{}');

      const booking = new Booking({
        ...bookingData,
        paymentStatus: 'Paid',
        advanceAmount: payload.amount / 100,
        transactionId: payload.paymentDetails?.[0]?.transactionId || '',
        paymentMode: payload.paymentDetails?.[0]?.paymentMode || '',
      });

      await booking.save();
      console.log(`✅ [Webhook] Booking saved: ${booking._id}`);

      const smsToCustomer = `Dear ${booking.name}, your prepaid booking is confirmed.\nAdvance Paid: ₹${booking.advanceAmount}\nTotal Fare: ₹${booking.totalFare}.\nThanks - ItarsiTaxi.in`;
      const smsToAdmin = `🆕 [Webhook] Paid Booking:\nName: ${booking.name}\nMobile: ${booking.mobile}\nCar: ${booking.carType}\nFare: ₹${booking.totalFare}\nAdvance: ₹${booking.advanceAmount}`;
      await sendSMS(booking.mobile, smsToCustomer);
      await sendSMS('7000771918', smsToAdmin);

      return res.status(200).send('Webhook processed');
    }

    if (event === 'checkout.order.failed' || payload.state === 'FAILED') {
      console.warn('❌ Webhook: Payment failed for', payload.merchantOrderId);
      return res.status(200).send('Payment failed — no booking created');
    }

    res.status(200).send('Webhook received');
  } catch (err) {
    console.error('❌ [Webhook] Error:', err);
    res.status(500).send('Webhook processing error');
  }
});

// ✅ CASH ON ARRIVAL
router.post('/cash-booking', async (req, res) => {
  try {
    const bookingData = req.body;
    const newBooking = new Booking({
      ...bookingData,
      paymentStatus: 'Cash on Arrival',
    });

    await newBooking.save();

    const smsText = `Dear ${newBooking.name}, your booking is confirmed.\nFare: ₹${newBooking.totalFare}.\nPlease pay in cash to the driver.\nThanks - ItarsiTaxi.in`;
    const adminSMS = `🆕 COD Booking:\nName: ${newBooking.name}\nMobile: ${newBooking.mobile}\nCar: ${newBooking.carType}\nFare: ₹${newBooking.totalFare}`;

    await sendSMS(newBooking.mobile, smsText);
    await sendSMS('7000771918', adminSMS);

    res.json({ success: true, message: 'Booking successful', bookingId: newBooking._id });
  } catch (err) {
    console.error('❌ Cash Booking Error:', err);
    res.status(500).json({ success: false, message: 'Booking failed' });
  }
});

module.exports = router;

