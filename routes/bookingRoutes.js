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
    } = req.body;

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
    });

    const savedBooking = await newBooking.save();
    console.log("✅ Booking saved to MongoDB:", savedBooking);

    // ✅ Prepare SMS
const message = `🎉 Booking Confirmed!

Thank you ${name} for choosing ItarsiTaxi 🚖

📍 Trip: Itarsi ➡️ ${dropLocation}
📅 Date: ${pickupDate} at ${pickupTime}
🚘 Car Type: ${carType}
📏 Distance: ${distance} km | ⏱ Duration: ${duration}
💰 Fare: ₹${totalFare}
🆔 Booking ID: ${savedBooking._id.toString().slice(-6)}

Need help? We're here 24x7: +91-9876543210

Safe travels! 😊
- Team ItarsiTaxi`;

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

