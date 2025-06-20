const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
const User = require('../models/user'); 
module.exports = function(passport) {
    passport.use(
        new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
            try {
                const user = await User.findOne({ email: email.toLowerCase() });
                if (!user) {
                    return done(null, false, { message: 'Email tidak terdaftar.' });
                }
                if (!user.password) { // Jika user terdaftar via Google, tidak ada password manual
                    return done(null, false, { message: 'Akun ini terdaftar via Google. Silakan login dengan Google.' });
                }

                const isMatch = await user.matchPassword(password);
                if (isMatch) {
                    return done(null, user);
                } else {
                    return done(null, false, { message: 'Password salah.' });
                }
            } catch (err) {
                return done(err);
            }
        })
    );

    // Google OAuth Strategy
    passport.use(
        new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: '/auth/google/callback'
        },
        async (accessToken, refreshToken, profile, done) => {
            const newUser = {
                googleId: profile.id,
                username: profile.displayName.replace(/\s+/g, '').toLowerCase() + profile.id.slice(0,5), // Buat username unik
                email: profile.emails[0].value,
                profile: {
                    displayName: profile.displayName,
                    avatarUrl: profile.photos[0].value
                }
                // API Key akan digenerate oleh pre-save hook di User model
            };

            try {
                let user = await User.findOne({ googleId: profile.id });
                if (user) {
                    done(null, user);
                } else {
                    // Cek apakah email sudah ada (misal daftar manual dulu)
                    user = await User.findOne({ email: profile.emails[0].value });
                    if (user) {
                        // Jika ada, update dengan googleId
                        user.googleId = profile.id;
                        user.profile = newUser.profile;
                        await user.save();
                        done(null, user);
                    } else {
                        // Jika tidak ada, buat user baru
                        user = await User.create(newUser);
                        done(null, user);
                    }
                }
            } catch (err) {
                console.error(err);
                done(err, null);
            }
        })
    );

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    });
};