const express = require('express');
const passport = require('passport');
const router = express.Router();
const authController = require('../controllers/authController');
const { ensureGuest, ensureAuthenticated } = require('../middleware/authMiddleware');

// @desc    Halaman Login
// @route   GET /auth/login
router.get('/login', ensureGuest, authController.getLogin);

// @desc    Proses Login Manual
// @route   POST /auth/login
router.post('/login', ensureGuest, authController.postLogin);

// @desc    Halaman Register
// @route   GET /auth/register
router.get('/register', ensureGuest, authController.getRegister);

// @desc    Proses Register Manual
// @route   POST /auth/register
router.post('/register', ensureGuest, authController.postRegister);

// @desc    Autentikasi dengan Google
// @route   GET /auth/google
router.get('/google', ensureGuest, passport.authenticate('google', { scope: ['profile', 'email'] }));

// @desc    Google Auth Callback
// @route   GET /auth/google/callback
router.get(
    '/google/callback',
    passport.authenticate('google', { failureRedirect: '/auth/login' }),
    authController.googleCallback
);

// @desc    Logout User
// @route   GET /auth/logout
router.get('/logout', ensureAuthenticated, authController.logout);

module.exports = router;