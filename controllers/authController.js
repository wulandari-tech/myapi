const User = require('../models/user');
const passport = require('passport');
const bcrypt = require('bcryptjs');

exports.getLogin = (req, res) => {
    // const messages = req.flash('error'); // Jika pakai connect-flash
    res.render('auth/login', {
        title: 'Login Wanzofc API',
        // messages: messages // Kirim pesan flash ke view
    });
};

exports.postLogin = (req, res, next) => {
    passport.authenticate('local', {
        successRedirect: '/dashboard',
        failureRedirect: '/auth/login',
        // failureFlash: true // Aktifkan jika pakai connect-flash
    })(req, res, next);
};

exports.getRegister = (req, res) => {
    res.render('auth/register', {
        title: 'Register Wanzofc API',
        // errors: [] // Untuk menampilkan error validasi jika ada
    });
};

exports.postRegister = async (req, res) => {
    const { username, email, password, password2 } = req.body;
    let errors = [];

    if (!username || !email || !password || !password2) {
        errors.push({ msg: 'Harap isi semua field.' });
    }
    if (password !== password2) {
        errors.push({ msg: 'Konfirmasi password tidak cocok.' });
    }
    if (password.length < 6) {
        errors.push({ msg: 'Password minimal 6 karakter.' });
    }

    if (errors.length > 0) {
        return res.render('auth/register', {
            title: 'Register Wanzofc API',
            errors, username, email
        });
    }

    try {
        let user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
            errors.push({ msg: 'Email sudah terdaftar.' });
            return res.render('auth/register', {
                title: 'Register Wanzofc API',
                errors, username, email
            });
        }
        user = await User.findOne({ username: username });
        if (user) {
            errors.push({ msg: 'Username sudah digunakan.' });
            return res.render('auth/register', {
                title: 'Register Wanzofc API',
                errors, username, email
            });
        }

        const newUser = new User({ username, email, password });
        // API Key akan digenerate otomatis oleh pre-save hook
        // Password akan di-hash otomatis oleh pre-save hook

        await newUser.save();
        // req.flash('success_msg', 'Registrasi berhasil! Silakan login.'); // Jika pakai connect-flash
        console.log('User registered successfully, redirecting to login');
        res.redirect('/auth/login');

    } catch (err) {
        console.error(err);
        errors.push({ msg: 'Terjadi kesalahan server.' });
        res.render('auth/register', {
            title: 'Register Wanzofc API',
            errors, username, email
        });
    }
};

exports.googleCallback = (req, res) => {
    res.redirect('/dashboard');
};

exports.logout = (req, res, next) => {
    req.logout(function(err) {
        if (err) { return next(err); }
        // req.flash('success_msg', 'Anda berhasil logout.');
        console.log('User logged out, redirecting to login');
        res.redirect('/auth/login');
    });
};