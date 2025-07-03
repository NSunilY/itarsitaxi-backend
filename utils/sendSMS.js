const axios = require('axios');

const sendSMS = async (message, numbers) => {
  const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;

  try {
    const res = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      {
        route: 'v3',
        sender_id: 'TXTIND',
        message,
        language: 'english',
        numbers,
      },
      {
        headers: {
          authorization: FAST2SMS_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('SMS Sent:', res.data);
    return res.data;
  } catch (error) {
    console.error('SMS sending failed:', error.response?.data || error.message);
  }
};

module.exports = sendSMS;

