const errorHandler = (err, req, res, next) => {
    const statusCode = err.status || 500;
    
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Terjadi kesalahan pada server',
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = { errorHandler };