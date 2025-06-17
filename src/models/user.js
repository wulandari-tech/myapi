const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username wajib diisi'],
        unique: true,
        trim: true,
        minlength: 3
    },
    email: {
        type: String,
        required: [true, 'Email wajib diisi'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+\@.+\..+/, 'Format email tidak valid']
    },
    password: {
        type: String,
        required: [true, 'Password wajib diisi'],
        minlength: 6,
        select: false 
    },
    apiKey: {
        type: String,
        unique: true,
        default: () => `wanzofc-${uuidv4()}` 
    },
    plan: {
        type: String,
        enum: ['Free', 'Developer', 'Business'],
        default: 'Free'
    },
    apiLimit: { 
        type: Number,
        default: () => parseInt(process.env.API_LIMIT_FREE)
    },
    requestsToday: {
        type: Number,
        default: 0
    },
    lastRequestDate: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', function(next) {
    if (this.isModified('plan')) {
        switch (this.plan) {
            case 'Developer':
                this.apiLimit = parseInt(process.env.API_LIMIT_DEVELOPER);
                break;
            case 'Business':
                this.apiLimit = parseInt(process.env.API_LIMIT_BUSINESS);
                break;
            default: // Free
                this.apiLimit = parseInt(process.env.API_LIMIT_FREE);
        }
    }
    next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;