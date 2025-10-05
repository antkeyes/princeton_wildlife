// Function to extract YouTube video ID from URL
function getYouTubeVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Function to create animal tags HTML
function createAnimalTags(animalTags, videoId, cardId) {
    const tags = animalTags || [];

    // Separate original tags from user-suggested tags
    const originalTags = tags.filter(tag => !tag.userSuggested);
    const userSuggestedTags = tags.filter(tag => tag.userSuggested);

    // Create HTML for original tags
    const originalTagsHTML = originalTags.map((tag, index) => {
        const tagIndex = tags.indexOf(tag);
        return `<button class="animal-tag" data-timestamp="${tag.timestamp}" data-video-id="${videoId}" data-card-id="${cardId}" data-tag-index="${tagIndex}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="10 8 16 12 10 16 10 8"></polygon>
            </svg>
            ${tag.name}
        </button>`;
    }).join('');

    // Create HTML for user-suggested tags
    const userSuggestedTagsHTML = userSuggestedTags.map((tag, index) => {
        const tagIndex = tags.indexOf(tag);
        return `<button class="animal-tag user-suggested" data-timestamp="${tag.timestamp}" data-video-id="${videoId}" data-card-id="${cardId}" data-tag-index="${tagIndex}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="10 8 16 12 10 16 10 8"></polygon>
            </svg>
            ${tag.name}
        </button>`;
    }).join('');

    // Build the complete tags section
    let tagsSection = `<div class="animal-tags">`;

    // Only show "Animals spotted:" section if there are original tags
    if (originalTags.length > 0) {
        tagsSection += `
        <div class="tags-label">Animals spotted:</div>
        <div class="tags-container" id="tags-container-${cardId}">${originalTagsHTML}</div>`;
    }

    // Add "TAGGED BY VIEWERS" section
    tagsSection += `
        <div class="viewer-tags-section">
            <div class="tags-label">TAGGED BY VIEWERS:</div>
            <div class="viewer-tags-container" id="viewer-tags-container-${cardId}">${userSuggestedTagsHTML}</div>
            <button class="suggest-animal-btn" data-card-id="${cardId}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                See an animal I missed?
            </button>
        </div>
    </div>`;

    return tagsSection;
}

// Function to create a video card
function createVideoCard(video, index) {
    const videoId = getYouTubeVideoId(video.url);
    if (!videoId) return null;

    const cardId = `video-card-${index}`;
    const card = document.createElement('div');
    card.className = 'video-card';
    card.id = cardId;

    // Enable JS API for YouTube iframe
    card.innerHTML = `
        <div class="video-wrapper">
            <iframe
                id="iframe-${cardId}"
                src="https://www.youtube.com/embed/${videoId}?enablejsapi=1"
                title="${video.title}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen>
            </iframe>
        </div>
        <div class="video-info">
            ${video.date ? `<span class="video-date">Recorded: ${video.date}</span>` : ''}
            <h3>${video.title}</h3>
            <p>${video.description}</p>
            ${createAnimalTags(video.animalTags, videoId, cardId)}
        </div>
    `;

    return card;
}

// Function to seek video to timestamp
function seekToTimestamp(cardId, timestamp) {
    const iframe = document.getElementById(`iframe-${cardId}`);
    if (iframe) {
        // Post message to YouTube iframe to seek to timestamp
        iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'seekTo',
            args: [timestamp, true]
        }), '*');

        // Also play the video
        iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'playVideo',
            args: []
        }), '*');
    }
}

// Store video data globally for tag additions
let videosData = null;

// API base URL - use relative path for production
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000/api'
    : '/api';

// Function to get current video timestamp
function getCurrentVideoTime(cardId) {
    const iframe = document.getElementById(`iframe-${cardId}`);
    if (iframe) {
        // Request current time from YouTube iframe
        iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'getCurrentTime',
            args: []
        }), '*');
    }
}

// Function to add a new tag to a video
async function addTagToVideo(cardId, animalName, timestamp) {
    const videoIndex = parseInt(cardId.replace('video-card-', ''));

    try {
        // Send tag to server
        const response = await fetch(`${API_URL}/videos/${videoIndex}/tags`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: animalName,
                timestamp: timestamp
            })
        });

        if (!response.ok) {
            throw new Error('Failed to add tag');
        }

        const result = await response.json();

        // Update local data
        if (videosData && videosData.videos[videoIndex]) {
            if (!videosData.videos[videoIndex].animalTags) {
                videosData.videos[videoIndex].animalTags = [];
            }
            videosData.videos[videoIndex].animalTags.push(result.tag);

            // Re-render the viewer tags section
            const viewerTagsContainer = document.getElementById(`viewer-tags-container-${cardId}`);
            if (viewerTagsContainer) {
                const videoId = getYouTubeVideoId(videosData.videos[videoIndex].url);
                const allTags = videosData.videos[videoIndex].animalTags;
                const userSuggestedTags = allTags.filter(tag => tag.userSuggested);

                viewerTagsContainer.innerHTML = userSuggestedTags.map((tag, index) => {
                    const tagIndex = allTags.indexOf(tag);
                    return `<button class="animal-tag user-suggested" data-timestamp="${tag.timestamp}" data-video-id="${videoId}" data-card-id="${cardId}" data-tag-index="${tagIndex}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polygon points="10 8 16 12 10 16 10 8"></polygon>
                        </svg>
                        ${tag.name}
                    </button>`;
                }).join('');

                // Re-attach event listeners to new tags
                attachTagClickListeners();

                // Update filter tags to include new animal
                if (videosData) {
                    populateFilterTags(videosData.videos);
                }
            }
        }
    } catch (error) {
        console.error('Error adding tag:', error);
        alert('Failed to add tag. Please try again.');
    }
}

// Function to attach click listeners to tags
function attachTagClickListeners() {
    document.querySelectorAll('.animal-tag').forEach(tag => {
        tag.addEventListener('click', function() {
            const timestamp = parseInt(this.getAttribute('data-timestamp'));
            const cardId = this.getAttribute('data-card-id');
            seekToTimestamp(cardId, timestamp);

            // Visual feedback
            this.classList.add('tag-clicked');
            setTimeout(() => {
                this.classList.remove('tag-clicked');
            }, 300);
        });
    });
}

// Function to show modal for adding animal tag
function showAddAnimalModal(cardId) {
    const modal = document.getElementById('add-animal-modal');
    const animalNameInput = document.getElementById('animal-name-input');
    const timestampInput = document.getElementById('timestamp-input');
    const submitBtn = document.getElementById('submit-animal-tag');
    const cancelBtn = document.getElementById('cancel-animal-tag');

    // Reset inputs
    animalNameInput.value = '';
    timestampInput.value = '';

    // Show modal
    modal.style.display = 'flex';
    animalNameInput.focus();

    // Handle submit
    submitBtn.onclick = () => {
        const animalName = animalNameInput.value.trim();
        const timestamp = parseInt(timestampInput.value);

        if (animalName && !isNaN(timestamp) && timestamp >= 0) {
            addTagToVideo(cardId, animalName, timestamp);
            modal.style.display = 'none';
        } else {
            alert('Please enter both an animal name and a valid timestamp (in seconds).');
        }
    };

    // Handle cancel
    cancelBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // Close on outside click
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// Global variable for active filter
let activeFilter = null;

// Function to get all unique animal names from videos
function getAllAnimalTags(videos) {
    const animalSet = new Set();
    videos.forEach(video => {
        if (video.animalTags && video.animalTags.length > 0) {
            video.animalTags.forEach(tag => {
                animalSet.add(tag.name);
            });
        }
    });
    // Sort alphabetically (case-insensitive)
    return Array.from(animalSet).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

// Function to populate filter tags
function populateFilterTags(videos) {
    const filterContainer = document.getElementById('filter-tags-container');
    if (!filterContainer) return;

    const allAnimals = getAllAnimalTags(videos);

    if (allAnimals.length === 0) {
        filterContainer.innerHTML = '<span class="no-filters">No tags available yet</span>';
        return;
    }

    // Add "Show All" button
    let html = `<button class="filter-tag ${activeFilter === null ? 'active' : ''}" data-filter="all">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
        Show All
    </button>`;

    // Add filter buttons for each animal
    allAnimals.forEach(animal => {
        html += `<button class="filter-tag ${activeFilter === animal ? 'active' : ''}" data-filter="${animal}">
            ${animal}
        </button>`;
    });

    filterContainer.innerHTML = html;

    // Attach click listeners to filter tags
    document.querySelectorAll('.filter-tag').forEach(tag => {
        tag.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            if (filter === 'all') {
                activeFilter = null;
            } else {
                activeFilter = filter;
            }
            filterVideos();
        });
    });
}

// Function to filter videos based on active filter
function filterVideos() {
    const allCards = document.querySelectorAll('.video-card');

    // Update active state on filter buttons
    document.querySelectorAll('.filter-tag').forEach(tag => {
        const filter = tag.getAttribute('data-filter');
        if ((filter === 'all' && activeFilter === null) || (filter === activeFilter)) {
            tag.classList.add('active');
        } else {
            tag.classList.remove('active');
        }
    });

    // Filter video cards
    allCards.forEach((card, index) => {
        if (!videosData || !videosData.videos[index]) {
            card.style.display = 'block';
            return;
        }

        const video = videosData.videos[index];

        if (activeFilter === null) {
            // Show all videos
            card.style.display = 'block';
        } else {
            // Check if video has the filtered animal tag
            const hasTag = video.animalTags && video.animalTags.some(tag => tag.name === activeFilter);
            card.style.display = hasTag ? 'block' : 'none';
        }
    });
}

// Function to load and display videos
async function loadVideos() {
    const videosGrid = document.getElementById('videos-grid');

    try {
        // Fetch videos from server API
        const response = await fetch(`${API_URL}/videos`);
        const data = await response.json();
        videosData = data; // Store globally

        if (data.videos && data.videos.length > 0) {
            // Populate filter tags
            populateFilterTags(data.videos);

            videosGrid.innerHTML = '';
            data.videos.forEach((video, index) => {
                const card = createVideoCard(video, index);
                if (card) {
                    videosGrid.appendChild(card);
                }
            });

            // Attach tag click listeners
            attachTagClickListeners();

            // Add click event listeners to "suggest animal" buttons
            document.querySelectorAll('.suggest-animal-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const cardId = this.getAttribute('data-card-id');
                    showAddAnimalModal(cardId);
                });
            });

            // Apply current filter if any
            if (activeFilter !== null) {
                filterVideos();
            }
        } else {
            videosGrid.innerHTML = '<p class="loading">No videos available yet.</p>';
        }
    } catch (error) {
        console.error('Error loading videos:', error);
        videosGrid.innerHTML = '<p class="loading">Error loading videos. Please check videos.json file.</p>';
    }
}

// Load videos when page loads
document.addEventListener('DOMContentLoaded', loadVideos);
