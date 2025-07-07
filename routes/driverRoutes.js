// routes/driverRoutes.js
const express = require('express');
const router = express.Router();
const Driver = require('../models/Driver');

// Get all drivers
router.get('/', async (req, res) => {
  try {
    const drivers = await Driver.find().sort({ createdAt: -1 });
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch drivers.' });
  }
});

// Add new driver
router.post('/', async (req, res) => {
  try {
    const newDriver = new Driver(req.body);
    const savedDriver = await newDriver.save();
    res.status(201).json(savedDriver);
  } catch (err) {
    console.error('Add driver error:', err.message);
    res.status(500).json({ error: 'Failed to add driver.' });
  }
});

// Update driver
router.put('/:id', async (req, res) => {
  try {
    const updatedDriver = await Driver.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedDriver);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update driver.' });
  }
});

// Delete driver
router.delete('/:id', async (req, res) => {
  try {
    await Driver.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete driver.' });
  }
});

module.exports = router;

