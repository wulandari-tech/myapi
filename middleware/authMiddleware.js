module.exports = {
    ensureAuthenticated: function(req, res, next) {
        if (req.isAuthenticated()) {
            return next();
        }
        // req.flash('error_msg', 'Silakan login untuk mengakses halaman ini.'); // Jika pakai connect-flash
        console.log('User not authenticated, redirecting to login');
        res.redirect('/auth/login');
    },
    ensureGuest: function(req, res, next) {
        if (req.isAuthenticated()) {
            res.redirect('/dashboard');
        } else {
            return next();
        }
    },
    ensureAdmin: function(req, res, next) {
        if (req.isAuthenticated() && req.user.isAdmin) {
            return next();
        }
        // req.flash('error_msg', 'Akses ditolak. Anda bukan admin.');
        console.log('User not admin, access denied');
        res.redirect('/');
    }
};