const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 8000;

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Initialize database table
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_tags (
                id SERIAL PRIMARY KEY,
                video_index INTEGER NOT NULL,
                name VARCHAR(255) NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

initDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Path to videos data file
const VIDEOS_FILE = path.join(__dirname, 'videos.json');

// Get all videos with tags (merged from JSON and database)
app.get('/api/videos', async (req, res) => {
    try {
        // Read videos from JSON
        const data = await fs.readFile(VIDEOS_FILE, 'utf8');
        const videosData = JSON.parse(data);

        // Get user-submitted tags from database
        const dbResult = await pool.query('SELECT * FROM user_tags ORDER BY created_at ASC');

        // Merge database tags into videos
        dbResult.rows.forEach(dbTag => {
            if (videosData.videos[dbTag.video_index]) {
                if (!videosData.videos[dbTag.video_index].animalTags) {
                    videosData.videos[dbTag.video_index].animalTags = [];
                }
                videosData.videos[dbTag.video_index].animalTags.push({
                    name: dbTag.name,
                    timestamp: dbTag.timestamp,
                    userSuggested: true
                });
            }
        });

        res.json(videosData);
    } catch (error) {
        console.error('Error reading videos:', error);
        res.status(500).json({ error: 'Failed to load videos' });
    }
});

// Add a tag to a video (save to database)
app.post('/api/videos/:videoIndex/tags', async (req, res) => {
    try {
        const { videoIndex } = req.params;
        const { name, timestamp } = req.body;

        // Validate input
        if (!name || timestamp === undefined) {
            return res.status(400).json({ error: 'Missing name or timestamp' });
        }

        // Read current videos data to verify video exists
        const data = await fs.readFile(VIDEOS_FILE, 'utf8');
        const videosData = JSON.parse(data);

        // Check if video exists
        if (!videosData.videos[videoIndex]) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Save tag to database
        const result = await pool.query(
            'INSERT INTO user_tags (video_index, name, timestamp) VALUES ($1, $2, $3) RETURNING *',
            [parseInt(videoIndex), name, parseInt(timestamp)]
        );

        const newTag = {
            name: result.rows[0].name,
            timestamp: result.rows[0].timestamp,
            userSuggested: true
        };

        res.json({ success: true, tag: newTag });
    } catch (error) {
        console.error('Error adding tag:', error);
        res.status(500).json({ error: 'Failed to add tag' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🌲 Princeton Wildlife server running!`);
    console.log(`📍 Open your browser to: http://localhost:${PORT}`);
    console.log(`\n🦌 Press Ctrl+C to stop the server\n`);
});
