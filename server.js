// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const mysql = require('mysql2/promise');
const cors = require('cors');
const fs = require('fs').promises;

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/qr-codes', express.static('public/qr-codes'));

// Database connection
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'travel_app'
});

// Multer setup
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'public', 'qr-codes');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage });

// Routes
app.get('/api/events', async (req, res) => {
    const { filter } = req.query;

    try {
        let query;
        if (filter === 'upcoming') {
            query = 'SELECT * FROM events WHERE date >= CURDATE() ORDER BY date ASC';
        } else if (filter === 'previous') {
            query = 'SELECT * FROM events WHERE date < CURDATE() ORDER BY date DESC';
        } else {
            return res.status(400).json({ error: 'Invalid filter parameter' });
        }

        const [events] = await pool.query(query);
        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

app.post('/api/events', upload.single('qrCode'), async (req, res) => {
    try {
        const { title, place, gradient, icon, date, time } = req.body;

        if (!title || !place || !gradient || !icon || !date || !time) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const qrCodePath = req.file ? `/qr-codes/${req.file.filename}` : null;

        const [result] = await pool.query(
            'INSERT INTO events (title, place, gradient, icon, date, time, qr_code_path) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [title, place, gradient, icon, date, time, qrCodePath]
        );

        res.status(201).json({
            message: 'Event created successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
});

//app/api/events/[id]/route.ts
app.get('/api/events/:id', async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);

        if (isNaN(eventId)) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const [events] = await pool.query(
            'SELECT id, title, place, gradient, icon, date, time, status, qr_code_path, photo_path FROM events WHERE id = ?',
            [eventId]
        );

        if (!events.length) {
            return res.status(404).json({ error: 'Event not found' });
        }

        res.json(events[0]);
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ error: 'Failed to fetch event' });
    }
});

//app/api/events/[id]/status/route.ts
app.put('/api/events/:id/status', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const { status } = req.body;
        if (status !== 'accepted' && status !== 'declined') {
            return res.status(400).json({ error: 'Invalid status' });
        }

        await query('UPDATE events SET status = ? WHERE id = ?', [status, id]);

        res.status(200).json({ message: 'Event status updated successfully' });
    } catch (error) {
        console.error('Error updating event status:', error);
        res.status(500).json({ error: 'Failed to update event status' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});