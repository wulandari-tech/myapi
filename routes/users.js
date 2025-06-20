const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const userController = require('../controllers/userController');

router.get('/', ensureAuthenticated, userController.getDashboard);
router.post('/generate-key', ensureAuthenticated, userController.generateNewApiKey);
router.post('/edit-profile', ensureAuthenticated, userController.editProfile);
router.post('/customize-key', ensureAuthenticated, userController.customizeApiKey);

module.exports = router;