const express = require('express');
const compression = require('compression');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8081;

// Enable gzip compression for all responses
app.use(compression());

// Security Headers & HSTS Middleware
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://api-assets.clashofclans.com https://www.google-analytics.com; connect-src 'self' https://api.orecalc.tech https://*.googleapis.com https://*.firebaseio.com https://www.google-analytics.com https://a.nel.cloudflare.com; frame-src 'self'; object-src 'none'; base-uri 'self';");
    next();
});

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
        
        // Don't aggressively cache HTML documents, app entry points, manifests, metadata, or JSON dictionaries
        const isNonCacheable = filePath.endsWith('.html') || 
                               filePath.endsWith('.json') ||
                               filePath.endsWith('sitemap.xml') ||
                               filePath.endsWith('robots.txt') ||
                               filePath.endsWith('llms.txt') ||
                               relativePath === 'service-worker.js' ||
                               relativePath.endsWith('app.js') ||
                               relativePath.endsWith('workbox-window.js') ||
                               relativePath.endsWith('qr-code-styling.js');

        if (isNonCacheable) {
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