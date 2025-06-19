const express = require('express');
const router = express.Router();
const axios = require('axios');

// Replace this with your actual Google API Key
const GOOGLE_API_KEY = 'AIzaSyDC09O0cIruFZLspsSdWf-tqKLkzHih-5I';

router.post('/', async (req, res) => {
  const { origin, destination } = req.body;

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${encodeURIComponent(
      origin
    )}&destinations=${encodeURIComponent(destination)}&key=${GOOGLE_API_KEY}`;

    const response = await axios.get(url);
    const data = response.data;

    if (
      data.rows[0] &&
      data.rows[0].elements[0].status === 'OK'
    ) {
      const distanceInKm = data.rows[0].elements[0].distance.value / 1000;
      const duration = data.rows[0].elements[0].duration.text;

      res.json({ distance: distanceInKm, duration });
    } else {
      res.status(400).json({ error: 'Could not get distance data' });
    }
  } catch (err) {
    console.error('Error fetching distance:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;

