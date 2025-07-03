const express = require("express");
const router = express.Router();
const getDistance = require("../utils/getDistance");
const Booking = require("../models/Booking");
const sendSMS = require("../utils/sendSMS");

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
      duration,
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
      dropLocation,
      pickupDate,
      pickupTime,
      tripType,
      duration,
    });

    const savedBooking = await newBooking.save();
    console.log("✅ Booking saved to MongoDB:", savedBooking);

    /**
     * ✅ SMS Note:
     * Messages below must be in plain ENGLISH text only (not Unicode)
     * Max 150 characters per SMS for Fast2SMS Quick Route (route=q)
     * Avoid ₹, emojis, Hindi text, or special symbols that trigger Unicode mode
     */

    // Send SMS to Customer
    const customerMessage = `Hi ${name}, your ItarsiTaxi booking is confirmed. Car: ${carType}, Fare: Rs${totalFare}, Pickup: ${pickupDate} ${pickupTime}. Thank you!`;
    await sendSMS(mobile, customerMessage);

    // Send SMS to Admin
    const adminPhone = process.env.ADMIN_PHONE || "91XXXXXXXXXX";
    const adminMessage = `New booking by ${name} (${mobile}). Pickup: ${pickupDate} ${pickupTime}, Drop: ${dropLocation}, Car: ${carType}, Fare: Rs${totalFare}`;
    await sendSMS(adminPhone, adminMessage);

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

