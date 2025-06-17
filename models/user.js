const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const generateApiKey = require('../utils/generateApiKey');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  apiKey: {
    type: String,
    unique: true,
    default: () => generateApiKey(),
  },
  customApiKey: {
    type: String,
    unique: true,
    sparse: true, 
    trim: true,
    default: null,
  },
  plan: {
    type: String,
    enum: ['Free', 'Developer', 'Business', 'Admin'],
    default: 'Free',
  },
  apiLimit: {
    type: Number,
    default: () => parseInt(process.env.DEFAULT_API_LIMIT_FREE) || 100,
  },
  requestsToday: {
    type: Number,
    default: 0,
  },
  lastRequestDate: {
    type: Date,
    default: Date.now,
  },
  planExpirationDate: {
    type: Date,
    default: null,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  isBanned: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  _2faSecret: {
    type: String,
    default: null
  },
  _2faEnabled: {
    type: Boolean,
    default: false
  }
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.getActiveApiKey = function() {
  return this.customApiKey || this.apiKey;
};

const User = mongoose.model('User', userSchema);

module.exports = User;