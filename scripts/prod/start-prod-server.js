const express = require('express');
const compression = require('compression');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8081;

app.use(compression());

app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

const distPath = path.join(__dirname, '../../dist');

// Redirect direct requests for legal/extra HTML files to trailing slash canonical URLs
app.use((req, res, next) => {
    if (req.path.endsWith('.html') && req.path !== '/index.html') {
        const cleanPath = req.path.substring(0, req.path.length - 5);
        const query = req.url.substring(req.path.length);
        return res.redirect(301, cleanPath + '/' + query);
    }

    // Explicit 301 redirects for legacy non-trailing-slash routes
    if (['/privacy', '/terms', '/licenses', '/de/privacy', '/de/terms', '/hero-journey', '/de/hero-journey', '/tr/hero-journey', '/zh/hero-journey'].includes(req.path)) {
        const query = req.url.substring(req.path.length);
        return res.redirect(301, req.path + '/' + query);
    }
    if (req.path === '/de/licenses' || req.path === '/de/licenses/') {
        return res.redirect(301, '/licenses/');
    }
    if (req.path === '/en' || req.path === '/en/') {
        return res.redirect(301, '/');
    }
    if (req.path.startsWith('/en/')) {
        return res.redirect(301, req.path.replace(/^\/en/, '') || '/');
    }
    next();
});

// Serve static assets with clean URLs and long-term cache headers
app.use(express.static(distPath, {
    extensions: ['html'],
    maxAge: '1d',
    setHeaders: (res, filePath) => {
        const relativePath = path.relative(distPath, filePath);

        // Only cache static image assets and fonts immutably for 6 months (180 days = 15,552,000s)
        const isImmutableAsset = /\.(png|jpg|jpeg|gif|ico|svg|avif|webp|woff2?)$/i.test(filePath);
        if (isImmutableAsset) {
            res.setHeader('Cache-Control', 'public, max-age=15552000, immutable');
        } else {
            // All JS, CSS, HTML, JSON, and metadata files revalidate fresh
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// Serve 404.html with status 404 for all unrecognized routes
app.use((req, res) => {
    res.status(404).sendFile(path.join(distPath, '404.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Production Server] Listening at http://0.0.0.0:${PORT}`);
});
