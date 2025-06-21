const express = require("express");
const router = express.Router();
const getDistance = require("../utils/getDistance");
const Booking = require("../models/Booking");
const sendSMS = require("../utils/sendSMS");

// GET Distance route
router.get("/distance", async (req, res) => {
  const { origin, destination } = req.query;

  if (!origin || !destination) {
    return res.status(400).json({ error: "Both origin and destination are required." });
  }

  try {
    const result = await getDistance(origin, destination);
    res.json(result);
  } catch (err) {
    console.error("❌ Error in distance API:", err.message);
    res.status(500).json({ error: "Failed to fetch distance." });
  }
});

// ✅ POST /api/bookings — Save booking to DB and send SMS
router.post("/", async (req, res) => {
  try {
    console.log("📥 Incoming booking request:", req.body);

    const {
      name,
      mobile,
      email,
      paymentMode,
      carType,
      distance,
      totalFare,
      dropLocation,
      pickupDate,
      pickupTime,
      tripType,
      duration
    } = req.body;

    // Validate required fields
    if (!name || !mobile || !paymentMode || !carType || !distance || !totalFare) {
      console.warn("⚠️ Missing required fields");
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const newBooking = new Booking({
      name,
      mobile,
      email,
      paymentMode,
      carType,
      distance,
      totalFare,
      dropLocation,
      pickupDate,
      pickupTime,
      tripType,
      duration,
    });

    const savedBooking = await newBooking.save();
    console.log("✅ Booking saved to MongoDB:", savedBooking);

    const bookingId = savedBooking._id.toString().slice(-6);

    // ✅ Clean, user-friendly SMS
    const message = `🎉 ItarsiTaxi Booking Confirmed!

Dear ${name},
Your ride is booked successfully.

📍 From: Itarsi ➡️ ${dropLocation || 'N/A'}
📅 Date: ${pickupDate || 'N/A'} at ${pickupTime || 'N/A'}
🚘 Car: ${carType}
📏 Distance: ${distance} km ⏱ ${duration || 'N/A'}
💰 Fare: ₹${totalFare}
🆔 Booking ID: ${bookingId}
💳 Payment: ${paymentMode}

📞 For support: +91-9876543210
Thanks for choosing ItarsiTaxi!`;

    console.log("📤 Sending SMS to", mobile);
    await sendSMS(mobile, message);
    console.log("✅ SMS sent successfully");

    res.status(201).json({
      success: true,
      message: "Booking saved successfully",
      bookingId: savedBooking._id,
    });
  } catch (err) {
    console.error("🔥 Booking Error:", err.message || err);
    res.status(500).json({ success: false, message: "Booking failed" });
  }
});

module.exports = router;

