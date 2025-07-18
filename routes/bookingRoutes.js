const express = require("express");
const router = express.Router();
const getDistance = require("../utils/getDistance");
const Booking = require("../models/Booking");
const sendSMS = require("../utils/sendSMS");

const ITARSI_LOCATION = "Itarsi, Madhya Pradesh";

const safe = (v, fallback = "Not Provided") => (v || "").toString().trim() || fallback;

const sanitizeSMS = (text) => {
  return (text || "")
    .replace(/[–—]/g, "-")
    .replace(/[₹•“”‘’]/g, "")
    .replace(/[^\x00-\x7F]/g, "")
    .trim();
};

router.get("/distance", async (req, res) => {
  const { origin, destination } = req.query;
  if (!origin || !destination) {
    return res.status(400).json({ error: "Both origin and destination are required." });
  }

  try {
    const result = await getDistance(origin, destination);
    res.json(result);
  } catch (err) {
    console.error("❌ Error in distance API:", err);
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
      tollCount,
      pickupDate,
      pickupTime,
      tripType,
      pickupLocation,
      dropLocation,
      duration,
    } = req.body;

    // 🔒 Mandatory field check
    if (
      !name || !mobile || !paymentMode || !carType || !distance ||
      !totalFare || !tripType || !pickupLocation || !dropLocation
    ) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (paymentMode !== "Cash on Arrival") {
      return res.status(400).json({
        success: false,
        message: "Invalid route for prepaid bookings",
      });
    }

    // 🧠 Get distances from Itarsi
    const pickupResult = await getDistance(ITARSI_LOCATION, pickupLocation);
    const dropResult = await getDistance(ITARSI_LOCATION, dropLocation);

    if (!pickupResult || !dropResult) {
      console.error("❌ Distance API failed for pickup or drop location.");
      return res.status(500).json({
        success: false,
        message: "Could not validate pickup/drop location. Please try again.",
      });
    }

    const pickupDistanceFromItarsi = pickupResult.distanceInKm;
    const dropDistanceFromItarsi = dropResult.distanceInKm;

    // 🎯 Trip Type Validations
    if (tripType === "Local") {
      if (pickupDistanceFromItarsi > 15 || dropDistanceFromItarsi > 15) {
        return res.status(400).json({
          success: false,
          message: "For Local trips, both pickup and drop must be within 15 KM of Itarsi.",
        });
      }
    } else {
      if (distance < 15) {
        return res.status(400).json({
          success: false,
          message: "Minimum distance for this trip type must be at least 15 KM.",
        });
      }

      if (
        (tripType === "One Way" || tripType === "Round Trip") &&
        dropDistanceFromItarsi < 15
      ) {
        return res.status(400).json({
          success: false,
          message: "Drop location must be at least 15 KM from Itarsi for this trip type.",
        });
      }

      if (tripType === "Airport" && !dropLocation.toLowerCase().includes("airport")) {
        return res.status(400).json({
          success: false,
          message: "Drop location must be a valid airport for Airport trip type.",
        });
      }
    }

    // ✅ Save booking
    const newBooking = new Booking({
      name,
      mobile,
      email,
      paymentMode,
      carType,
      distance,
      totalFare,
      tollCount,
      pickupDate,
      pickupTime,
      tripType,
      pickupLocation,
      dropLocation,
      duration,
      paymentStatus: "Pending",
    });

    const savedBooking = await newBooking.save();
    console.log("✅ Booking saved to MongoDB:", savedBooking);

    // 📩 Send SMS
    const nameText = sanitizeSMS(safe(name));
    const carText = sanitizeSMS(safe(carType));
    const fareText = sanitizeSMS(safe(totalFare));
    const pickupText = sanitizeSMS(`${safe(pickupDate)} ${safe(pickupTime)}`);
    const pickupLocText = sanitizeSMS(safe(pickupLocation));
    const dropText = sanitizeSMS(safe(dropLocation));
    const mobileText = sanitizeSMS(safe(mobile));

    const customerMessage = `Hi ${nameText}, your ItarsiTaxi booking is confirmed. Car: ${carText}, Fare: Rs${fareText}, Pickup: ${pickupText} from ${pickupLocText}. Thank you!`;
    const adminMessage = `New booking by ${nameText} (${mobileText}). Pickup: ${pickupLocText} ${pickupText}, Drop: ${dropText}, Car: ${carText}, Fare: Rs${fareText}`;
    const adminPhone = process.env.ADMIN_PHONE || "91XXXXXXXXXX";

    await sendSMS(mobileText, customerMessage);
    await sendSMS(adminPhone, adminMessage);

    res.status(201).json({
      success: true,
      message: "Booking saved successfully",
      bookingId: savedBooking._id,
    });
  } catch (err) {
    console.error("🔥 Booking Error:", err);
    res.status(500).json({ success: false, message: "Booking failed" });
  }
});

module.exports = router;

