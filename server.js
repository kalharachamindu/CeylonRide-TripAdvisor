const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const db = require('./database');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Logger
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Ensure uploads directory exists
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// Session configuration
app.use(session({
    secret: 'ceylon_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// File Upload Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// --- AUTH ENDPOINTS ---

const authMiddleware = (req, res, next) => {
    if (req.session.adminId) next();
    else res.status(401).json({ error: 'Unauthorized' });
};

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM admins WHERE username = $1 AND password = $2', [username, password], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            req.session.adminId = row.id;
            req.session.adminName = row.username;
            res.json({ success: true, message: 'Login successful' });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    });
});

app.get('/api/admin/me', authMiddleware, (req, res) => {
    res.json({ id: req.session.adminId, name: req.session.adminName });
});

app.post('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// --- SETTINGS ENDPOINTS ---

app.get('/api/settings', (req, res) => {
    db.all('SELECT * FROM site_settings', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    });
});

app.put('/api/settings', authMiddleware, (req, res) => {
    const updates = req.body;
    const stmt = db.prepare('INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value');
    Object.keys(updates).forEach(key => {
        stmt.run([key, updates[key]]);
    });
    stmt.finalize();
    res.json({ success: true });
});

app.post('/api/settings/image', authMiddleware, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { key } = req.body;
    const url = '/uploads/' + req.file.filename;
    db.run('INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, url], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, url });
    });
});

// --- PROVINCES ENDPOINTS ---

app.get('/api/provinces', (req, res) => {
    db.all('SELECT * FROM provinces ORDER BY sort_order ASC', [], async (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const provinces = await Promise.all(rows.map(async (p) => {
            const spots = await new Promise(r => db.all('SELECT * FROM spots WHERE province_id = $1', [p.id], (e, s) => r(s || [])));
            const hotels = await new Promise(r => db.all('SELECT * FROM hotels WHERE province_id = $1', [p.id], (e, h) => r(h || [])));
            return { ...p, spots, hotels };
        }));
        res.json(provinces);
    });
});

app.get('/api/provinces/:id', (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM provinces WHERE id = $1', [id], (err, province) => {
        if (err || !province) return res.status(404).json({ error: 'Not found' });
        db.all('SELECT * FROM spots WHERE province_id = $1', [id], (err, spots) => {
            db.all('SELECT * FROM hotels WHERE province_id = $1', [id], (err, hotels) => {
                res.json({ ...province, spots, hotels });
            });
        });
    });
});

app.post('/api/provinces', authMiddleware, upload.single('image'), (req, res) => {
    const { name, tagline, description, visit_days, weather_range } = req.body;
    const image_url = req.file ? '/uploads/' + req.file.filename : '';
    db.run('INSERT INTO provinces (name, tagline, description, image_url, visit_days, weather_range) VALUES ($1, $2, $3, $4, $5, $6)',
        [name, tagline, description, image_url, visit_days, weather_range], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

app.put('/api/provinces/:id', authMiddleware, upload.single('image'), (req, res) => {
    const { name, tagline, description, visit_days, weather_range } = req.body;
    const id = req.params.id;
    let query = 'UPDATE provinces SET name=$1, tagline=$2, description=$3, visit_days=$4, weather_range=$5 WHERE id=$6';
    let params = [name, tagline, description, visit_days, weather_range, id];
    
    if (req.file) {
        query = 'UPDATE provinces SET name=$1, tagline=$2, description=$3, visit_days=$4, weather_range=$5, image_url=$6 WHERE id=$7';
        params = [name, tagline, description, visit_days, weather_range, '/uploads/' + req.file.filename, id];
    }

    db.run(query, params, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.put('/api/provinces/reorder', authMiddleware, (req, res) => {
    const { order } = req.body;
    db.serialize(() => {
        const stmt = db.prepare('UPDATE provinces SET sort_order = $1 WHERE id = $2');
        order.forEach((id, index) => stmt.run([index + 1, id]));
        stmt.finalize(() => res.json({ success: true }));
    });
});

app.delete('/api/provinces/:id', authMiddleware, (req, res) => {
    db.run('DELETE FROM provinces WHERE id = $1', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- SPOTS & HOTELS & VEHICLES ---

app.post('/api/spots', authMiddleware, upload.single('image'), (req, res) => {
    const { province_id, name, description, recommended_days, tags } = req.body;
    const url = req.file ? '/uploads/' + req.file.filename : '';
    db.run('INSERT INTO spots (province_id, name, description, image_url, recommended_days, tags) VALUES ($1, $2, $3, $4, $5, $6)',
        [province_id, name, description, url, recommended_days, tags], e => res.json({ success: !e }));
});

app.put('/api/spots/:id', authMiddleware, upload.single('image'), (req, res) => {
    const { name, description, recommended_days, tags } = req.body;
    const id = req.params.id;
    let query = 'UPDATE spots SET name=$1, description=$2, recommended_days=$3, tags=$4 WHERE id=$5';
    let params = [name, description, recommended_days, tags, id];
    if (req.file) {
        query = 'UPDATE spots SET name=$1, description=$2, recommended_days=$3, tags=$4, image_url=$5 WHERE id=$6';
        params = [name, description, recommended_days, tags, '/uploads/' + req.file.filename, id];
    }
    db.run(query, params, e => res.json({ success: !e }));
});

app.delete('/api/spots/:id', authMiddleware, (req, res) => {
    db.run('DELETE FROM spots WHERE id = $1', [req.params.id], e => res.json({ success: !e }));
});

app.post('/api/hotels', authMiddleware, upload.single('image'), (req, res) => {
    const { province_id, name, description, stars } = req.body;
    const url = req.file ? '/uploads/' + req.file.filename : '';
    db.run('INSERT INTO hotels (province_id, name, description, image_url, stars) VALUES ($1, $2, $3, $4, $5)',
        [province_id, name, description, url, stars], e => res.json({ success: !e }));
});

app.put('/api/hotels/:id', authMiddleware, upload.single('image'), (req, res) => {
    const { name, description, stars } = req.body;
    const id = req.params.id;
    let query = 'UPDATE hotels SET name=$1, description=$2, stars=$3 WHERE id=$4';
    let params = [name, description, stars, id];
    if (req.file) {
        query = 'UPDATE hotels SET name=$1, description=$2, stars=$3, image_url=$4 WHERE id=$5';
        params = [name, description, stars, '/uploads/' + req.file.filename, id];
    }
    db.run(query, params, e => res.json({ success: !e }));
});

app.delete('/api/hotels/:id', authMiddleware, (req, res) => {
    db.run('DELETE FROM hotels WHERE id = $1', [req.params.id], e => res.json({ success: !e }));
});

app.get('/api/vehicles', (req, res) => {
    db.all('SELECT * FROM vehicles', [], (e, rows) => res.json(rows || []));
});

app.post('/api/vehicles', authMiddleware, upload.single('image'), (req, res) => {
    const { name, rate, details } = req.body;
    const url = req.file ? '/uploads/' + req.file.filename : '';
    db.run('INSERT INTO vehicles (name, rate, details, image_url) VALUES ($1, $2, $3, $4)',
        [name, rate, details, url], e => res.json({ success: !e }));
});

app.put('/api/vehicles/:id', authMiddleware, upload.single('image'), (req, res) => {
    const { name, rate, details } = req.body;
    const id = req.params.id;
    let query = 'UPDATE vehicles SET name=$1, rate=$2, details=$3 WHERE id=$4';
    let params = [name, rate, details, id];
    if (req.file) {
        query = 'UPDATE vehicles SET name=$1, rate=$2, details=$3, image_url=$4 WHERE id=$5';
        params = [name, rate, details, '/uploads/' + req.file.filename, id];
    }
    db.run(query, params, e => res.json({ success: !e }));
});

app.delete('/api/vehicles/:id', authMiddleware, (req, res) => {
    db.run('DELETE FROM vehicles WHERE id = $1', [req.params.id], e => res.json({ success: !e }));
});

// --- INQUIRIES / BOOKINGS ---

app.post('/api/inquiries', (req, res) => {
    const { name, email, regions } = req.body;
    db.run(
        `INSERT INTO inquiries (name, email, regions) VALUES ($1, $2, $3)`,
        [name || 'Anonymous', email || '', regions],
        function(e) { res.json({ success: !e, id: this?.lastID }); }
    );
});

app.get('/api/inquiries', authMiddleware, (req, res) => {
    db.all('SELECT * FROM inquiries ORDER BY created_at DESC', [], (e, rows) => {
        if (e) return res.status(500).json({ error: e.message });
        res.json(rows);
    });
});

app.put('/api/inquiries/:id/read', authMiddleware, (req, res) => {
    db.run('UPDATE inquiries SET status = $1 WHERE id = $2', ['read', req.params.id], e => res.json({ success: !e }));
});

app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        next();
    } else {
        res.sendFile(path.join(__dirname, 'home.html'));
    }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
