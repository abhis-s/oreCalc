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

const localesMap = { en: 'en_US', de: 'de_DE', tr: 'tr_TR', zh: 'zh_CN', 'zh-TW': 'zh_TW' };

function getNestedValue(obj, keyPath) {
    return keyPath.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
}

function resolveTranslation(translations, key, lang) {
    let val = getNestedValue(translations, key);
    if (typeof val !== 'string') return null;

    const dynamicArgs = getDynamicTranslationArgs(key, lang, (k) => getNestedValue(translations, k) || '');
    if (dynamicArgs && Object.keys(dynamicArgs).length > 0) {
        for (const [paramKey, paramVal] of Object.entries(dynamicArgs)) {
            val = val.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), paramVal);
        }
    }
    return val;
}

function injectOrReplaceAttribute(tagHtml, attrName, attrValue) {
    const escapedValue = attrValue.replace(/"/g, '&quot;');
    const attrRegex = new RegExp(`(?<!-)\\b${attrName}="[^"]*"`, 'i');
    if (attrRegex.test(tagHtml)) {
        return tagHtml.replace(attrRegex, `${attrName}="${escapedValue}"`);
    }
    if (tagHtml.endsWith('/>')) {
        return tagHtml.slice(0, -2) + ` ${attrName}="${escapedValue}"/>`;
    }
    return tagHtml.slice(0, -1) + ` ${attrName}="${escapedValue}">`;
}

function generateLocalizedHtml(baseHtml, lang) {
    const i18nFilePath = path.join(process.cwd(), `js/i18n/${lang}.json`);
    if (!fs.existsSync(i18nFilePath)) {
        return baseHtml;
    }
    const translations = JSON.parse(fs.readFileSync(i18nFilePath, 'utf8'));
    const title = translations.app?.title || 'Clash of Clans Ore Calculator & Equipment Planner | OreCalc';
    const description = translations.app?.description || '';
    const locale = localesMap[lang] || `${lang}_${lang.toUpperCase()}`;
    const url = `https://orecalc.tech/${lang}/`;

    let html = baseHtml;
    html = html.replace(/<html lang="[^"]*">/, `<html lang="${lang}">`);
    html = html.replace(/<title[^>]*>.*?<\/title>/s, `<title data-i18n="app.title">${title}</title>`);
    html = html.replace(/<meta name="description"\s+content="[^"]*">/s, `<meta name="description" content="${description}">`);
    html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`);
    html = html.replace(/<meta property="og:title" content="[^"]*">/g, `<meta property="og:title" content="${title}">`);
    html = html.replace(/<meta property="og:description"\s+content="[^"]*">/g, `<meta property="og:description" content="${description}">`);
    html = html.replace(/<meta property="og:url" content="[^"]*">/g, `<meta property="og:url" content="${url}">`);
    if (html.includes('<meta property="og:locale"')) {
        html = html.replace(/<meta property="og:locale" content="[^"]*">/, `<meta property="og:locale" content="${locale}">`);
    } else {
        html = html.replace(/<meta property="og:type" content="website">/, `<meta property="og:type" content="website">\n    <meta property="og:locale" content="${locale}">`);
    }
    html = html.replace(/<meta property="twitter:title" content="[^"]*">/g, `<meta property="twitter:title" content="${title}">`);
    html = html.replace(/<meta property="twitter:description"\s+content="[^"]*">/g, `<meta property="twitter:description" content="${description}">`);
    html = html.replace(/<meta property="twitter:url" content="[^"]*">/g, `<meta property="twitter:url" content="${url}">`);
    html = html.replace(/"description": "[^"]*"/, `"description": "${description.replace(/"/g, '\\"')}"`);
    html = html.replace(/"url": "[^"]*"/, `"url": "${url}"`);

    html = html.replace(/<([a-z1-6]+)([^>]*?)\s+data-i18n="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi, (match, tagName, attrsBefore, key, attrsAfter) => {
        const val = resolveTranslation(translations, key, lang);
        if (val !== null && val.trim()) {
            return `<${tagName}${attrsBefore} data-i18n="${key}"${attrsAfter}>${val}</${tagName}>`;
        }
        return match;
    });

    html = html.replace(/<([a-z1-6]+)([^>]*?\s+data-i18n-placeholder="([^"]+)"[^>]*)>/gi, (match, tagName, allAttrs, key) => {
        const val = resolveTranslation(translations, key, lang);
        if (val !== null) {
            return injectOrReplaceAttribute(match, 'placeholder', val);
        }
        return match;
    });

    html = html.replace(/<([a-z1-6]+)([^>]*?\s+data-i18n-title="([^"]+)"[^>]*)>/gi, (match, tagName, allAttrs, key) => {
        const val = resolveTranslation(translations, key, lang);
        if (val !== null) {
            return injectOrReplaceAttribute(match, 'title', val);
        }
        return match;
    });

    html = html.replace(/<([a-z1-6]+)([^>]*?\s+data-i18n-aria-label="([^"]+)"[^>]*)>/gi, (match, tagName, allAttrs, key) => {
        const val = resolveTranslation(translations, key, lang);
        if (val !== null) {
            return injectOrReplaceAttribute(match, 'aria-label', val);
        }
        return match;
    });

    html = html.replace(/<([a-z1-6]+)([^>]*?\s+data-i18n-alt="([^"]+)"[^>]*)>/gi, (match, tagName, allAttrs, key) => {
        const val = resolveTranslation(translations, key, lang);
        if (val !== null) {
            return injectOrReplaceAttribute(match, 'alt', val);
        }
        return match;
    });

    return html;
}

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
    } catch (error) {}

    const buildTime = process.env.BUILD_TIME || new Date().toISOString();
    return { appVersion, buildTime, commitsSinceTag };
}

function getCompiledIndexHtml(lang = 'en') {
    if (!cachedHtml) {
        const indexPath = path.join(process.cwd(), 'index.html');
        let content = fs.readFileSync(indexPath, 'utf8');
        content = processHtmlIncludes(content, process.cwd());

        const { appVersion, buildTime, commitsSinceTag } = getDevEnvironmentData();

        // Inject global environment context into index.html head for runtime API endpoint resolving
        content = content.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n    <script>window.__ENV__ = { VITE_API_BASE_URL: "${devApiBaseUrl}", APP_VERSION: "${appVersion}", BUILD_TIME: "${buildTime}", COMMITS_SINCE_TAG: ${JSON.stringify(commitsSinceTag)} };</script>`);
        cachedHtml = content;
    }
    return generateLocalizedHtml(cachedHtml, lang);
}

function getCompiledHeroJourneyHtml(lang = 'en') {
    const hjPath = path.join(process.cwd(), 'hero-journey.html');
    if (!fs.existsSync(hjPath)) return '';
    let content = fs.readFileSync(hjPath, 'utf8');
    content = processHtmlIncludes(content, process.cwd());

    const { appVersion, buildTime, commitsSinceTag } = getDevEnvironmentData();
    content = content.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n    <script>window.__ENV__ = { VITE_API_BASE_URL: "${devApiBaseUrl}", APP_VERSION: "${appVersion}", BUILD_TIME: "${buildTime}", COMMITS_SINCE_TAG: ${JSON.stringify(commitsSinceTag)} };</script>`);

    if (lang !== 'en') {
        const { generateLocalizedHtml } = require('../build/htmlLocalizer.js');
        content = generateLocalizedHtml(content, lang, supportedLanguages, false, getDynamicTranslationArgs, process.cwd(), 'hero-journey');
    }
    return content;
}

const params = {
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 8080,
    host: "0.0.0.0",
    root: ".",
    open: openBrowser,
    wait: 1000,
    logLevel: 2,
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

liveServer.start(params);

console.log(`Serving on your local network IP as well (accessible from other devices on the network): http://${localIp}:${params.port}`);
