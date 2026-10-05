/**
 * Cloudflare Turnstile CAPTCHA Verification Service.
 * Provides server-side validation against Cloudflare siteverify API with open-source bypass.
 */

const CLOUDFLARE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Checks whether Turnstile is actively enabled on this server instance.
 * Returns false if TURNSTILE_SECRET_KEY is omitted or TURNSTILE_ENABLED is explicitly 'false'.
 *
 * @returns {boolean} Whether Turnstile is enabled.
 */
function isTurnstileEnabled() {
    if (process.env.TURNSTILE_ENABLED === 'false') {
        return false;
    }
    return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/**
 * Retrieves the configured public Turnstile site key.
 *
 * @returns {string} Public site key or empty string.
 */
function getTurnstileSiteKey() {
    return process.env.TURNSTILE_SITE_KEY || '';
}

/**
 * Normalizes remote IP address and checks against optional allowlist.
 *
 * @param {string} [remoteIp] - Request IP address.
 * @returns {boolean} Whether the IP is allowlisted to bypass CAPTCHA.
 */
function isIpAllowlisted(remoteIp) {
    const rawList = process.env.TURNSTILE_ALLOWLIST_IPS || (process.env.NODE_ENV !== 'production' ? '127.0.0.1,::1,localhost' : '');
    if (!rawList || !remoteIp) return false;

    const normalizedIp = remoteIp.replace(/^::ffff:/, '');
    const allowlistedIps = rawList.split(',').map(s => s.trim().replace(/^::ffff:/, '')).filter(Boolean);

    if (allowlistedIps.includes(normalizedIp) || allowlistedIps.includes(remoteIp)) {
        return true;
    }

    if ((normalizedIp === '127.0.0.1' || normalizedIp === '::1') && (allowlistedIps.includes('127.0.0.1') || allowlistedIps.includes('::1') || allowlistedIps.includes('localhost'))) {
        return true;
    }

    return false;
}

/**
 * Verifies a Turnstile response token against Cloudflare's siteverify API.
 * Automatically succeeds with a bypass flag if Turnstile is disabled or IP is allowlisted.
 *
 * @param {string} [token] - Turnstile response token submitted by client.
 * @param {string} [remoteIp] - Client IP address for telemetry validation.
 * @returns {Promise<{ success: boolean, reason?: string, message?: string, bypassed?: boolean }>}
 */
async function verifyTurnstileToken(token, remoteIp = '') {
    if (!isTurnstileEnabled()) {
        return { success: true, bypassed: true };
    }

    if (remoteIp && isIpAllowlisted(remoteIp)) {
        return { success: true, bypassed: true };
    }

    if (!token || typeof token !== 'string' || !token.trim()) {
        return {
            success: false,
            reason: 'captchaRequired',
            message: 'Security check required. Please complete the CAPTCHA.'
        };
    }

    const secret = process.env.TURNSTILE_SECRET_KEY;
    try {
        const formData = new URLSearchParams();
        formData.append('secret', secret);
        formData.append('response', token.trim());
        if (remoteIp) {
            formData.append('remoteip', remoteIp);
        }

        const response = await fetch(CLOUDFLARE_SITEVERIFY_URL, {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (!response.ok) {
            console.error('[Turnstile] Cloudflare siteverify HTTP error:', response.status);
            return {
                success: false,
                reason: 'captchaFailed',
                message: 'Security verification service unavailable. Please try again.'
            };
        }

        const data = /** @type {any} */ (await response.json());
        if (data && data.success) {
            return { success: true };
        }

        console.warn('[Turnstile] Verification failed:', data?.['error-codes'] || data);
        return {
            success: false,
            reason: 'captchaFailed',
            message: 'Security check failed. Please try again.'
        };
    } catch (err) {
        console.error('[Turnstile] Verification network error:', err);
        return {
            success: false,
            reason: 'captchaFailed',
            message: 'Security verification failed due to network error.'
        };
    }
}

module.exports = {
    isTurnstileEnabled,
    getTurnstileSiteKey,
    isIpAllowlisted,
    verifyTurnstileToken
};
