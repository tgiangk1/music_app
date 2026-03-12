import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './database.js';

passport.use(new GoogleStrategy(
    {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback',
    },
    (accessToken, refreshToken, profile, done) => {
        try {
            const db = getDb();
            const email = profile.emails?.[0]?.value;
            const googleId = profile.id;
            const displayName = profile.displayName || email;
            const avatar = profile.photos?.[0]?.value || null;
            let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
            if (user) {
                db.prepare("UPDATE users SET last_seen_at = datetime('now'), display_name = ?, avatar = ? WHERE id = ?").run(displayName, avatar, user.id);
                user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
            } else {
                const id = uuidv4();
                const isFirstAdmin = email === process.env.FIRST_ADMIN_EMAIL;
                const role = isFirstAdmin ? 'admin' : 'member';
                db.prepare(`INSERT INTO users (id, google_id, email, display_name, avatar, role, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`).run(id, googleId, email, displayName, avatar, role);
                user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
                console.log(`👤 New user created: ${displayName} (${email}) — role: ${role}`);
            }
            return done(null, user);
        } catch (err) { return done(err); }
    }
));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => { const db = getDb(); const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id); done(null, user); });
