const liveServer = require('live-server');
const os = require('os');
const fs = require('fs');
const path = require('path');

const verbose = process.env.VERBOSE === 'true';
const devApiBaseUrl = process.env.PUBLIC_API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:3000';
const devTurnstileSiteKey = process.env.PUBLIC_TURNSTILE_SITE_KEY || process.env.VITE_TURNSTILE_SITE_KEY || '';

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
 * Watch callback function that invalidates the HTML cache when any source HTML file is modified,
 * while ignoring compiled production artifacts in dist/.
 *
 * @param {string} eventType - The fs.watch event type (e.g. 'change').
 * @param {string} filename - The name of the file that changed.
 */
const watchCallback = (eventType, filename) => {
    if (filename && filename.endsWith('.html')) {
        const normalized = filename.replace(/\\/g, '/');
        if (normalized.startsWith('dist/') || normalized === 'dist') {
            return;
        }
        cachedHtml = null;
        if (verbose) {
            console.log(`[Dev Server] HTML file changed (${filename}). Invalidating HTML cache.`);
        }
    }
};

const openBrowser = !process.argv.includes('--no-open') &&
                    !process.argv.includes('--no-browser') &&
                    process.env.npm_config_browser !== 'false' &&
                    process.env.npm_config_no_browser !== 'true';

let supportedLanguages = ['en', 'de', 'tr', 'zh'];
try {
    const languagesDataFile = fs.readFileSync(path.join(process.cwd(), 'js/data/languagesData.js'), 'utf8');
    const matches = [...languagesDataFile.matchAll(/code:\s*'([a-z0-9-]+)'[^}]*enabled:\s*true/g)].map(m => m[1]);
    if (matches.length > 0) {
        supportedLanguages = matches;
    }
} catch (e) {
    console.warn('[Dev Server] Could not parse languagesData.js dynamically');
}

let getDynamicTranslationArgs = () => ({});
import('../../js/i18n/i18nParams.js').then(mod => {
    getDynamicTranslationArgs = mod.getDynamicTranslationArgs;
}).catch(err => {
    console.warn('[Dev Server] Failed to load i18nParams.js:', err);
});

const { generateLocalizedHtml } = require('../build/htmlLocalizer.js');

function getDevEnvironmentData() {
    const packageJson = require(path.join(process.cwd(), 'package.json'));
    let gitHash = 'dev';
    try {
        const { execSync } = require('child_process');
        gitHash = execSync('git rev-parse --short HEAD').toString().trim();
    } catch (e) {}
    const appVersion = `${packageJson.version}+${gitHash}`;

    let commitsSinceTag = [];
    try {
        const { execSync } = require('child_process');
        let lastTag = '';
        try {
            lastTag = execSync('git describe --tags --abbrev=0').toString().trim();
        } catch (e) {}

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
                const timestamp = (Number(parts[1]) || 0) * 1000;
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
    } catch (error) {}

    const buildTime = process.env.BUILD_TIME || new Date().toISOString();
    return { appVersion, buildTime, commitsSinceTag };
}

function getDevEnvScript(appVersion, buildTime, commitsSinceTag) {
    return `<meta charset="UTF-8">\n    <script>window.__ENV__ = { PUBLIC_API_BASE_URL: "${devApiBaseUrl}", PUBLIC_TURNSTILE_SITE_KEY: "${devTurnstileSiteKey}", VITE_API_BASE_URL: "${devApiBaseUrl}", APP_VERSION: "${appVersion}", BUILD_TIME: "${buildTime}", COMMITS_SINCE_TAG: ${JSON.stringify(commitsSinceTag)} };</script>`;
}

function getCompiledIndexHtml(lang = 'en') {
    if (!cachedHtml) {
        const indexPath = path.join(process.cwd(), 'index.html');
        let content = fs.readFileSync(indexPath, 'utf8');
        content = processHtmlIncludes(content, process.cwd());

        const { appVersion, buildTime, commitsSinceTag } = getDevEnvironmentData();

        // Inject global environment context into index.html head for runtime API endpoint resolving
        content = content.replace('<meta charset="UTF-8">', getDevEnvScript(appVersion, buildTime, commitsSinceTag));
        cachedHtml = content;
    }
    return generateLocalizedHtml(cachedHtml, lang, supportedLanguages, lang === 'en', getDynamicTranslationArgs, process.cwd(), '');
}

function getCompiledHeroJourneyHtml(lang = 'en') {
    const hjPath = path.join(process.cwd(), 'hero-journey/index.html');
    if (!fs.existsSync(hjPath)) return '';
    let content = fs.readFileSync(hjPath, 'utf8');
    content = processHtmlIncludes(content, process.cwd());

    const { appVersion, buildTime, commitsSinceTag } = getDevEnvironmentData();
    content = content.replace('<meta charset="UTF-8">', getDevEnvScript(appVersion, buildTime, commitsSinceTag));

    return generateLocalizedHtml(content, lang, supportedLanguages, lang === 'en', getDynamicTranslationArgs, process.cwd(), 'hero-journey');
}

function getCompiledOreCalcHtml(lang = 'en') {
    const calcPath = path.join(process.cwd(), 'ore-calculator/index.html');
    if (!fs.existsSync(calcPath)) return '';
    let content = fs.readFileSync(calcPath, 'utf8');
    content = processHtmlIncludes(content, process.cwd());

    const { appVersion, buildTime, commitsSinceTag } = getDevEnvironmentData();
    content = content.replace('<meta charset="UTF-8">', getDevEnvScript(appVersion, buildTime, commitsSinceTag));

    return generateLocalizedHtml(content, lang, supportedLanguages, lang === 'en', getDynamicTranslationArgs, process.cwd(), 'ore-calculator');
}

function getCompiledDamageCalcHtml(lang = 'en') {
    const calcPath = path.join(process.cwd(), 'damage-calculator/index.html');
    if (!fs.existsSync(calcPath)) return '';
    let content = fs.readFileSync(calcPath, 'utf8');
    content = processHtmlIncludes(content, process.cwd());

    const { appVersion, buildTime, commitsSinceTag } = getDevEnvironmentData();
    content = content.replace('<meta charset="UTF-8">', getDevEnvScript(appVersion, buildTime, commitsSinceTag));

    return generateLocalizedHtml(content, lang, supportedLanguages, lang === 'en', getDynamicTranslationArgs, process.cwd(), 'damage-calculator');
}

/**
 * Constructs the configuration parameters for live-server.
 *
 * @param {Object} [overrides={}] - Optional configuration overrides for testing.
 * @returns {Object} Full live-server options object.
 */
function createDevServerParams(overrides = {}) {
    return {
        port: Number(process.env.PORT) || 8080,
        host: "0.0.0.0",
        root: ".",
        open: openBrowser,
        wait: 1000,
        logLevel: 2,
        ignore: [
            'dist',
            'dist/**',
            '**/dist/**',
            path.join(process.cwd(), 'dist'),
            'node_modules',
            'scratch',
            'tests'
        ],
        ignorePattern: /(?:^|[\\/])(dist|node_modules|scratch|tests)(?:[\\/]|$)/,
        ...overrides,
        middleware: [
        function(req, res, next) {
            const langPatternStr = supportedLanguages.join('|');
            const langAssetRegex = new RegExp(`^\\/(${langPatternStr})\\/(.+)$`);
            const exactLangRegex = new RegExp(`^\\/(${langPatternStr})\\/?$`);
            const exactLangNoSlash = supportedLanguages.map(l => `/${l}`);

            // Strip language prefix (/en/, /de/, /tr/, /zh/) for static asset requests if present
            const langPrefixMatch = req.url.match(langAssetRegex);
            if (langPrefixMatch) {
                const potentialAssetPath = path.join(process.cwd(), langPrefixMatch[2]);
                if (fs.existsSync(potentialAssetPath) && fs.statSync(potentialAssetPath).isFile()) {
                    req.url = '/' + langPrefixMatch[2];
                }
            }

            let pathname = req.url;
            let query = '';
            const qIdx = req.url.indexOf('?');
            if (qIdx !== -1) {
                pathname = req.url.substring(0, qIdx);
                query = req.url.substring(qIdx);
            }

            const isRoot = pathname === '/' || pathname === '/index.html';
            const isExactLangNoSlash = exactLangNoSlash.includes(pathname);
            const exactLangMatch = pathname.match(exactLangRegex);

            if (pathname.endsWith('.html') && pathname !== '/index.html' && pathname !== '/404.html') {
                const cleanPath = pathname.substring(0, pathname.length - 5);
                res.writeHead(301, { Location: `${cleanPath}/${query}` });
                return res.end();
            }

            if (['/privacy', '/terms', '/licenses', '/de/privacy', '/de/terms'].includes(pathname)) {
                res.writeHead(301, { Location: `${pathname}/${query}` });
                return res.end();
            }

            if (['/hero-journey', '/de/hero-journey', '/tr/hero-journey', '/zh/hero-journey'].includes(pathname)) {
                res.writeHead(301, { Location: `${pathname}/${query}` });
                return res.end();
            }

            if (pathname === '/hero-journey/') {
                const html = getCompiledHeroJourneyHtml('en');
                res.setHeader('Content-Type', 'text/html');
                return res.end(html);
            }
            const hjLangMatch = pathname.match(/^\/([a-z-]+)\/hero-journey\/$/);
            if (hjLangMatch && supportedLanguages.includes(hjLangMatch[1])) {
                const html = getCompiledHeroJourneyHtml(hjLangMatch[1]);
                res.setHeader('Content-Type', 'text/html');
                return res.end(html);
            }

            if (['/ore-calculator', '/de/ore-calculator', '/tr/ore-calculator', '/zh/ore-calculator'].includes(pathname)) {
                res.writeHead(301, { Location: `${pathname}/${query}` });
                return res.end();
            }

            if (pathname === '/ore-calculator/') {
                const html = getCompiledOreCalcHtml('en');
                res.setHeader('Content-Type', 'text/html');
                return res.end(html);
            }
            const oreCalcLangMatch = pathname.match(/^\/([a-z-]+)\/ore-calculator\/$/);
            if (oreCalcLangMatch && supportedLanguages.includes(oreCalcLangMatch[1])) {
                const html = getCompiledOreCalcHtml(oreCalcLangMatch[1]);
                res.setHeader('Content-Type', 'text/html');
                return res.end(html);
            }

            if (['/damage-calculator', '/de/damage-calculator', '/tr/damage-calculator', '/zh/damage-calculator'].includes(pathname)) {
                res.writeHead(301, { Location: `${pathname}/${query}` });
                return res.end();
            }

            if (pathname === '/damage-calculator/') {
                const html = getCompiledDamageCalcHtml('en');
                res.setHeader('Content-Type', 'text/html');
                return res.end(html);
            }
            const damageCalcLangMatch = pathname.match(/^\/([a-z-]+)\/damage-calculator\/$/);
            if (damageCalcLangMatch && supportedLanguages.includes(damageCalcLangMatch[1])) {
                const html = getCompiledDamageCalcHtml(damageCalcLangMatch[1]);
                res.setHeader('Content-Type', 'text/html');
                return res.end(html);
            }

            if (pathname === '/css/hero-journey.css' || pathname === '/hero-journey/css/hero-journey.css') {
                const scssPath = path.join(process.cwd(), 'css/hero-journey.scss');
                if (fs.existsSync(scssPath)) {
                    try {
                        const sass = require('sass');
                        const result = sass.compile(scssPath);
                        res.setHeader('Content-Type', 'text/css');
                        return res.end(result.css);
                    } catch (e) {
                        return next();
                    }
                }
            }

            if (pathname === '/css/damage-calculator.css' || pathname === '/damage-calculator/css/damage-calculator.css') {
                const scssPath = path.join(process.cwd(), 'css/damage-calculator.scss');
                if (fs.existsSync(scssPath)) {
                    try {
                        const sass = require('sass');
                        const result = sass.compile(scssPath);
                        res.setHeader('Content-Type', 'text/css');
                        return res.end(result.css);
                    } catch (e) {
                        return next();
                    }
                }
            }

            if (pathname === '/css/landing.css') {
                const scssPath = path.join(process.cwd(), 'css/landing.scss');
                if (fs.existsSync(scssPath)) {
                    try {
                        const sass = require('sass');
                        const result = sass.compile(scssPath);
                        res.setHeader('Content-Type', 'text/css');
                        return res.end(result.css);
                    } catch (e) {
                        return next();
                    }
                }
            }

            if (pathname === '/de/licenses' || pathname === '/de/licenses/') {
                res.writeHead(301, { Location: `/licenses/${query}` });
                return res.end();
            }

            if (pathname === '/en' || pathname === '/en/') {
                res.writeHead(301, { Location: `/${query}` });
                return res.end();
            } else if (pathname.startsWith('/en/')) {
                res.writeHead(301, { Location: (pathname.replace(/^\/en/, '') || '/') + query });
                return res.end();
            }

            if (['/privacy/', '/terms/', '/licenses/'].includes(pathname) ||
                ['/de/privacy/', '/de/terms/'].includes(pathname)) {
                let file = '';
                if (pathname.includes('privacy')) {
                    file = pathname.startsWith('/de') ? 'legal/privacy-de.html' : 'legal/privacy-en.html';
                } else if (pathname.includes('terms')) {
                    file = pathname.startsWith('/de') ? 'legal/terms-de.html' : 'legal/terms-en.html';
                } else if (pathname.includes('licenses')) {
                    file = 'legal/licenses.html';
                }
                const filePath = path.join(process.cwd(), file);
                if (fs.existsSync(filePath)) {
                    res.setHeader('Content-Type', 'text/html');
                    return res.end(fs.readFileSync(filePath, 'utf8'));
                } else {
                    return next();
                }
            } else if (pathname === '/404' || pathname === '/404/' || pathname === '/404.html') {
                const filePath = path.join(process.cwd(), '404.html');
                if (fs.existsSync(filePath)) {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    return res.end(fs.readFileSync(filePath, 'utf8'));
                }
                return next();
            } else if (pathname.startsWith('/licenses/') && pathname.endsWith('.txt')) {
                const textPath = path.join(process.cwd(), 'legal', pathname);
                if (fs.existsSync(textPath)) {
                    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    return res.end(fs.readFileSync(textPath, 'utf8'));
                } else {
                    return next();
                }
            } else if (pathname === '/legal/legal.css') {
                const cssPath = path.join(process.cwd(), 'legal/legal.css');
                const scssPath = path.join(process.cwd(), 'legal/legal.scss');
                if (fs.existsSync(cssPath)) {
                    res.setHeader('Content-Type', 'text/css');
                    return res.end(fs.readFileSync(cssPath, 'utf8'));
                } else if (fs.existsSync(scssPath)) {
                    try {
                        const sass = require('sass');
                        const result = sass.compile(scssPath);
                        res.setHeader('Content-Type', 'text/css');
                        return res.end(result.css);
                    } catch (e) {
                        return next();
                    }
                } else {
                    return next();
                }
            } else if (pathname === '/legal/legal.js') {
                const jsPath = path.join(process.cwd(), 'legal/legal.js');
                if (fs.existsSync(jsPath)) {
                    res.setHeader('Content-Type', 'text/javascript');
                    return res.end(fs.readFileSync(jsPath, 'utf8'));
                } else {
                    return next();
                }
            } else if (isExactLangNoSlash) {
                res.writeHead(301, { Location: `${pathname}/${query}` });
                return res.end();
            } else if (isRoot) {
                const html = getCompiledIndexHtml('en');
                res.setHeader('Content-Type', 'text/html');
                return res.end(html);
            } else if (exactLangMatch) {
                const lang = exactLangMatch[1];
                const html = getCompiledIndexHtml(lang);
                res.setHeader('Content-Type', 'text/html');
                return res.end(html);
            }

            // Check if the requested path corresponds to an existing static file on disk
            const staticFilePath = path.join(process.cwd(), pathname);
            if (fs.existsSync(staticFilePath) && fs.statSync(staticFilePath).isFile()) {
                return next();
            }

            // All unrecognized routes serve 404.html with true HTTP 404 status
            const errorFilePath = path.join(process.cwd(), '404.html');
            if (fs.existsSync(errorFilePath)) {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                return res.end(fs.readFileSync(errorFilePath, 'utf8'));
            }

            next();
        }
    ]
    };
}

if (require.main === module) {
    fs.watch(process.cwd(), watchCallback);
    const partialsDir = path.join(process.cwd(), 'partials');
    if (fs.existsSync(partialsDir)) {
        fs.watch(partialsDir, { recursive: true }, watchCallback);
    }

    const params = createDevServerParams();
    liveServer.start(params);
    console.log(`Serving on your local network IP as well (accessible from other devices on the network): http://${localIp}:${params.port}`);
}

module.exports = {
    createDevServerParams,
    watchCallback
};
