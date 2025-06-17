const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  orderId: { 
    type: String,
    required: true,
    unique: true,
  },
  plan: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'IDR',
  },
  paymentMethod: {
    type: String, 
    enum: ['ORKUT_QRIS', 'MIDTRANS_GOPAY', 'MIDTRANS_BANK_TRANSFER', 'MIDTRANS_SNAP', 'OTHER'],
    required: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED', 'CANCELED'],
    default: 'PENDING',
  },
  qrisImageUrl: {
    type: String, 
  },
  qrisString: {
    type: String,
  },
  qrisExpiredAt: {
    type: Date,
  },
  midtransTransactionId: {
    type: String,
  },
  midtransRedirectUrl: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

transactionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;