const liveServer = require('live-server');
const os = require('os');
const fs = require('fs');
const path = require('path');

const verbose = process.env.VERBOSE === 'true';
const devApiBaseUrl = process.env.VITE_API_BASE_URL || 'http://localhost:3000';

/**
 * Searches the host OS network interfaces to find the external, non-loopback IPv4 address.
 * This is printed at server startup to allow testing from physical mobile devices on the same Wi-Fi.
 *
 * @returns {string} The local IPv4 address (e.g. '192.168.1.15') or 'localhost' if none found.
 */
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const localIp = getLocalIpAddress();

/**
 * Recursively parses HTML content in development mode, resolving include comments.
 * E.g., `<!-- include: partials/navbar.html -->`.
 *
 * @param {string} htmlContent - Raw HTML input.
 * @param {string} rootDir - Root directory to resolve relative include paths against.
 * @returns {string} The fully compiled HTML with all recursively resolved inclusions.
 */
function processHtmlIncludes(htmlContent, rootDir) {
    return htmlContent.replace(/<!--\s*include:\s*(.*?)\s*-->/g, (match, filePath) => {
        const fullPath = path.join(rootDir, filePath.trim());
        if (fs.existsSync(fullPath)) {
            if (verbose) {
                console.log(`[Dev Server] Including: ${fullPath}`);
            }
            let content = fs.readFileSync(fullPath, 'utf8');
            return processHtmlIncludes(content, rootDir);
        } else {
            console.warn(`[Dev Server] Warning: Include file not found: ${fullPath}`);
            return match;
        }
    });
}

// In-memory HTML cache used by the live-server middleware to avoid reading and compiling
// index.html on every page request unless files actually change.
let cachedHtml = null;

/**
 * Watch callback function that invalidates the HTML cache when any HTML file is modified.
 *
 * @param {string} eventType - The fs.watch event type (e.g. 'change').
 * @param {string} filename - The name of the file that changed.
 */
const watchCallback = (eventType, filename) => {
    if (filename && filename.endsWith('.html')) {
        cachedHtml = null;
        if (verbose) {
            console.log(`[Dev Server] HTML file changed (${filename}). Invalidating HTML cache.`);
        }
    }
};

fs.watch(process.cwd(), watchCallback);
const partialsDir = path.join(process.cwd(), 'partials');
if (fs.existsSync(partialsDir)) {
    fs.watch(partialsDir, { recursive: true }, watchCallback);
}

const openBrowser = process.env.OPEN_BROWSER !== 'false' && !process.argv.includes('--no-open');

const params = {
    port: 8080,
    host: "0.0.0.0",
    root: ".",
    open: openBrowser,
    file: "index.html",
    wait: 1000,
    logLevel: 2,
    middleware: [
        // Custom middleware to intercept index.html requests, dynamically inject environment configs,
        // and serve the processed HTML directly from cache or compile it on the fly.
        function(req, res, next) {
            // Parse URL safely to extract pathname and query parameters
            let pathname = req.url;
            let query = '';
            const qIdx = req.url.indexOf('?');
            if (qIdx !== -1) {
                pathname = req.url.substring(0, qIdx);
                query = req.url.substring(qIdx);
            }

            if (pathname === '/' || pathname === '/index.html') {
                if (!cachedHtml) {
                    const indexPath = path.join(process.cwd(), 'index.html');
                    let content = fs.readFileSync(indexPath, 'utf8');
                    content = processHtmlIncludes(content, process.cwd());
                    
                    const packageJson = require(path.join(process.cwd(), 'package.json'));
                    let gitHash = 'dev';
                    try {
                        const { execSync } = require('child_process');
                        gitHash = execSync('git rev-parse --short HEAD').toString().trim();
                    } catch (e) {
                        // fallback
                    }
                    const appVersion = `${packageJson.version}+${gitHash}`;

                    let commitsSinceTag = [];
                    try {
                        const { execSync } = require('child_process');
                        let lastTag = '';
                        try {
                            lastTag = execSync('git describe --tags --abbrev=0').toString().trim();
                        } catch (e) {
                            // No tag exists
                        }

                        const range = lastTag ? `${lastTag}..HEAD` : '';
                        const logCmd = range 
                            ? `git log ${range} --pretty=format:"%h|%at|%s"` 
                            : `git log -n 50 --pretty=format:"%h|%at|%s"`;
                        const logOutput = execSync(logCmd).toString().trim();

                        if (logOutput) {
                            const lines = logOutput.split('\n');
                            const commits = lines.map(line => {
                                const parts = line.split('|');
                                const hash = parts[0];
                                const timestamp = parseInt(parts[1], 10) * 1000;
                                const subject = parts.slice(2).join('|');
                                return { hash, timestamp, subject };
                            });

                            const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                            const commitsInLastWeek = commits.filter(c => c.timestamp >= oneWeekAgo);
                            
                            let selectedCommits = [];
                            if (commitsInLastWeek.length >= 3) {
                                selectedCommits = commitsInLastWeek;
                            } else {
                                selectedCommits = commits.slice(0, Math.min(3, commits.length));
                            }
                            commitsSinceTag = selectedCommits.map(c => ({ hash: c.hash, subject: c.subject }));
                        }
                    } catch (error) {
                        // fallback
                    }

                    // Inject global environment context into index.html head for runtime API endpoint resolving
                    content = content.replace('<head>', `<head>\n    <script>window.__ENV__ = { VITE_API_BASE_URL: "${devApiBaseUrl}", APP_VERSION: "${appVersion}", COMMITS_SINCE_TAG: ${JSON.stringify(commitsSinceTag)} };</script>`);
                    cachedHtml = content;
                }
                res.setHeader('Content-Type', 'text/html');
                res.end(cachedHtml);
            } else if (['/privacy', '/terms', '/licenses', '/404'].includes(pathname)) {
                // Serve the corresponding static html file cleanly
                const filePath = path.join(process.cwd(), `${pathname.substring(1)}.html`);
                if (fs.existsSync(filePath)) {
                    res.setHeader('Content-Type', 'text/html');
                    res.end(fs.readFileSync(filePath, 'utf8'));
                } else {
                    next();
                }
            } else if (pathname.endsWith('.html') && pathname !== '/index.html') {
                // Redirect direct requests for .html files to their clean versions
                const cleanPath = pathname.substring(0, pathname.length - 5);
                res.writeHead(301, { Location: cleanPath + query });
                res.end();
            } else {
                next();
            }
        }
    ]
};

liveServer.start(params);

console.log(`Serving on your local network IP as well (accessible from other devices on the network): http://${localIp}:${params.port}`);
