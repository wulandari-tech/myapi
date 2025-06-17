const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Transaction = require('../models/transaction');
const { protect } = require('../middleware/authMiddleware');
const generateApiKeyUtil = require('../utils/generateApiKey');

router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
      const today = new Date().setHours(0, 0, 0, 0);
      const lastRequestDay = new Date(user.lastRequestDate).setHours(0, 0, 0, 0);
      let requestsToday = user.requestsToday;
      if (lastRequestDay < today) {
        requestsToday = 0;
      }

      res.json({
        success: true,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          apiKey: user.apiKey,
          customApiKey: user.customApiKey,
          activeApiKey: user.getActiveApiKey(),
          plan: user.plan,
          apiLimit: user.apiLimit,
          requestsToday: requestsToday,
          planExpirationDate: user.planExpirationDate,
          role: user.role,
          createdAt: user.createdAt,
        },
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

router.post('/regenerate-apikey', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.apiKey = generateApiKeyUtil();
      await user.save();
      res.json({ success: true, apiKey: user.apiKey, message: 'API Key regenerated successfully' });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

router.post('/set-custom-apikey', protect, async (req, res) => {
    const { customKey } = req.body;
    if (!customKey || customKey.trim().length < 10 || customKey.trim().length > 64) {
        return res.status(400).json({ success: false, message: 'Custom API Key must be between 10 and 64 characters.' });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(customKey.trim())) {
        return res.status(400).json({ success: false, message: 'Custom API Key can only contain alphanumeric characters, underscores, and hyphens.' });
    }

    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        if (user.plan === 'Free') {
            return res.status(403).json({ success: false, message: 'Custom API Key feature is not available for Free plan.' });
        }
        
        if (user.planExpirationDate && new Date(user.planExpirationDate) < new Date()) {
             return res.status(403).json({ success: false, message: 'Your paid plan has expired. Renew to set custom API Key.' });
        }

        const existingKeyUser = await User.findOne({ customApiKey: customKey.trim() });
        if (existingKeyUser && existingKeyUser._id.toString() !== user._id.toString()) {
            return res.status(400).json({ success: false, message: 'This Custom API Key is already in use.' });
        }
        
        if (user.apiKey === customKey.trim()) {
             return res.status(400).json({ success: false, message: 'Custom API Key cannot be the same as your default API Key.' });
        }

        user.customApiKey = customKey.trim();
        await user.save();
        res.json({ success: true, customApiKey: user.customApiKey, message: 'Custom API Key set successfully.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error setting custom API Key.' });
    }
});


router.post('/upgrade-plan', protect, async (req, res) => {
  const { newPlan, paymentDetails } = req.body; 
  
  if (!newPlan || (newPlan !== 'Developer' && newPlan !== 'Business')) {
    return res.status(400).json({ success: false, message: 'Invalid plan selected.' });
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  if (user.plan === newPlan && user.planExpirationDate && new Date(user.planExpirationDate) > new Date()) {
      return res.status(400).json({ success: false, message: `You are already on the ${newPlan} plan.` });
  }

  let planPrice = 0;
  let newApiLimit = 0;

  if (newPlan === 'Developer') {
    planPrice = 5000; 
    newApiLimit = parseInt(process.env.DEFAULT_API_LIMIT_DEVELOPER) || 5000;
  } else if (newPlan === 'Business') {
    planPrice = 10000;
    newApiLimit = parseInt(process.env.DEFAULT_API_LIMIT_BUSINESS) || 50000;
  }
  
  res.json({ 
      success: true, 
      message: `Proceed to payment for ${newPlan} plan. Price: IDR ${planPrice}. This endpoint is a placeholder. Payment integration (Orkut/Midtrans) required.`,
      plan: newPlan,
      price: planPrice,
      apiLimit: newApiLimit
    });
});


module.exports = router;