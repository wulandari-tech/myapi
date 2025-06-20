const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('home', { title: 'Wanzofc API - Home' });
});

router.get('/documentation', (req, res) => {
    res.render('documentation', { title: 'Dokumentasi API' });
});

router.get('/pricing', (req, res) => {
    res.render('pricing', { title: 'Harga & Paket' });
});

router.get('/status', (req, res) => {
    const serverStatus = {
        status: "operational",
        message: "Semua sistem berjalan normal.",
        timestamp: new Date().toISOString(),
        activeConnections: Math.floor(Math.random() * 100)
    };
    res.render('status', { title: 'Status Server', serverStatus });
});

router.get('/contact-sales', (req, res) => { 
    res.render('contact-sales', { title: 'Hubungi Sales - Wanzofc API' });
});

module.exports = router;