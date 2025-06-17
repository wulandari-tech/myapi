const express = require('express');
const { getUserProfile, regenerateApiKey, upgradeUserPlan } = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');
const router = express.Router();

router.get('/profile', protect, getUserProfile);
router.post('/regenerate-apikey', protect, regenerateApiKey);
router.post('/upgrade-plan', protect, upgradeUserPlan); // Rute untuk upgrade

module.exports = router;