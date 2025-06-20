const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orkutReffId: { // Field ini harus unik dan diisi
        type: String,
        required: true,
        unique: true,
        index: true // Mongoose akan mencoba membuat index ini jika belum ada
    },
    plan: {
        type: String,
        required: true
    },
    period: {
        type: String,
        required: true
    },
    originalAmount: {
        type: Number,
        required: true
    },
    feeAmount: {
        type: Number,
        default: 0
    },
    amountToPay: {
        type: Number,
        required: true
    },
    qrImageUrl: {
        type: String
    },
    qrString: {
        type: String
    },
    status: {
        type: String,
        default: 'pending',
        enum: ['pending', 'paid', 'expired', 'failed', 'refunded']
    },
    paymentMethod: {
        type: String,
        default: 'ORKUT_QRIS'
    },
    expiredAt: {
        type: Date
    },
    paidAt: {
        type: Date
    },
    okeConnectTransactionData: {
        type: Object
    },
    lastCheckedTimestamp: {
        type: Date
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

TransactionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Transaction', TransactionSchema);