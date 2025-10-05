const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Path to videos data file
const VIDEOS_FILE = path.join(__dirname, 'videos.json');

// Get all videos with tags
app.get('/api/videos', async (req, res) => {
    try {
        const data = await fs.readFile(VIDEOS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading videos:', error);
        res.status(500).json({ error: 'Failed to load videos' });
    }
});

// Add a tag to a video
app.post('/api/videos/:videoIndex/tags', async (req, res) => {
    try {
        const { videoIndex } = req.params;
        const { name, timestamp, contributedBy } = req.body;

        // Validate input
        if (!name || timestamp === undefined) {
            return res.status(400).json({ error: 'Missing name or timestamp' });
        }

        // Read current videos data
        const data = await fs.readFile(VIDEOS_FILE, 'utf8');
        const videosData = JSON.parse(data);

        // Check if video exists
        if (!videosData.videos[videoIndex]) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Initialize animalTags array if it doesn't exist
        if (!videosData.videos[videoIndex].animalTags) {
            videosData.videos[videoIndex].animalTags = [];
        }

        // Add the new tag
        const newTag = {
            name: name,
            timestamp: parseInt(timestamp),
            userSuggested: true
        };

        // Add contributor name if provided
        if (contributedBy) {
            newTag.contributedBy = contributedBy;
        }

        videosData.videos[videoIndex].animalTags.push(newTag);

        // Write back to file
        await fs.writeFile(VIDEOS_FILE, JSON.stringify(videosData, null, 2), 'utf8');

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
