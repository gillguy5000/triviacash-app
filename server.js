require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Catalog for packages, tournament passes, and donations
const PACKAGES = {
  // Coin Store
  'starter': { name: 'Starter Pack (50 Coins)', amount: 200, coins: 50 },
  'pro': { name: 'Pro Pack (150 Coins)', amount: 500, coins: 150 },
  'champion': { name: 'Champion Pack (500 Coins)', amount: 1300, coins: 500 },

  // Tournament Passes
  'weekly_pass': { name: 'Weekly Tournament Pass', amount: 300, coins: 0 },
  'five_month_pass': { name: '5-Month Major Pass', amount: 1200, coins: 100 },
  'yearly_pass': { name: 'Yearly Championship Pass', amount: 2500, coins: 300 },

  // Donation Tier
  'donation_supporter': { name: 'Community Supporter Donation', amount: 250, coins: 25 }
};

// Middleware to get Safaricom M-Pesa OAuth Access Token
async function getMpesaAccessToken(req, res, next) {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    return res.status(500).json({ error: 'M-Pesa Consumer credentials missing in server config.' });
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  try {
    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      { headers: { Authorization: `Basic ${auth}` } }
    );
    req.mpesaAccessToken = response.data.access_token;
    next();
  } catch (error) {
    console.error('M-Pesa Auth Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to authenticate with Safaricom M-Pesa.' });
  }
}

// Route: Initiate M-Pesa STK Push
app.post('/api/mpesa-checkout', getMpesaAccessToken, async (req, res) => {
  try {
    const { phone, packageId, customAmount } = req.body;
    let pkg = PACKAGES[packageId];

    // Handle custom donation amounts
    if (packageId === 'custom_donation') {
      const amt = parseInt(customAmount, 10);
      if (!amt || amt < 50) {
        return res.status(400).json({ error: 'Custom donation must be at least KSh 50.' });
      }
      pkg = { name: 'Custom Creator Donation', amount: amt, coins: Math.floor(amt / 10) };
    }

    if (!pkg) {
      return res.status(400).json({ error: 'Invalid item selection.' });
    }

    if (!phone || !/^(2547|2541)\d{8}$/.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format. Must start with 2547... or 2541...' });
    }

    const date = new Date();
    const timestamp =
      date.getFullYear().toString() +
      String(date.getMonth() + 1).padStart(2, '0') +
      String(date.getDate()).padStart(2, '0') +
      String(date.getHours()).padStart(2, '0') +
      String(date.getMinutes()).padStart(2, '0') +
      String(date.getSeconds()).padStart(2, '0');

    const shortCode = process.env.MPESA_SHORTCODE || '174379';
    const passkey = process.env.MPESA_PASSKEY;
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

    const payload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: pkg.amount,
      PartyA: phone,
      PartyB: shortCode,
      PhoneNumber: phone,
      CallBackURL: 'https://example.com/api/mpesa-callback',
      AccountReference: 'TriviaClash',
      TransactionDesc: `Purchase ${pkg.name}`
    };

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      payload,
      { headers: { Authorization: `Bearer ${req.mpesaAccessToken}` } }
    );

    res.json({
      success: true,
      message: 'STK push triggered successfully on phone.',
      coins: pkg.coins,
      itemName: pkg.name,
      amount: pkg.amount,
      data: response.data
    });
  } catch (error) {
    console.error('STK Push Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to trigger M-Pesa STK push.' });
  }
});

// Fallback Route
const fs = require('fs');

// API Endpoint to send saved trivia questions to frontend
app.get('/api/questions', (req, res) => {
  const questionsPath = path.join(__dirname, 'questions.json');
  
  if (fs.existsSync(questionsPath)) {
    const rawData = fs.readFileSync(questionsPath);
    const questions = JSON.parse(rawData);
    res.json(questions);
  } else {
    // Return default backup questions if file isn't generated yet
    res.json([
      { q: "What is the capital city of Kenya?", options: ["Mombasa", "Kisumu", "Nairobi", "Nakuru"], answer: 2 },
      { q: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], answer: 1 }
    ]);
  }
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
