const User = require('../models/user');
const rateLimit = require('express-rate-limit');
const checkApiKey = async (req, res, next) => {
    const apiKey = req.header('X-API-KEY') || req.query.apikey; 
    if (!apiKey) {
        return res.status(401).json({ success: false, message: 'API Key tidak ditemukan.' });
    }

    try {
        const user = await User.findOne({ apiKey: apiKey });
        if (!user) {
            return res.status(403).json({ success: false, message: 'API Key tidak valid.' });
        }

        // Simpan user ke request untuk digunakan di rate limiter atau controller
        req.userContext = user; // Jangan pakai req.user agar tidak bentrok dengan passport

        // Implementasi Cek Quota (Sederhana)
        const today = new Date().setHours(0, 0, 0, 0);
        let usageToday = user.apiUsage.find(u => new Date(u.date).setHours(0,0,0,0) === today);

        if (usageToday && usageToday.count >= user.quota.requests) {
             return res.status(429).json({ success: false, message: `Quota harian (${user.quota.requests}) telah tercapai.` });
        }

        if (!usageToday) {
            user.apiUsage.push({ date: new Date(), count: 1 });
        } else {
            usageToday.count++;
        }
        await user.save();

        next();
    } catch (error) {
        console.error("API Key Check Error:", error);
        return res.status(500).json({ success: false, message: 'Kesalahan server saat validasi API Key.' });
    }
};

// Rate Limiter per User (berdasarkan API Key yang valid)
const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: (req, res) => {
      // Ambil dari userContext yang sudah divalidasi oleh checkApiKey
      if (req.userContext && req.userContext.plan === 'pro') return 200;
      if (req.userContext && req.userContext.plan === 'enterprise') return 1000;
      return 50; // Default untuk free plan
    },
    message: { success: false, message: 'Terlalu banyak request, coba lagi nanti.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, res) => req.header('X-API-KEY') || req.query.apikey, 
});


module.exports = { checkApiKey, apiRateLimiter };