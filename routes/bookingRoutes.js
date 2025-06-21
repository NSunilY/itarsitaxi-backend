const express = require("express");
const router = express.Router();
const getDistance = require("../utils/getDistance");
const Booking = require("../models/Booking"); // DB model
const sendSMS = require("../utils/sendSMS"); // ✅ Import SMS util

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
    res.status(500).json({ error: "Failed to fetch distance." });
  }
});

// ✅ POST /api/bookings — Save booking to DB and send SMS
router.post("/", async (req, res) => {
  try {
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

    // ✅ Send SMS after saving
    const message = `Dear ${name}, your ItarsiTaxi booking is confirmed!
Car: ${carType}
Fare: ₹${totalFare}
Distance: ${distance} km
Payment: ${paymentMode}
Booking ID: ${savedBooking._id.toString().slice(-6)}

Thank you for choosing ItarsiTaxi!`;

    await sendSMS(mobile, message);

    res.status(201).json({
      success: true,
      message: "Booking saved successfully",
      bookingId: savedBooking._id,
    });
  } catch (err) {
    console.error("Booking Error:", err);
    res.status(500).json({ success: false, message: "Booking failed" });
  }
});

module.exports = router;

