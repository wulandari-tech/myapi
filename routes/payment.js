const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const paymentController = require('../controllers/paymentController');

router.post('/checkout', ensureAuthenticated, paymentController.showCheckoutPage);
router.post('/create-qris', ensureAuthenticated, paymentController.createQrisPayment);
router.get('/pending/:transactionId', ensureAuthenticated, paymentController.showPendingPage);
router.get('/status/:transactionId', ensureAuthenticated, paymentController.checkPaymentStatus);
router.get('/success/:transactionId', ensureAuthenticated, paymentController.showSuccessPage);
router.get('/failed/:transactionId', ensureAuthenticated, paymentController.showFailedPage);

module.exports = router;