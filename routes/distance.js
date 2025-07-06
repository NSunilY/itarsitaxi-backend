const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config(); // ✅ Load environment variables

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

router.post('/', async (req, res) => {
  const { origin, destination } = req.body;

  if (!GOOGLE_API_KEY) {
    return res.status(500).json({ error: '❌ Missing Google API Key in environment' });
  }

  if (!origin || !destination) {
    return res.status(400).json({ error: '❌ Origin and destination are required' });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
      origin
    )}&destination=${encodeURIComponent(destination)}&key=${GOOGLE_API_KEY}`;

    const response = await axios.get(url);

    const route = response.data.routes[0];

    if (!route || !route.legs || !route.legs.length) {
      return res.status(400).json({ error: '❌ Unable to find a valid route' });
    }

    const leg = route.legs[0];
    const distanceInKm = leg.distance.value / 1000;
    const durationText = leg.duration.text;

    // Toll count (approx): count "TOLL" steps from HTML instructions
    const tolls = route.legs[0].steps.filter((step) =>
      /toll/i.test(step.html_instructions)
    ).length;

    res.json({
      distance: distanceInKm,
      duration: durationText,
      tollCount: tolls,
    });
  } catch (error) {
    console.error('❌ Error fetching distance:', error.message);
    res.status(500).json({ error: 'Failed to fetch distance and duration' });
  }
});

module.exports = router;

