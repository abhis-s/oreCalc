/**
 * Checks whether an incoming error message matches ignored client noise patterns.
 * Ignored noise includes opaque extension script errors, tag lookups 404, CWL/War state logs,
 * browser-injected wallets (Brave, MetaMask, Phantom, Solana), and document line 1 injections.
 *
 * @param {string} message - Error message to inspect.
 * @param {string} [source=''] - Source file or URL.
 * @param {number} [line=0] - Line number where error originated.
 * @param {string} [stack=''] - Error stack trace.
 * @returns {boolean} True if the error is safe to discard completely.
 */
function isIgnoredNoise(message, source = '', line = 0, stack = '') {
    if (!message || typeof message !== 'string') return true;
    const str = message.trim();
    const sSrc = String(source || '').trim();
    const sStack = String(stack || '').trim();
    const sLine = Number(line) || 0;

    // Browser extension / opaque cross-origin script error
    if (str === 'Script error.' || str === 'Console Error: Script error.' || str.includes('Script error.')) {
        return true;
    }

    // Browser extension URLs in message, source, or stack
    if (/^(chrome|moz|safari|webkit)-extension:\/\//i.test(sSrc) ||
        /^(chrome|moz|safari|webkit)-extension:\/\//i.test(sStack) ||
        /(chrome|moz|safari|webkit)-extension:\/\//i.test(str)) {
        return true;
    }

    // Known browser and wallet injections (Brave Wallet, MetaMask, Phantom, Solana, Coinbase, native bridges)
    if (/ethereum|solana|web3|phantom|trustwallet|coinbase|__gCrWeb/i.test(str) ||
        /ethereum|solana|web3|phantom|trustwallet|coinbase|__gCrWeb/i.test(sStack)) {
        return true;
    }

    // Line 1 document scope errors (crypto wallets / bridges injected into HTML document scope)
    // ClashCalc client code is strictly served as external JS bundles, never inline at line 1 of HTML
    if (sLine === 1) {
        if (!sSrc || sSrc.endsWith('.html') || sSrc.endsWith('/') || !sSrc.includes('.js')) {
            return true;
        }
    }

    // Player tag / Clan search 404 or syntax typos
    if (
        str.includes('apiErrors.notFound') ||
        str.includes('Invalid Clash of Clans tag format') ||
        str.includes('Failed to load player data: apiErrors.notFound') ||
        str.includes('Failed to load player preview data: apiErrors.notFound')
    ) {
        return true;
    }

    // Expected game states (CWL inactive, private war log)
    if (
        str.includes('CWL league group: apiErrors.notFound') ||
        str.includes('CWL') ||
        str.includes('clan war log') ||
        str.includes('Clan war log is private') ||
        str.includes('apiErrors.privateWarLog')
    ) {
        return true;
    }

    // Service Worker lifecycle / background polling drops
    if (
        str.includes('SW registration failed') ||
        str.includes('SW update check failed') ||
        str.includes('ServiceWorker') ||
        str.includes('ResizeObserver')
    ) {
        return true;
    }

    // Clipboard permission denial / read failures (user denied permission or browser policy)
    if (
        str.toLowerCase().includes('clipboard') ||
        str.includes('Failed to read clipboard') ||
        str.includes('readText') ||
        str.includes('NotAllowedError')
    ) {
        return true;
    }

    return false;
}

/**
 * Checks whether an incoming request/error originates from a search crawler, bot, or automated renderer.
 *
 * @param {string} [userAgent=''] - User-Agent header or client-reported userAgent string.
 * @param {string} [message=''] - Error message text.
 * @param {string} [_url=''] - URL where the error occurred.
 * @returns {boolean} True if the traffic comes from a crawler, scraper, or bot.
 */
function isBotTraffic(userAgent = '', message = '', _url = '') {
    const ua = String(userAgent || '').toLowerCase();
    const msg = String(message || '').toLowerCase();

    // Known search engine crawlers, preview bots, security scanners, and headless renderers
    const botPatterns = [
        'googlebot',
        'google-inspectiontool',
        'storebot-google',
        'googleother',
        'mediapartners-google',
        'adsbot-google',
        'bingbot',
        'bingpreview',
        'msnbot',
        'microsoftpreview',
        'slurp',
        'duckduckbot',
        'duckduckgo-favicons-bot',
        'baiduspider',
        'yandex',
        'sogou',
        'exabot',
        'facebot',
        'facebookexternalhit',
        'meta-externalagent',
        'ia_archiver',
        'twitterbot',
        'telegrambot',
        'discordbot',
        'whatsapp',
        'petalbot',
        'semrushbot',
        'ahrefsbot',
        'dotbot',
        'mj12bot',
        'screaming frog',
        'headlesschrome',
        'phantomjs',
        'lighthouse',
        'chrome-lighthouse',
        'pagespeed',
        'prerender',
        'bytespider',
        'tiktokbot',
        'applebot',
        'amazonbot',
        'cohere-ai',
        'gptbot',
        'chatgpt-user',
        'anthropic-ai',
        'claude-web',
        'perplexitybot',
        'ccbot',
        'crawler',
        'spider',
        'scraper',
        'bot/',
        'bot;'
    ];

    if (botPatterns.some(pattern => ua.includes(pattern))) {
        return true;
    }

    if (msg.includes('googlebot') || msg.includes('bingbot') || msg.includes('headlesschrome')) {
        return true;
    }

    return false;
}

/**
 * Resolves the canonical environment/domain label from request context.
 *
 * @param {string} [environment='']
 * @param {string} [host='']
 * @param {string} [url='']
 * @returns {string} Standard domain label (e.g. 'clashcalc.com', 'orecalc.tech', 'beta.clashcalc.com', 'localhost')
 */
function resolveEmailDomain(environment = '', host = '', url = '') {
    const combined = `${environment} ${host} ${url}`.toLowerCase();
    if (combined.includes('localhost') || combined.includes('127.0.0.1')) {
        return 'localhost';
    }
    if (combined.includes('beta.clashcalc.com') || combined.includes('beta.orecalc.tech') || combined.includes('beta.')) {
        return 'beta.clashcalc.com';
    }
    if (combined.includes('orecalc.tech')) {
        return 'orecalc.tech';
    }
    return 'clashcalc.com';
}

/**
 * Parses user agent string into a readable browser and OS summary.
 *
 * @param {string} [userAgent='']
 * @returns {string} Summary string like 'Chrome on Android' or 'Safari on iOS'
 */
function parseDeviceSummary(userAgent = '') {
    if (!userAgent || typeof userAgent !== 'string') return 'Unknown Device';
    const ua = userAgent.toLowerCase();
    let browser = 'Browser';
    if (ua.includes('brave')) browser = 'Brave';
    else if (ua.includes('edg/')) browser = 'Edge';
    else if (ua.includes('chrome/')) browser = 'Chrome';
    else if (ua.includes('safari/') && !ua.includes('chrome/')) browser = 'Safari';
    else if (ua.includes('firefox/')) browser = 'Firefox';

    let os = 'OS';
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) os = 'iOS';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('macintosh') || ua.includes('mac os x')) os = 'macOS';
    else if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('linux')) os = 'Linux';

    return `${browser} on ${os}`;
}

/**
 * Normalizes error messages by stripping framework prefixes to expose the underlying error.
 *
 * @param {string} message - Raw error message.
 * @returns {string} Clean core error text.
 */
function normalizeErrorMessage(message) {
    if (!message || typeof message !== 'string') return '';
    return message
        .replace(/^Console Error:\s*(\[ERROR\]\s*)?/i, '')
        .replace(/^Unhandled Promise Rejection:\s*/i, '')
        .replace(/^Uncaught (error:\s*|TypeError:\s*)?/i, '')
        .replace(/^Failed to save data to cloud:\s*/i, '')
        .replace(/^Error saving user data:\s*/i, '')
        .replace(/^Failed to load data from cloud.*?:\s*/i, '')
        .replace(/^Error loading user data:\s*/i, '')
        .replace(/^Failed to save decoupled user preferences:\s*/i, '')
        .replace(/^Error saving user preferences:\s*/i, '')
        .trim();
}

/**
 * Formats a single or multi-error incident report into a structured ASCII card.
 *
 * @param {{ userId: string, domain: string, environment: string, errors: any[], firstSeenAt: number }} batch
 * @returns {string} Formatted email body.
 */
function formatIncidentCard(batch) {
    const { userId, domain, environment, errors, firstSeenAt } = batch;
    const count = errors.length;
    const firstErr = errors[0];
    const device = parseDeviceSummary(firstErr.userAgent);
    const timeUtc = new Date(firstSeenAt).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

    const header = [
        '================================================================================',
        'CLASHCALC CLIENT ERROR REPORT',
        '================================================================================',
        '',
        'INCIDENT SUMMARY',
        '--------------------------------------------------------------------------------',
        `Environment : ${domain} (${environment || 'Production'})`,
        `Occurred At : ${timeUtc}`,
        `User ID     : ${userId}`,
        `Browser / OS: ${device}`,
        `Page URL    : ${firstErr.url || 'N/A'}`,
        `Issues Seen : ${count} error(s) captured within 15-second window`,
        ''
    ].join('\n');

    const issues = errors.map((err, idx) => {
        const issueNum = idx + 1;
        const msg = err.message || 'Unknown error';
        const src = `${err.source || 'N/A'}:${err.line || 0}:${err.col || 0}`;
        const stack = err.stack ? err.stack.trim() : 'None provided';
        const recId = err.id || 'Logged to Firestore';

        return [
            '--------------------------------------------------------------------------------',
            `[Issue ${issueNum} of ${count}]`,
            `Message     : ${msg}`,
            `Source      : ${src}`,
            `Record ID   : ${recId}`,
            ...(err.url && err.url !== firstErr.url ? [`Page URL    : ${err.url}`] : []),
            '',
            'Stack Trace:',
            stack,
            ''
        ].join('\n');
    }).join('\n');

    const footer = [
        '================================================================================',
        'Database Record: clientErrors collection',
        'Notification managed by ClashCalc Error Monitoring'
    ].join('\n');

    return `${header}\n${issues}\n${footer}`;
}

/**
 * Computes a standardized signature key for throttling duplicate errors.
 *
 * @param {string} message - Error message.
 * @param {string} [source=''] - Source file.
 * @returns {string} Signature key.
 */
function computeErrorSignature(message, source = '') {
    const norm = normalizeErrorMessage(message);
    if (norm.includes('503') || norm.includes('apiErrors.503') || norm.includes('inMaintenance')) {
        return 'supercell_503_outage';
    }
    if (norm.includes('413') || norm.includes('apiErrors.413')) {
        return 'payload_too_large_413';
    }
    if (
        norm.includes('dynamically imported module') ||
        norm.includes('Importing a module script failed') ||
        norm.includes('dynamic import')
    ) {
        return 'chunk_deployment_mismatch';
    }
    if (norm.includes('702') || norm.includes('apiErrors.702')) {
        return 'api_error_702';
    }
    if (
        norm.includes('Failed to fetch') ||
        norm.includes('Load failed') ||
        norm.includes('NetworkError')
    ) {
        return 'transient_network_drop';
    }
    const cleanMsg = norm.split('\n')[0].replace(/\s+/g, ' ').substring(0, 100);
    return `${cleanMsg}::${source}`;
}

module.exports = {
    isIgnoredNoise,
    isBotTraffic,
    resolveEmailDomain,
    parseDeviceSummary,
    normalizeErrorMessage,
    formatIncidentCard,
    computeErrorSignature
};
