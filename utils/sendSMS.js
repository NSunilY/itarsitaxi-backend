// utils/sendSMS.js
const axios = require('axios');

const sendSMS = async (number, message) => {
  try {
    const res = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      {
        message,
        language: 'english', // ✅ Must be 'english', not 'unicode'
        route: 'q',           // ✅ Quick SMS Route
        numbers: number,
      },
      {
        headers: {
          authorization: process.env.FAST2SMS_API_KEY,
        },
      }
    );

    console.log(`✅ SMS sent to ${number}:`, res.data);
  } catch (err) {
    console.error(`❌ SMS sending failed to ${number}:`, err.response?.data || err.message);
  }
};

module.exports = sendSMS;

