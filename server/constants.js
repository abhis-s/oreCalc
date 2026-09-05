const { deepFreeze } = require('./utils/objectUtils.js');

const COC_TAG_REGEX = /^[0289CGJLOPQRUVY]{3,14}$/i;
const USER_ID_REGEX = /^[a-zA-Z0-9_-]{10,64}$/;
const BILLING_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const ALLOWED_ORIGINS = deepFreeze([
    'https://orecalc.tech',
    'https://www.orecalc.tech',
    'https://beta.orecalc.tech',
    'https://clashcalc.com',
    'https://www.clashcalc.com',
    'https://beta.clashcalc.com',
    'https://orecalc-beta.pages.dev',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:8081',
    'http://127.0.0.1:8081'
]);

/**
 * Resolves the client IP address, prioritizing Cloudflare CF-Connecting-IP header
 * to prevent proxy-induced rate-limit sharing across users behind Cloudflare / GCP Load Balancer.
 *
 * @param {import('express').Request | Record<string, any>} [req] - Express request object.
 * @returns {string} Client IP address.
 */
function getClientIp(req) {
    const cfIp = req?.headers?.['cf-connecting-ip'];
    if (typeof cfIp === 'string' && cfIp.trim()) {
        return cfIp.trim();
    }
    return req?.ip || '127.0.0.1';
}

const RATE_LIMIT_DEFAULTS = deepFreeze({
    general: {
        windowMs: 15 * 60 * 1000,
        max: 500,
        keyGenerator: getClientIp,
        message: 'Too many requests from this IP, please try again after 15 minutes.'
    },
    sensitive: {
        windowMs: 60 * 60 * 1000,
        max: 5,
        keyGenerator: getClientIp,
        message: 'Too many destructive operations from this IP, please try again after an hour.'
    },
    proxy: {
        windowMs: 15 * 60 * 1000,
        max: 250,
        keyGenerator: getClientIp,
        message: 'Too many player fetch requests from this IP, please try again after 15 minutes.'
    }
});

const SERVER_CONSTANTS = deepFreeze({
    PORT_DEFAULT: 3000,
    INACTIVE_USER_DAYS_THRESHOLD: 90,
    PRUNE_BATCH_LIMIT: 25,
    MAX_HISTORICAL_BILLING_MONTHS: 6,
    NEGLIGIBLE_COST_THRESHOLD: 0.01
});

module.exports = {
    COC_TAG_REGEX,
    USER_ID_REGEX,
    BILLING_MONTH_REGEX,
    ALLOWED_ORIGINS,
    RATE_LIMIT_DEFAULTS,
    SERVER_CONSTANTS,
    getClientIp
};
