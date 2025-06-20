require('dotenv').config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const http = require('http'); // Diperlukan untuk Socket.IO
const { Server } = require("socket.io"); 
const connectDB = require('./config/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server); 
connectDB();

require('./config/passport')(passport);

app.use(morgan('dev'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'averysecretfallbackkey',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
});
app.use(sessionMiddleware);

app.use(passport.initialize());
app.use(passport.session());

app.use(function(req, res, next) {
    res.locals.user = req.user || null;
    res.locals.currentPath = req.path;
    res.locals.query = req.query;
    res.locals.themeColors = {
        primary: process.env.COLOR_PRIMARY || '#6A11CB',
        accent: process.env.COLOR_ACCENT || '#FF00E6',
        textLight: process.env.COLOR_TEXT_LIGHT || '#F5F5F5',
        cardDark: process.env.COLOR_CARD_DARK || '#2C2C54',
        success: process.env.COLOR_SUCCESS || '#4CAF50',
        error: process.env.COLOR_ERROR || '#F44336',
    };
    next();
});

app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/dashboard', require('./routes/users'));
app.use('/admin', require('./routes/admin'));
app.use('/payment', require('./routes/payment'));
app.use('/api/v1', require('./routes/api'));


// Socket.IO Logic
const activeChats = {}; // Simpan chat aktif: { userId: { socketId: '...', name: '...', messages: [] }, ... }
const adminSockets = new Set(); // Set untuk menyimpan socket ID admin yang terkoneksi

io.use((socket, next) => { // Middleware untuk Socket.IO agar bisa akses session Express
    sessionMiddleware(socket.request, {}, next);
});

io.on('connection', (socket) => {
    const session = socket.request.session;
    const user = session.passport?.user ? session.passport.user : null; // Ambil ID user dari session passport

    // Jika user adalah admin (cek berdasarkan data user di session atau cara lain)
    // Untuk contoh ini, kita asumsikan jika user ada dan isAdmin true dari database (perlu query)
    // Atau, lebih sederhana, kita buat admin join room khusus saat mereka di halaman admin chat.
    // Di sini kita akan identifikasi admin saat mereka emit 'adminJoin'
    
    socket.on('adminJoin', () => {
        if (user) { // Idealnya cek apakah user ini benar-benar admin
            adminSockets.add(socket.id);
            console.log(`Admin connected: ${socket.id}, User ID: ${user}`);
            socket.emit('activeChatsUpdate', Object.values(activeChats).map(c => ({userId: c.userId, name: c.name, unread: c.unreadByAdmin })));
        }
    });

    socket.on('userStartChat', (data) => {
        const userId = user || socket.id; // Gunakan user ID jika login, atau socket ID jika anonim
        const userName = data.name || (session.user ? session.user.username : 'Guest') + ` (${userId.slice(-4)})`;
        
        if (!activeChats[userId]) {
            activeChats[userId] = { 
                userId: userId,
                socketId: socket.id, 
                name: userName, 
                messages: [],
                unreadByAdmin: 0,
                unreadByUser: 0
            };
            console.log(`User started chat: ${userName} (ID: ${userId})`);
        } else {
            activeChats[userId].socketId = socket.id; // Update socket ID jika reconnect
            console.log(`User reconnected: ${userName} (ID: ${userId})`);
        }
        socket.join(userId); // User join room berdasarkan ID mereka
        // Kirim update ke semua admin
        adminSockets.forEach(adminSocketId => {
            io.to(adminSocketId).emit('newChatSession', { userId: userId, name: userName, messages: activeChats[userId].messages });
        });
        // Kirim riwayat chat (jika ada) ke user
        socket.emit('chatHistory', activeChats[userId].messages);
    });

    socket.on('userSendMessage', (messageData) => {
        const userId = user || socket.id;
        if (activeChats[userId]) {
            const message = { sender: 'user', text: messageData.text, timestamp: new Date() };
            activeChats[userId].messages.push(message);
            activeChats[userId].unreadByAdmin = (activeChats[userId].unreadByAdmin || 0) + 1;
            
            adminSockets.forEach(adminSocketId => {
                io.to(adminSocketId).emit('newMessage', { userId: userId, name: activeChats[userId].name, message, unreadCount: activeChats[userId].unreadByAdmin });
            });
            socket.emit('messageEcho', message); // Kirim echo ke user pengirim
        }
    });

    socket.on('adminSendMessage', (messageData) => {
        const targetUserId = messageData.userId;
        if (activeChats[targetUserId] && adminSockets.has(socket.id)) {
            const message = { sender: 'admin', text: messageData.text, timestamp: new Date() };
            activeChats[targetUserId].messages.push(message);
            activeChats[targetUserId].unreadByUser = (activeChats[targetUserId].unreadByUser || 0) + 1;
            activeChats[targetUserId].unreadByAdmin = 0; // Admin sudah membaca

            io.to(activeChats[targetUserId].socketId).emit('newMessage', { userId: targetUserId, message, unreadCount: activeChats[targetUserId].unreadByUser });
            
            // Update ke semua admin bahwa chat ini sudah dibaca/dibalas
            adminSockets.forEach(adminSocketId => {
                 io.to(adminSocketId).emit('chatSessionUpdated', { userId: targetUserId, messages: activeChats[targetUserId].messages, unreadByAdmin: 0 });
            });
        }
    });
    
    socket.on('adminMarkAsRead', (targetUserId) => {
        if (activeChats[targetUserId] && adminSockets.has(socket.id)) {
            activeChats[targetUserId].unreadByAdmin = 0;
            adminSockets.forEach(adminSocketId => {
                 io.to(adminSocketId).emit('chatSessionUpdated', { userId: targetUserId, messages: activeChats[targetUserId].messages, unreadByAdmin: 0 });
            });
        }
    });

    socket.on('userMarkAsRead', () => { // User menandai chat sudah dibaca
        const userId = user || socket.id;
        if (activeChats[userId]) {
            activeChats[userId].unreadByUser = 0;
            // Tidak perlu update ke admin untuk ini, kecuali ada UI khusus
        }
    });

    socket.on('adminCloseChat', (targetUserId) => {
        if (activeChats[targetUserId] && adminSockets.has(socket.id)) {
            io.to(activeChats[targetUserId].socketId).emit('chatClosedByAdmin', { message: 'Sesi chat ini telah ditutup oleh administrator.' });
            // Hapus chat dari activeChats jika sudah tidak ingin dilanjutkan
            // delete activeChats[targetUserId]; 
            // Atau tandai sebagai closed:
            activeChats[targetUserId].status = 'closed';
            activeChats[targetUserId].closedBy = 'admin';
            
            adminSockets.forEach(adminSocketId => {
                io.to(adminSocketId).emit('chatSessionClosed', { userId: targetUserId });
            });
            console.log(`Admin ${socket.id} closed chat with ${targetUserId}`);
        }
    });

    socket.on('disconnect', () => {
        if (adminSockets.has(socket.id)) {
            adminSockets.delete(socket.id);
            console.log(`Admin disconnected: ${socket.id}`);
        } else {
            // Cari user berdasarkan socket.id dan tandai mereka offline atau hapus jika tidak permanen
            for (const uid in activeChats) {
                if (activeChats[uid].socketId === socket.id) {
                    console.log(`User disconnected: ${activeChats[uid].name} (ID: ${uid})`);
                    // activeChats[uid].status = 'offline'; // Atau logika lain
                    break;
                }
            }
        }
    });
});


app.use((req, res, next) => {
    const error = new Error('Halaman Tidak Ditemukan');
    error.status = 404;
    next(error);
});

app.use((error, req, res, next) => {
    const statusCode = error.status || 500;
    res.status(statusCode);
    console.error(`Error ${statusCode}: ${error.message} at ${req.originalUrl}`);
    if (process.env.NODE_ENV === 'development' && error.stack) {
        console.error(error.stack);
    }
    if (req.originalUrl.startsWith('/api/')) {
        return res.json({
            success: false,
            message: error.message || 'Terjadi kesalahan pada server.',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
    res.render('error', {
        title: `Error ${statusCode}`,
        message: error.message || 'Terjadi kesalahan pada server.',
        errorDetail: process.env.NODE_ENV === 'development' ? error.stack : 'Silakan coba lagi nanti atau hubungi administrator.',
        statusCode: statusCode
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { // Gunakan server.listen bukan app.listen
    console.log(`🔥 Wanzofc API Server (with Socket.IO) running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});