/**
 * Simple Express server for NSU Commute Optimizer
 * Serves HTML and CSV files with proper CORS headers
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_DIR = path.join(__dirname, 'data');
const HTML_FILE = 'index.html';

// Enable CORS for all routes
app.use(cors());

// Log all requests in development
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
    });
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
    console.log(`Created ${DATA_DIR} directory - please add your CSV files there`);
}

// Serve main HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, HTML_FILE), (err) => {
        if (err) {
            res.status(404).json({ error: 'index.html not found' });
        }
    });
});

// Serve CSV files from data directory
app.get('/api/:filename', (req, res) => {
    const filename = req.params.filename;
    
    // Security: only allow CSV files
    if (!filename.endsWith('.csv')) {
        return res.status(403).json({ error: 'Only CSV files allowed' });
    }
    
    const filePath = path.join(DATA_DIR, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `${filename} not found` });
    }
    
    // Set proper MIME type and send file
    res.type('text/csv');
    res.sendFile(filePath);
});

// Health check endpoint
app.get('/health', (req, res) => {
    const dataFiles = fs.existsSync(DATA_DIR) 
        ? fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.csv'))
        : [];
    
    res.json({
        status: 'healthy',
        version: '3.0',
        data_files: dataFiles,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Resource not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║   NSU Commute Optimizer Server v3.0          ║
╠══════════════════════════════════════════════╣
║  Server running...                           ║
║  URL:    http://localhost:${PORT.toString().padEnd(5)}                     ║
║  API:    http://localhost:${PORT}/api/            ║
║  Health: http://localhost:${PORT}/health          ║
╚══════════════════════════════════════════════╝
    `);
    
    // Check for required files
    if (!fs.existsSync(HTML_FILE)) {
        console.log(`⚠️  Warning: ${HTML_FILE} not found!`);
    }
    
    const requiredCsvs = ['Locations.csv', 'Tracks.csv', 'Variance.csv'];
    requiredCsvs.forEach(csv => {
        if (!fs.existsSync(path.join(DATA_DIR, csv))) {
            console.log(`⚠️  Warning: ${DATA_DIR}/${csv} not found!`);
        }
    });
    
    console.log('\n✓ Press Ctrl+C to stop the server\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n\nShutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n\nShutting down gracefully...');
    process.exit(0);
});
