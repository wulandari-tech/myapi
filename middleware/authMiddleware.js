const jwt = require('jsonwebtoken');
const User = require('../models/user');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }
      if (req.user.isBanned) {
        return res.status(403).json({ success: false, message: 'User is banned' });
      }
      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Not authorized as an admin' });
  }
};


const checkApiLimit = async (req, res, next) => {
    const apiKey = req.query.apiKey || req.body.apiKey || req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({ success: false, message: 'API Key required' });
    }

    const user = await User.findOne({ $or: [{ apiKey: apiKey }, { customApiKey: apiKey }] });

    if (!user) {
        return res.status(403).json({ success: false, message: 'Invalid API Key' });
    }
    if (user.isBanned) {
        return res.status(403).json({ success: false, message: 'User associated with this API Key is banned' });
    }

    const today = new Date().setHours(0, 0, 0, 0);
    const lastRequestDay = new Date(user.lastRequestDate).setHours(0, 0, 0, 0);

    if (lastRequestDay < today) {
        user.requestsToday = 0;
    }

    if (user.requestsToday >= user.apiLimit) {
        return res.status(429).json({ success: false, message: 'API request limit exceeded for today.' });
    }

    user.requestsToday += 1;
    user.lastRequestDate = new Date();
    await user.save();
    
    req.apiUser = user; 
    next();
};


module.exports = { protect, admin, checkApiLimit };