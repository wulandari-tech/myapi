const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureAdmin } = require('../middleware/authMiddleware');
const adminController = require('../controllers/adminController');

// Middleware untuk semua rute admin
router.use(ensureAuthenticated, ensureAdmin);

// Dashboard Utama Admin
router.get('/', adminController.getAdminDashboard);

// Manajemen Pengguna
router.get('/users', adminController.getUsersList); // Menampilkan daftar semua pengguna dengan paginasi & search
router.get('/user/:id', adminController.getUserDetail); // Menampilkan detail satu pengguna
router.post('/user/:id/suspend', adminController.suspendUser); // Suspend pengguna
router.post('/user/:id/unsuspend', adminController.unsuspendUser); // Aktifkan kembali pengguna
router.post('/user/:id/update-plan-quota', adminController.updateUserPlanAndQuota); // Update plan, kuota, dan status langganan

// Log API (Placeholder, perlu implementasi lebih lanjut)
router.get('/api-logs', adminController.getApiLogs);

// Pengaturan Situs
router.get('/settings/site', adminController.getSiteSettings); // Menampilkan halaman pengaturan situs
router.post('/settings/site', adminController.updateSiteSettings); // Memperbarui pengaturan situs

// Broadcast Pesan
router.post('/broadcast', adminController.broadcastMessage); // Mengirim pesan broadcast ke pengguna

// Live Chat Support
router.get('/live-chat', adminController.getLiveChatPage); // Menampilkan halaman live chat untuk admin

module.exports = router;