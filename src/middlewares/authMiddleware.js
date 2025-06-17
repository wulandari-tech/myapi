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
                return res.status(401).json({ success: false, message: 'Tidak terautentikasi, user tidak ditemukan' });
            }
            next();
        } catch (error) {
            console.error(error);
            return res.status(401).json({ success: false, message: 'Tidak terautentikasi, token gagal' });
        }
    }
    if (!token) {
        return res.status(401).json({ success: false, message: 'Tidak terautentikasi, tidak ada token' });
    }
};

const checkApiKey = async (req, res, next) => {
    const apiKey = req.query.apiKey || req.headers['x-api-key'];

    if (!apiKey) {
        return res.status(401).json({ success: false, message: 'API Key dibutuhkan' });
    }

    try {
        const user = await User.findOne({ apiKey });
        if (!user) {
            return res.status(403).json({ success: false, message: 'API Key tidak valid' });
        }

        // Cek dan reset limit harian
        const today = new Date().setHours(0, 0, 0, 0);
        const lastRequestDay = user.lastRequestDate ? new Date(user.lastRequestDate).setHours(0,0,0,0) : null;

        if (lastRequestDay !== today) {
            user.requestsToday = 0;
        }

        if (user.requestsToday >= user.apiLimit) {
            return res.status(429).json({ success: false, message: `Limit API harian tercapai (${user.apiLimit}). Silakan upgrade plan Anda atau coba lagi besok.` });
        }

        user.requestsToday += 1;
        user.lastRequestDate = new Date();
        await user.save();

        req.user = user; // Menyimpan info user untuk digunakan di controller API jika perlu
        next();

    } catch (error) {
        console.error('API Key Check Error:', error);
        return res.status(500).json({ success: false, message: 'Server error saat validasi API Key' });
    }
};


module.exports = { protect, checkApiKey };