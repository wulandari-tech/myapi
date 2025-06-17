const User = require('../models/user');
const jwt = require('jsonwebtoken');
const { generateApiKey } = require('../utils/apiKeyHelper');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });
};

// @desc    Register user baru
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ success: false, message: 'Harap isi semua field' });
    }

    try {
        const userExists = await User.findOne({ $or: [{ email }, { username }] });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'Email atau Username sudah terdaftar' });
        }

        const user = await User.create({
            username,
            email,
            password,
            // apiKey akan digenerate oleh default schema
        });

        if (user) {
            const token = generateToken(user._id);
            res.status(201).json({
                success: true,
                message: 'Registrasi berhasil',
                token,
                user: {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    apiKey: user.apiKey,
                    plan: user.plan
                }
            });
        } else {
            res.status(400).json({ success: false, message: 'Data pengguna tidak valid' });
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
        return res.status(400).json({ success: false, message: 'Harap isi email/username dan password' });
    }

    try {
        const user = await User.findOne({
            $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
        }).select('+password'); // Penting untuk mengambil field password

        if (user && (await user.matchPassword(password))) {
            const token = generateToken(user._id);
            res.json({
                success: true,
                message: 'Login berhasil',
                token,
                user: {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    apiKey: user.apiKey,
                    plan: user.plan
                }
            });
        } else {
            res.status(401).json({ success: false, message: 'Email/Username atau Password salah' });
        }
    } catch (error) {
        next(error);
    }
};

module.exports = { registerUser, loginUser };