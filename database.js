const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Connect to SQLite database
const dbPath = path.resolve(__dirname, 'ceylon.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to SQLite database:', err.message);
    } else {
        console.log('Connected to local SQLite database.');
    }
});

// Helper function to handle PostgreSQL-style $1, $2 placeholders for SQLite
const convertPlaceholders = (text) => {
    if (typeof text !== 'string') return text;
    // Replace $1, $2, etc with ?
    return text.replace(/\$\d+/g, '?');
};

// Wrap db methods to ensure compatibility with the rest of the app
const dbWrapper = {
    query: (text, params) => {
        return new Promise((resolve, reject) => {
            db.all(convertPlaceholders(text), params, (err, rows) => {
                if (err) reject(err);
                else resolve({ rows });
            });
        });
    },

    all: (text, params, callback) => {
        db.all(convertPlaceholders(text), params, callback);
    },

    get: (text, params, callback) => {
        db.get(convertPlaceholders(text), params, callback);
    },

    run: (text, params, callback) => {
        db.run(convertPlaceholders(text), params, callback);
    },

    prepare: (text) => {
        return db.prepare(convertPlaceholders(text));
    },

    serialize: (fn) => db.serialize(fn)
};

async function initDb() {
    db.serialize(() => {
        // Site Settings Table
        db.run(`CREATE TABLE IF NOT EXISTS site_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE,
            value TEXT
        )`);

        // Provinces Table
        db.run(`CREATE TABLE IF NOT EXISTS provinces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            tagline TEXT,
            description TEXT,
            image_url TEXT,
            visit_days TEXT,
            weather_range TEXT,
            sort_order INTEGER DEFAULT 0
        )`);

        // Tourist Spots Table
        db.run(`CREATE TABLE IF NOT EXISTS spots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            province_id INTEGER,
            name TEXT,
            description TEXT,
            image_url TEXT,
            recommended_days TEXT,
            tags TEXT,
            FOREIGN KEY(province_id) REFERENCES provinces(id) ON DELETE CASCADE
        )`);

        // Hotels Table
        db.run(`CREATE TABLE IF NOT EXISTS hotels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            province_id INTEGER,
            name TEXT,
            description TEXT,
            image_url TEXT,
            stars INTEGER,
            FOREIGN KEY(province_id) REFERENCES provinces(id) ON DELETE CASCADE
        )`);

        // Vehicles Table
        db.run(`CREATE TABLE IF NOT EXISTS vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            rate TEXT,
            details TEXT,
            image_url TEXT
        )`);

        // Admin Table
        db.run(`CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT
        )`);

        // Inquiries Table
        db.run(`CREATE TABLE IF NOT EXISTS inquiries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT,
            regions TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'new'
        )`);

        // Seed Default Admin
        db.run(`INSERT OR IGNORE INTO admins (username, password) VALUES (?, ?)`, ['DAHAM vishwa', 'DVB@2003']);

        // Seed default settings
        const defaultSettings = [
            ['home_description', 'Sri Lanka is not just a destination; it\'s a sensory journey through ancient citadels, emerald tea hills, and sapphire shores. We curate your passage through the Wonder of Asia with precision and elegance.'],
            ['home_hero_image', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBorYm24Yv6p6cWKilnWWmDKY_R0xRFfX588T397XEcLJ-MNvFF-E98DL9SLnLvAK5nx4BUH3blOIoEOtW4jtfkxS-wv8S2-oSrw5grszKncMUopKkdYUdAiqFi-_zIy3NiakJu0oEkmYnH931ef8qVazAqBeybhbMgTIratEqnvQ5OJHgbo5mwf49nG2DhKmFiwJgkqPgC4ZCrpUnzuAklv4GMgz3L_u7UgGTSi4ICchSYHbJFtGJvbpkXohE1z_rpSaC7HmgjLxM'],
            ['about_description', 'To provide a bridge between the wandering soul and the ancient secrets of Sri Lanka...'],
            ['whatsapp_number', '+94123456789'],
            ['facebook_url', '#'],
            ['email_address', 'contact@discoverceylon.com'],
            ['instagram_url', '#'],
            ['daily_rate_standard', '$40/day']
        ];

        defaultSettings.forEach(([key, value]) => {
            db.run(`INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)`, [key, value]);
        });

        console.log('Database tables verified/created.');
    });
}

initDb();

module.exports = dbWrapper;
