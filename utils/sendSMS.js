// utils/sendSMS.js
const axios = require('axios');

const sendSMS = async (message, numbers) => {
  try {
    const res = await axios.post('https://www.fast2sms.com/dev/bulkV2',
      {
        message,
        language: 'english',
        route: 'q',
        numbers: numbers.join(','),
      },
      {
        headers: {
          authorization: process.env.FAST2SMS_API_KEY,
        },
      }
    );

    console.log('✅ SMS sent:', res.data);
  } catch (err) {
    console.error('❌ SMS sending failed:', err.response?.data || err.message);
  }
};

module.exports = sendSMS;

