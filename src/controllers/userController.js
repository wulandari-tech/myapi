const User = require('../models/user');
const { generateApiKey } = require('../utils/apiKeyHelper');

// @desc    Get user profile
// @route   GET /api/user/profile
// @access  Private (butuh token)
const getUserProfile = async (req, res, next) => {
    try {
        // req.user didapat dari middleware 'protect'
        const user = await User.findById(req.user._id).select('-password'); 
        if (user) {
            res.json({
                success: true,
                user
            });
        } else {
            res.status(404).json({ success: false, message: 'User tidak ditemukan' });
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Regenerate API Key
// @route   POST /api/user/regenerate-apikey
// @access  Private
const regenerateApiKey = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        if (user) {
            user.apiKey = generateApiKey(); // Gunakan helper yang sudah dibuat
            await user.save();
            res.json({
                success: true,
                message: 'API Key berhasil diperbarui',
                apiKey: user.apiKey
            });
        } else {
            res.status(404).json({ success: false, message: 'User tidak ditemukan' });
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Upgrade user plan (Contoh, logika pembayaran tidak termasuk)
// @route   POST /api/user/upgrade-plan
// @access  Private
const upgradeUserPlan = async (req, res, next) => {
    const { newPlan } = req.body; // Misal: "Developer" atau "Business"

    if (!newPlan || !['Developer', 'Business'].includes(newPlan)) {
        return res.status(400).json({ success: false, message: 'Plan tidak valid' });
    }

    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
        }

        // Di sini seharusnya ada logika verifikasi pembayaran sebelum upgrade plan
        // Untuk contoh ini, kita langsung upgrade
        user.plan = newPlan;
        // apiLimit akan otomatis terupdate oleh pre-save hook di model User
        await user.save();

        res.json({
            success: true,
            message: `Plan berhasil diupgrade ke ${newPlan}`,
            user: {
                username: user.username,
                plan: user.plan,
                apiLimit: user.apiLimit
            }
        });

    } catch (error) {
        next(error);
    }
};


module.exports = { getUserProfile, regenerateApiKey, upgradeUserPlan };