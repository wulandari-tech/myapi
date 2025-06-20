const User = require('../models/user');
const Transaction = require('../models/transaction');
const { v4: uuidv4 } = require('uuid');

exports.getAdminDashboard = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeSubscriptions = await User.countDocuments({ plan: { $ne: 'free' }, isSuspended: false }); // Hanya yang aktif
        const recentTransactions = await Transaction.find().sort({ createdAt: -1 }).limit(5).populate('userId', 'username email');
        const suspendedUsers = await User.countDocuments({ isSuspended: true });

        res.render('admin/index', {
            title: 'Admin Panel Utama',
            user: req.user,
            stats: {
                totalUsers,
                activeSubscriptions,
                suspendedUsers,
                // Tambahkan statistik lain jika perlu, misal API hits hari ini
            },
            recentTransactions
        });
    } catch (err) {
        console.error('Error loading admin dashboard:', err);
        res.status(500).send('Kesalahan Server Internal');
    }
};

exports.getUsersList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const skip = (page - 1) * limit;
        const searchQuery = req.query.search || '';
        let filter = {};

        if (searchQuery) {
            const searchRegex = new RegExp(searchQuery, 'i');
            filter = {
                $or: [
                    { username: searchRegex },
                    { email: searchRegex },
                    { apiKey: searchRegex }
                ]
            };
        }

        const users = await User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
        const totalUsersInFilter = await User.countDocuments(filter); // Ini yang menjadi totalUsersCount
        const totalPages = Math.ceil(totalUsersInFilter / limit);

        res.render('admin/users-list', {
            title: 'Manajemen Pengguna',
            user: req.user,
            users,
            currentPage: page,
            totalPages,
            limit,
            searchQuery,
            totalUsersCount: totalUsersInFilter // Variabel ini untuk users-list.ejs
        });
    } catch (err) {
        console.error('Error fetching users list:', err);
        res.status(500).send('Kesalahan Server Internal');
    }
};

exports.getUserDetail = async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id);
        if (!targetUser) {
            return res.status(404).render('error', { message: 'Pengguna tidak ditemukan', statusCode: 404, title: 'Error 404' });
        }
        const userTransactions = await Transaction.find({ userId: targetUser._id }).sort({ createdAt: -1 }).limit(10);
        
        res.render('admin/user-detail', {
            title: `Detail Pengguna: ${targetUser.username}`,
            user: req.user,
            targetUser,
            userTransactions
        });
    } catch (err) {
        console.error('Error fetching user detail:', err);
        res.status(500).send('Kesalahan Server Internal');
    }
};

exports.suspendUser = async (req, res) => {
    try {
        const userToSuspend = await User.findById(req.params.id);
        if (!userToSuspend) return res.status(404).send('Pengguna tidak ditemukan');
        if (userToSuspend._id.equals(req.user._id)) return res.status(403).send('Tidak dapat suspend diri sendiri');

        userToSuspend.isSuspended = true;
        await userToSuspend.save();
        res.redirect(req.headers.referer || `/admin/user/${req.params.id}`);
    } catch (err) {
        console.error('Error suspending user:', err);
        res.status(500).send('Kesalahan Server Internal');
    }
};

exports.unsuspendUser = async (req, res) => {
    try {
        const userToUnsuspend = await User.findById(req.params.id);
        if (!userToUnsuspend) return res.status(404).send('Pengguna tidak ditemukan');

        if (!userToUnsuspend.apiKey && userToUnsuspend.isSuspended) {
            userToUnsuspend.apiKey = `wzfc_${uuidv4().replace(/-/g, '')}`;
        }
        userToUnsuspend.isSuspended = false;
        await userToUnsuspend.save();
        res.redirect(req.headers.referer || `/admin/user/${req.params.id}`);
    } catch (err) {
        console.error('Error unsuspending user:', err);
        res.status(500).send('Kesalahan Server Internal');
    }
};

exports.updateUserPlanAndQuota = async (req, res) => {
    const { plan, customQuotaRequests, customQuotaPeriod, subscriptionEndsAt, isLifetime } = req.body;
    const userId = req.params.id;

    try {
        const targetUser = await User.findById(userId);
        if (!targetUser) return res.status(404).send('Pengguna tidak ditemukan');

        targetUser.plan = plan;
        const isLifetimeBool = isLifetime === 'on' || plan.includes('lifetime');
        targetUser.isLifetime = isLifetimeBool;


        if (plan === 'free') {
            targetUser.quota = { requests: 1000, period: 'daily' };
            targetUser.subscriptionEndsAt = null;
        } else {
            targetUser.quota.requests = parseInt(customQuotaRequests) || (plan === 'pro' ? 50000 : (plan === 'enterprise' || plan.includes('lifetime') ? 1000000 : 50000));
            targetUser.quota.period = customQuotaPeriod || 'daily';
            
            if (isLifetimeBool) {
                targetUser.subscriptionEndsAt = null;
            } else if (subscriptionEndsAt) {
                targetUser.subscriptionEndsAt = new Date(subscriptionEndsAt);
            } else {
                const ends = new Date();
                if (targetUser.quota.period === 'monthly' || period === 'monthly' /*dari form checkout*/) { // periode dari form checkout jika ada
                     ends.setMonth(ends.getMonth() + 1);
                } else { // Asumsi daily/yearly maps to yearly subscription by default if not specified
                    ends.setFullYear(ends.getFullYear() + 1);
                }
                targetUser.subscriptionEndsAt = ends;
            }
        }
        await targetUser.save();
        res.redirect(`/admin/user/${userId}`);
    } catch (err) {
        console.error('Error updating user plan/quota:', err);
        res.status(500).send('Kesalahan Server Internal');
    }
};


exports.getApiLogs = async (req, res) => {
    try {
        res.render('admin/api-logs', {
            title: 'Log Permintaan API',
            user: req.user,
            logs: []
        });
    } catch (err) {
        console.error('Error fetching API logs:', err);
        res.status(500).send('Kesalahan Server Internal');
    }
};

exports.getSiteSettings = async (req, res) => {
    try {
        const siteSettings = { siteName: process.env.SITE_NAME || 'Wanzofc API', maintenanceMode: process.env.MAINTENANCE_MODE === 'true' };
        res.render('admin/site-settings', {
            title: 'Pengaturan Situs',
            user: req.user,
            settings: siteSettings
        });
    } catch (err) {
        console.error('Error fetching site settings:', err);
        res.status(500).send('Kesalahan Server Internal');
    }
};

exports.updateSiteSettings = async (req, res) => {
    const { siteName, maintenanceMode } = req.body;
    try {
        console.log('Site settings to be updated (Simulated):', { siteName, maintenanceMode: maintenanceMode === 'on' });
        res.redirect('/admin/settings/site');
    } catch (err) {
        console.error('Error updating site settings:', err);
        res.status(500).send('Kesalahan Server Internal');
    }
};

exports.broadcastMessage = async (req, res) => {
    const { message, targetAudience } = req.body;
    try {
        console.log(`Broadcasting message: "${message}" to ${targetAudience} users.`);
        res.redirect('/admin');
    } catch (err) {
        console.error('Error broadcasting message:', err);
        res.status(500).send('Kesalahan Server Internal');
    }
};

exports.getLiveChatPage = async (req, res) => {
    try {
        res.render('admin/live-chat', {
            title: 'Live Chat Support',
            user: req.user
        });
    } catch (err) {
        console.error('Error rendering admin live chat page:', err);
        res.status(500).send('Kesalahan Server Internal');
    }
};