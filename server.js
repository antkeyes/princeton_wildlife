const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 8000;

// PostgreSQL connection (only in production)
const pool = process.env.DATABASE_URL ? new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
}) : null;

// Initialize database table
async function initDB() {
    if (!pool) {
        console.log('No database configured - running in local mode');
        return;
    }
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

        await pool.query(`
            CREATE TABLE IF NOT EXISTS videos (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                video_path TEXT NOT NULL,
                youtube_url TEXT NOT NULL UNIQUE,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                date VARCHAR(50),
                species JSONB,
                timestamps JSONB,
                detection_count INTEGER,
                frames_with_animals INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

// Helper function to convert timestamp string to seconds
function convertTimestampToSeconds(timestampStr) {
    if (!timestampStr) return 0;

    timestampStr = timestampStr.trim();

    // Handle MM:SS format
    if (timestampStr.includes(':')) {
        const parts = timestampStr.split(':');
        try {
            const minutes = parseInt(parts[0]);
            const seconds = parseInt(parts[1]);
            return minutes * 60 + seconds;
        } catch {
            return 0;
        }
    } else {
        // Handle SS format
        try {
            return parseInt(timestampStr);
        } catch {
            return 0;
        }
    }
}

// Get all videos with tags (from database)
app.get('/api/videos', async (req, res) => {
    try {
        let videos = [];

        // Get videos from database if available
        if (pool) {
            const dbResult = await pool.query('SELECT * FROM videos ORDER BY created_at DESC');

            // Format videos for frontend
            videos = dbResult.rows.map(video => {
                // Parse species and timestamps (stored as JSONB)
                const species = video.species || [];
                const timestamps = video.timestamps || [];

                // Create animal tags
                const animalTags = [];
                if (species.length > 0 && timestamps.length > 0) {
                    const firstTimestampSeconds = convertTimestampToSeconds(timestamps[0]);
                    species.forEach(speciesName => {
                        animalTags.push({
                            name: speciesName,
                            timestamp: firstTimestampSeconds
                        });
                    });
                } else if (species.length > 0) {
                    // No timestamps, but we have species
                    species.forEach(speciesName => {
                        animalTags.push({
                            name: speciesName,
                            timestamp: 0
                        });
                    });
                }

                return {
                    title: video.title,
                    url: video.youtube_url,
                    description: video.description,
                    date: video.date,
                    animalTags: animalTags
                };
            });

            // Get user-submitted tags from database
            const userTagsResult = await pool.query('SELECT * FROM user_tags ORDER BY created_at ASC');

            // Merge user-submitted tags into videos
            userTagsResult.rows.forEach(dbTag => {
                if (videos[dbTag.video_index]) {
                    videos[dbTag.video_index].animalTags.push({
                        name: dbTag.name,
                        timestamp: dbTag.timestamp,
                        userSuggested: true
                    });
                }
            });
        } else {
            // Fallback to JSON file if no database (local development)
            const data = await fs.readFile(VIDEOS_FILE, 'utf8');
            const videosData = JSON.parse(data);
            videos = videosData.videos;
        }

        res.json({ videos });
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

        // If no database, return error (tags won't persist locally)
        if (!pool) {
            return res.status(503).json({ error: 'Database not available in local mode' });
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
