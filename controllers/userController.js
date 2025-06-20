const User = require('../models/user');
const { v4: uuidv4 } = require('uuid');

exports.getDashboard = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.redirect('/auth/login');
        }

        const totalUsage = user.apiUsage.reduce((acc, curr) => acc + curr.count, 0);
        const usageLast7Days = user.apiUsage
            .filter(u => new Date(u.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
            .reduce((acc, curr) => acc + curr.count, 0);

        res.render('dashboard/index', {
            title: 'Dashboard Pengguna',
            user: user,
            stats: {
                total: totalUsage,
                last7Days: usageLast7Days,
            }
        });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
};

exports.generateNewApiKey = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).redirect('/dashboard');
        }
        user.apiKey = `wzfc_${uuidv4().replace(/-/g, '')}`;
        await user.save();
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard');
    }
};

exports.editProfile = async (req, res) => {
    const { displayName } = req.body;
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
             return res.status(404).redirect('/dashboard');
        }
        user.profile.displayName = displayName || user.profile.displayName;
        await user.save();
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard');
    }
};

exports.customizeApiKey = async (req, res) => {
    const { customPart } = req.body;
    const userId = req.user.id;

    if (req.user.plan === 'free') {
        return res.status(403).redirect('/dashboard');
    }

    if (!customPart || !/^[a-zA-Z0-9]{10,30}$/.test(customPart)) {
        return res.status(400).redirect('/dashboard');
    }

    const newApiKey = `wzfc_${customPart}`;

    try {
        const existingUserWithKey = await User.findOne({ apiKey: newApiKey });
        if (existingUserWithKey && existingUserWithKey._id.toString() !== userId) {
            return res.status(409).redirect('/dashboard');
        }

        await User.findByIdAndUpdate(userId, { apiKey: newApiKey });
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error customizing API Key:', error);
        res.status(500).redirect('/dashboard');
    }
};