const User = require('../models/user');
const Transaction = require('../models/transaction');
const { createDynamicOrkutQris, checkOrkutQrisPaymentStatus } = require('../helpers/orkutQrisHelper');

const PLAN_PRICES = {
    free: {
        monthly: 0,
        yearly: 0,
        lifetime: 0
    },
    pro: {
        monthly: 75000,
        yearly: 720000,
        lifetime: 1500000
    },
    enterprise: {
        monthly: null,
        yearly: null,
        lifetime: null
    }
};

const getPlanDetails = (plan, period) => {
    const periodNames = { monthly: 'Bulanan', yearly: 'Tahunan', lifetime: 'Sekali Bayar' };
    const planNames = { free: 'Gratis', pro: 'Pro', enterprise: 'Enterprise' };

    if (!PLAN_PRICES[plan] || (PLAN_PRICES[plan][period] === null && plan === 'enterprise')) {
        return null;
    }
    if (PLAN_PRICES[plan][period] === null && plan !== 'enterprise') {
        return null;
    }

    const baseAmount = PLAN_PRICES[plan][period];
    let feeAmount = 0;
    let totalAmount = baseAmount;

    if (baseAmount > 0) {
        const feePercentage = parseFloat(process.env.ORKUT_QRIS_FEE_PERCENTAGE_FOR_DEPOSIT || process.env.ORKUT_QRIS_FEE_PERCENTAGE || 0.7);
        const feeIsByCustomer = process.env.ORKUT_QRIS_FEE_BY_CUSTOMER_DEPOSIT === 'true';

        if (feeIsByCustomer && feePercentage > 0) {
            feeAmount = Math.ceil(baseAmount * (feePercentage / 100));
            totalAmount = baseAmount + feeAmount;
        } else if (!feeIsByCustomer && feePercentage > 0) {
            feeAmount = Math.ceil(baseAmount * (feePercentage / 100));
        }
    }

    return {
        plan,
        period,
        planName: planNames[plan] || plan,
        periodName: periodNames[period] || period,
        baseAmount,
        feeAmount,
        totalAmount
    };
};

exports.showCheckoutPage = async (req, res) => {
    const { plan, period } = req.body;
    const userId = req.user.id;

    const planDetails = getPlanDetails(plan, period);

    if (!planDetails || (plan === 'enterprise' && planDetails.baseAmount === null) ) {
        console.error(`Invalid plan or period for checkout by user ${userId}: ${plan}, ${period}`);
        return res.redirect('/pricing');
    }

    if (plan === 'free' && planDetails.baseAmount === 0) {
        try {
            const user = await User.findById(userId);
            if (user) {
                user.plan = 'free';
                user.subscriptionEndsAt = null;
                user.isLifetime = false; // Pastikan ini direset jika beralih ke gratis
                user.quota = { requests: 1000, period: 'daily' };
                await user.save();
                return res.redirect('/dashboard');
            }
        } catch (error) {
            console.error('Error updating user to free plan:', error);
            return res.redirect('/pricing');
        }
    }

    res.render('payment/checkout', {
        title: 'Konfirmasi Pembayaran',
        user: req.user,
        planDetails
    });
};

// ... bagian atas controller sama ...

exports.createQrisPayment = async (req, res) => {
    const { plan, period, amount, originalAmount } = req.body;
    const userId = req.user.id;
    const totalAmountToPay = parseInt(amount);
    const baseOriginalAmount = parseInt(originalAmount);

    if (isNaN(totalAmountToPay) || totalAmountToPay <= 0 || (plan !== 'free' && isNaN(baseOriginalAmount))) {
        console.error(`Invalid amount for QRIS creation by user ${userId}: amount=${amount}, originalAmount=${originalAmount}`);
        return res.redirect('/pricing');
    }

    const transactionName = `Pembayaran Paket ${plan.toUpperCase()} (${period})`;

    try {
        const qrisResult = await createDynamicOrkutQris(baseOriginalAmount, transactionName);
        // console.log("QRIS Result from helper in createQrisPayment:", qrisResult); // Untuk debugging jika perlu

        if (!qrisResult.success || !qrisResult.orkutReffId) { // Periksa orkutReffId
            console.error("QRIS Creation Failed from helper, orkutReffId missing or success false:", qrisResult);
            return res.redirect('/pricing');
        }

        const newTransaction = new Transaction({
            userId,
            orkutReffId: qrisResult.orkutReffId, // Pastikan ini diisi dengan nilai valid
            plan,
            period,
            originalAmount: qrisResult.originalAmount,
            feeAmount: qrisResult.feeAmount,
            amountToPay: qrisResult.amountToPayWithFee,
            qrImageUrl: qrisResult.qrImageUrl,
            qrString: qrisResult.qrString,
            expiredAt: qrisResult.expiredAt,
            status: 'pending',
            lastCheckedTimestamp: new Date()
        });

        await newTransaction.save();
        res.redirect(`/payment/pending/${newTransaction._id}`);

    } catch (error) {
        console.error('Error creating QRIS payment:', error);
        if (error.code === 11000) {
             console.error('Duplicate key error. Key pattern:', error.keyPattern, 'Key value:', error.keyValue);
        }
        res.redirect('/pricing');
    }
};

// ... sisa controller sama ...

exports.showPendingPage = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.transactionId).populate('userId');
        if (!transaction || transaction.userId._id.toString() !== req.user.id) {
            return res.redirect('/dashboard');
        }

        if (transaction.status === 'paid') {
            return res.redirect(`/payment/success/${transaction._id}`);
        }
        if (transaction.status === 'expired' || transaction.status === 'failed') {
            return res.redirect(`/payment/failed/${transaction._id}`);
        }
        if (new Date() > new Date(transaction.expiredAt)) {
            transaction.status = 'expired';
            await transaction.save();
            return res.redirect(`/payment/failed/${transaction._id}`);
        }

        res.render('payment/pending', {
            title: 'Menunggu Pembayaran',
            transaction
        });
    } catch (error) {
        console.error('Error showing pending page:', error);
        res.redirect('/dashboard');
    }
};

exports.checkPaymentStatus = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.transactionId);

        if (!transaction || transaction.userId.toString() !== req.user.id) {
            return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
        }

        if (transaction.status === 'paid') {
            return res.json({ success: true, status: 'paid', message: 'Pembayaran sudah berhasil.' });
        }
        if (transaction.status === 'expired' || transaction.status === 'failed') {
            return res.json({ success: true, status: transaction.status, message: 'Transaksi gagal atau kedaluwarsa.' });
        }
        if (new Date() > new Date(transaction.expiredAt)) {
            transaction.status = 'expired';
            await transaction.save();
            return res.json({ success: true, status: 'expired', message: 'Waktu pembayaran telah habis.' });
        }

        const statusCheckResult = await checkOrkutQrisPaymentStatus(
            transaction.orkutReffId,
            transaction.amountToPay,
            transaction.lastCheckedTimestamp
        );
        
        transaction.lastCheckedTimestamp = new Date();

        if (statusCheckResult.success && statusCheckResult.isPaid) {
            transaction.status = 'paid';
            transaction.paidAt = new Date();
            transaction.okeConnectTransactionData = statusCheckResult.transaction;
            await transaction.save();

            const user = await User.findById(req.user.id);
            if (user) {
                user.plan = transaction.plan;
                user.isLifetime = transaction.period === 'lifetime';

                if (transaction.period === 'lifetime') {
                    user.subscriptionEndsAt = null;
                } else {
                    const ends = (user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) > new Date() && !user.isLifetime) ? new Date(user.subscriptionEndsAt) : new Date();
                    if (transaction.period === 'yearly') {
                        ends.setFullYear(ends.getFullYear() + 1);
                    } else if (transaction.period === 'monthly') {
                        ends.setMonth(ends.getMonth() + 1);
                    }
                    user.subscriptionEndsAt = ends;
                }
                
                if (transaction.plan === 'pro') {
                    user.quota = { requests: 50000, period: 'daily' };
                } else if (transaction.plan === 'enterprise') {
                    user.quota = { requests: 1000000, period: 'daily' };
                } else {
                    user.quota = { requests: 1000, period: 'daily' };
                }

                await user.save();
            }

            return res.json({ success: true, status: 'paid', message: 'Pembayaran berhasil!' });
        } else {
            await transaction.save();
            return res.json({ success: true, status: 'pending', message: statusCheckResult.message || 'Pembayaran masih tertunda.' });
        }

    } catch (error) {
        console.error('Error checking payment status:', error);
        res.status(500).json({ success: false, message: 'Kesalahan server saat memeriksa status.' });
    }
};

exports.showSuccessPage = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.transactionId).populate('userId');
        if (!transaction || transaction.userId._id.toString() !== req.user.id || transaction.status !== 'paid') {
            return res.redirect('/dashboard');
        }
        res.render('payment/success', {
            title: 'Pembayaran Berhasil',
            transaction
        });
    } catch (error) {
        console.error('Error showing success page:', error);
        res.redirect('/dashboard');
    }
};

exports.showFailedPage = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.transactionId).populate('userId');
         if (!transaction || transaction.userId._id.toString() !== req.user.id) {
            return res.redirect('/dashboard');
        }
        if (transaction.status !== 'expired' && transaction.status !== 'failed') {
            if (new Date() < new Date(transaction.expiredAt) && transaction.status === 'pending') {
                return res.redirect(`/payment/pending/${transaction._id}`);
            }
            if (transaction.status === 'paid') {
                return res.redirect(`/payment/success/${transaction._id}`);
            }
        }

        res.render('payment/failed', {
            title: 'Pembayaran Gagal',
            transaction
        });
    } catch (error) {
        console.error('Error showing failed page:', error);
        res.redirect('/dashboard');
    }
};