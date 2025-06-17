const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/user');
const Transaction = require('../models/transaction');
const { v4: uuidv4 } = require('uuid');
const { createDynamicOrkutQris, checkOrkutQrisPaymentStatus } = require('../utils/orkutQrisProcessor'); 
const midtransClient = require('midtrans-client');

let snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

router.post('/initiate', protect, async (req, res) => {
    const { plan, paymentMethod } = req.body; 
    const userId = req.user._id;

    if (!plan || (plan !== 'Developer' && plan !== 'Business')) {
        return res.status(400).json({ success: false, message: 'Invalid plan selected.' });
    }
    
    const validPaymentMethods = ['ORKUT_QRIS', 'MIDTRANS_SNAP'];
    if (!paymentMethod || !validPaymentMethods.includes(paymentMethod)) {
        return res.status(400).json({ success: false, message: 'Payment method required or invalid.' });
    }

    let amount = 0;
    if (plan === 'Developer') amount = 5000;
    else if (plan === 'Business') amount = 10000;

    const orderId = `WANZOFC-${plan.charAt(0)}-${uuidv4().slice(0, 8).toUpperCase()}`;

    try {
        if (paymentMethod === 'ORKUT_QRIS') {
            const qrisResult = await createDynamicOrkutQris(amount, `Upgrade to ${plan} - ${req.user.username}`);
            if (qrisResult.success) {
                const transaction = new Transaction({
                    userId,
                    orderId: qrisResult.orkutReffId || orderId,
                    plan,
                    amount: qrisResult.amountToPayWithFee,
                    paymentMethod: 'ORKUT_QRIS',
                    status: 'PENDING',
                    qrisImageUrl: qrisResult.qrImageUrl,
                    qrisString: qrisResult.qrString,
                    qrisExpiredAt: qrisResult.expiredAt,
                });
                await transaction.save();
                return res.json({ success: true, ...qrisResult, transactionId: transaction._id, orderId: transaction.orderId });
            } else {
                return res.status(500).json({ success: false, message: qrisResult.message || 'Failed to create Orkut QRIS' });
            }
        } else if (paymentMethod === 'MIDTRANS_SNAP') {
             let parameter = {
                "transaction_details": {
                    "order_id": orderId,
                    "gross_amount": amount
                },
                "customer_details": {
                    "email": req.user.email,
                    "first_name": req.user.username
                }
            };

            const midtransSnapResponse = await snap.createTransaction(parameter);
            
            const transaction = new Transaction({
                userId,
                orderId,
                plan,
                amount,
                paymentMethod: 'MIDTRANS_SNAP',
                status: 'PENDING',
                midtransTransactionId: midtransSnapResponse.token,
                midtransRedirectUrl: midtransSnapResponse.redirect_url 
            });
            await transaction.save();

            return res.json({ 
                success: true, 
                redirect_url: midtransSnapResponse.redirect_url, 
                orderId: transaction.orderId, 
                transactionId: transaction._id,
                token: midtransSnapResponse.token 
            });

        }
    } catch (error) {
        console.error('Payment initiation error:', error);
        let errorMessage = 'Server error during payment initiation.';
        if (error.response && error.response.data && error.response.data.error_messages) {
            errorMessage = error.response.data.error_messages.join(', ');
        } else if (error.message) {
            errorMessage = error.message;
        }
        if (error.name === 'ValidationError') {
            errorMessage = error.message; 
        }
        res.status(500).json({ success: false, message: errorMessage });
    }
});

router.post('/webhook/midtrans', async (req, res) => {
    try {
        const notificationJson = req.body;
        const statusResponse = await snap.transaction.notification(notificationJson);
        let orderId = statusResponse.order_id;
        let transactionStatus = statusResponse.transaction_status;
        let fraudStatus = statusResponse.fraud_status;

        console.log(`Midtrans Webhook: Order ID: ${orderId}, Status: ${transactionStatus}, Fraud: ${fraudStatus}`);

        const transaction = await Transaction.findOne({ orderId: orderId });
        if (!transaction) {
            console.error(`Webhook Error: Transaction with orderId ${orderId} not found.`);
            return res.status(404).send('Transaction not found');
        }
        
        if (transaction.status === 'SUCCESS') {
             console.log(`Transaction ${orderId} already processed as SUCCESS.`);
             return res.status(200).send('Transaction already success');
        }

        let newStatus = transaction.status;
        if (transactionStatus == 'capture') {
            if (fraudStatus == 'accept') {
                newStatus = 'SUCCESS';
            } else if (fraudStatus == 'challenge') {
                newStatus = 'PENDING'; 
            } else {
                newStatus = 'FAILED';
            }
        } else if (transactionStatus == 'settlement') {
            newStatus = 'SUCCESS';
        } else if (transactionStatus == 'cancel' ||
                   transactionStatus == 'deny' ||
                   transactionStatus == 'expire') {
            newStatus = 'FAILED'; 
        } else if (transactionStatus == 'pending') {
            newStatus = 'PENDING';
        }

        if (newStatus === 'SUCCESS' && transaction.status !== 'SUCCESS') {
            transaction.status = 'SUCCESS';
            await transaction.save();
            
            const user = await User.findById(transaction.userId);
            if (user) {
                user.plan = transaction.plan;
                if (transaction.plan === 'Developer') user.apiLimit = parseInt(process.env.DEFAULT_API_LIMIT_DEVELOPER);
                else if (transaction.plan === 'Business') user.apiLimit = parseInt(process.env.DEFAULT_API_LIMIT_BUSINESS);
                
                const planDurationMonths = 2;
                let newExpirationDate = user.planExpirationDate ? new Date(user.planExpirationDate) : new Date();
                if (newExpirationDate < new Date() || user.plan !== transaction.plan) { 
                    newExpirationDate = new Date();
                }
                newExpirationDate.setMonth(newExpirationDate.getMonth() + planDurationMonths);
                user.planExpirationDate = newExpirationDate;
                
                await user.save();
                console.log(`User ${user.username} plan upgraded to ${user.plan}, expires ${user.planExpirationDate}`);
            }
        } else if (newStatus !== transaction.status) {
            transaction.status = newStatus;
            await transaction.save();
            console.log(`Transaction ${orderId} status updated to ${newStatus}`);
        }
        
        res.status(200).send('OK');

    } catch (error) {
        console.error('Midtrans Webhook Error:', error.message);
        res.status(500).send('Webhook processing error');
    }
});

router.get('/status/orkut/:orderReffId', protect, async (req, res) => {
    const { orderReffId } = req.params;
    try {
        const transaction = await Transaction.findOne({ orderId: orderReffId, userId: req.user._id });
        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found.' });
        }
        if (transaction.status === 'SUCCESS') {
             return res.json({ success: true, isPaid: true, message: 'Payment already successful.'});
        }
        if (transaction.paymentMethod !== 'ORKUT_QRIS') {
            return res.status(400).json({ success: false, message: 'Not an Orkut QRIS transaction.'});
        }
        if (new Date(transaction.qrisExpiredAt) < new Date() && transaction.status === 'PENDING') {
            transaction.status = 'EXPIRED';
            await transaction.save();
            return res.json({ success: true, isPaid: false, message: 'QRIS has expired. Please create a new one.' });
        }


        const statusResult = await checkOrkutQrisPaymentStatus(orderReffId, transaction.amount, transaction.updatedAt);
        
        if (statusResult.success && statusResult.isPaid) {
            if(transaction.status !== 'SUCCESS') {
                transaction.status = 'SUCCESS';
                await transaction.save();

                const user = await User.findById(transaction.userId);
                if (user) {
                    user.plan = transaction.plan;
                    if (transaction.plan === 'Developer') user.apiLimit = parseInt(process.env.DEFAULT_API_LIMIT_DEVELOPER);
                    else if (transaction.plan === 'Business') user.apiLimit = parseInt(process.env.DEFAULT_API_LIMIT_BUSINESS);

                    const planDurationMonths = 2;
                    let newExpirationDate = user.planExpirationDate ? new Date(user.planExpirationDate) : new Date();
                    if (newExpirationDate < new Date() || user.plan !== transaction.plan) {
                        newExpirationDate = new Date();
                    }
                    newExpirationDate.setMonth(newExpirationDate.getMonth() + planDurationMonths);
                    user.planExpirationDate = newExpirationDate;
                    
                    await user.save();
                     console.log(`User ${user.username} plan upgraded to ${user.plan} via Orkut check, expires ${user.planExpirationDate}`);
                }
            }
            return res.json({ success: true, isPaid: true, message: 'Payment confirmed and plan upgraded.', transaction: statusResult.transaction });
        } else {
            return res.json({ success: true, isPaid: false, message: statusResult.message || 'Payment not yet confirmed.' });
        }
    } catch (error) {
        console.error("Error checking Orkut payment status:", error);
        res.status(500).json({ success: false, message: 'Server error checking payment status.' });
    }
});

module.exports = router;