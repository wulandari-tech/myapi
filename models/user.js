const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username diperlukan'],
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email diperlukan'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/\S+@\S+\.\S+/, 'Format email tidak valid']
    },
    password: {
        type: String,
    },
    googleId: {
        type: String,
    },
    apiKey: {
        type: String,
        unique: true,
    },
    quota: {
        requests: { type: Number, default: 1000 },
        period: { type: String, default: 'daily', enum: ['daily', 'monthly'] }
    },
    apiUsage: [{
        date: { type: Date, default: Date.now },
        endpoint: String,
        count: { type: Number, default: 0 }
    }],
    plan: {
        type: String,
        enum: ['free', 'pro', 'enterprise', 'lifetime_pro'],
        default: 'free'
    },
    subscriptionEndsAt: {
        type: Date,
        default: null
    },
    isLifetime: {
        type: Boolean,
        default: false
    },
    isAdmin: { // Peran admin
        type: Boolean,
        default: false
    },
    isSuspended: {
        type: Boolean,
        default: false
    },
    profile: {
        displayName: String,
        avatarUrl: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

UserSchema.pre('save', async function(next) {
    if (this.isModified('password') && this.password) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    if (!this.apiKey) {
        this.apiKey = `wzfc_${uuidv4().replace(/-/g, '')}`;
    }
    this.updatedAt = Date.now();
    next();
});

UserSchema.methods.matchPassword = async function(enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);