const express = require('express');
const compression = require('compression');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8081;

// Enable gzip compression for all responses
app.use(compression());

const distPath = path.join(__dirname, '../../dist');

// Redirect direct requests for legal/extra HTML files to extensionless clean URLs
app.use((req, res, next) => {
    if (req.path.endsWith('.html') && req.path !== '/index.html') {
        const cleanPath = req.path.substring(0, req.path.length - 5);
        const query = req.url.substring(req.path.length);
        return res.redirect(301, cleanPath + query);
    }
    
    // Explicitly serve root-level HTML files for clean paths that share directory names (e.g. /privacy, /terms, /licenses)
    if (!req.path.includes('.')) {
        const htmlFile = path.join(distPath, `${req.path.substring(1)}.html`);
        const fs = require('fs');
        if (fs.existsSync(htmlFile)) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            return res.sendFile(htmlFile);
        }
    }
    next();
});

// Serve static assets with clean URLs and long-term cache headers
app.use(express.static(distPath, {
    extensions: ['html'],
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