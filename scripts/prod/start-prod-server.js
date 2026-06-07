const express = require('express');
const compression = require('compression');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8081;

// Enable gzip compression for all responses
app.use(compression());

// Serve static assets with long-term cache headers
const distPath = path.join(__dirname, '../../dist');
app.use(express.static(distPath, {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
        const relativePath = path.relative(distPath, filePath);
        
        // Don't aggressively cache HTML documents or service worker
        if (filePath.endsWith('.html') || relativePath === 'service-worker.js') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        } else {
            // Cache static assets (CSS, JS, images, fonts) for 1 year (immutable)
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

// Fallback to index.html for client-side routing
app.get('/*splat', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Production server running at http://localhost:${PORT}`);
});