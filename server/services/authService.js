const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} = require('@simplewebauthn/server');
const { isoBase64URL } = require('@simplewebauthn/server/helpers');
const { AUTH_CONSTANTS } = require('../constants.js');

/**
 * Normalizes and validates a username.
 * Returns lowercase trimmed username or null if invalid format.
 *
 * @param {string} username - Candidate username string.
 * @returns {string|null} Normalized username or null.
 */
function normalizeUsername(username) {
    if (typeof username !== 'string') return null;
    const clean = username.trim().toLowerCase();
    if (!AUTH_CONSTANTS.USERNAME_REGEX.test(clean)) {
        return null;
    }
    return clean;
}

/**
 * Hashes a plaintext password using bcrypt.
 *
 * @param {string} plaintext - Plaintext password.
 * @returns {Promise<string>} Salted bcrypt hash.
 */
async function hashPassword(plaintext) {
    if (typeof plaintext !== 'string' || plaintext.length < AUTH_CONSTANTS.MIN_PASSWORD_LENGTH || plaintext.length > AUTH_CONSTANTS.MAX_PASSWORD_LENGTH) {
        throw new Error(`Password must be between ${AUTH_CONSTANTS.MIN_PASSWORD_LENGTH} and ${AUTH_CONSTANTS.MAX_PASSWORD_LENGTH} characters long.`);
    }
    return bcrypt.hash(plaintext, AUTH_CONSTANTS.SALT_ROUNDS);
}

/**
 * Compares plaintext password against a bcrypt hash.
 *
 * @param {string} plaintext - Candidate password.
 * @param {string} hash - Stored bcrypt hash.
 * @returns {Promise<boolean>} Whether password matches.
 */
async function verifyPassword(plaintext, hash) {
    if (typeof plaintext !== 'string' || typeof hash !== 'string' || !hash || plaintext.length > AUTH_CONSTANTS.MAX_PASSWORD_LENGTH) {
        return false;
    }
    return bcrypt.compare(plaintext, hash);
}

const CANONICAL_ALLOWED_ORIGINS = Object.freeze([
    'https://clashcalc.com',
    'https://www.clashcalc.com',
    'https://beta.clashcalc.com',
    'https://orecalc.tech',
    'https://www.orecalc.tech',
    'https://beta.orecalc.tech',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:3000'
]);

/**
 * Resolves WebAuthn Relying Party configuration from environment or request origin.
 *
 * @param {import('express').Request|string|null} [reqOrOrigin] - Express request or origin string.
 * @returns {{ rpName: string, rpID: string, origin: string, allowedOrigins: string[] }}
 */
function getWebAuthnConfig(reqOrOrigin = null) {
    let candidateOrigin = '';
    if (typeof reqOrOrigin === 'string') {
        candidateOrigin = reqOrOrigin.trim().replace(/\/+$/, '');
    } else if (reqOrOrigin && typeof reqOrOrigin === 'object') {
        const hOrigin = /** @type {any} */ (reqOrOrigin).headers?.origin || /** @type {any} */ (reqOrOrigin).get?.('origin');
        if (typeof hOrigin === 'string') {
            candidateOrigin = hOrigin.trim().replace(/\/+$/, '');
        }
    }

    let resolvedRpId = process.env.RP_ID || '';
    let resolvedOrigin = process.env.RP_ORIGIN || '';

    if (candidateOrigin) {
        try {
            const url = new URL(candidateOrigin);
            const host = url.hostname.toLowerCase();
            if (host === 'localhost' || host === '127.0.0.1') {
                resolvedRpId = 'localhost';
                resolvedOrigin = candidateOrigin;
            } else if (host === 'clashcalc.com' || host.endsWith('.clashcalc.com')) {
                resolvedRpId = 'clashcalc.com';
                resolvedOrigin = candidateOrigin;
            } else if (host === 'orecalc.tech' || host.endsWith('.orecalc.tech')) {
                resolvedRpId = 'orecalc.tech';
                resolvedOrigin = candidateOrigin;
            }
        } catch (_) {}
    }

    if (!resolvedRpId) resolvedRpId = 'clashcalc.com';
    if (!resolvedOrigin) resolvedOrigin = 'https://clashcalc.com';

    return {
        rpName: process.env.RP_NAME || 'ClashCalc',
        rpID: resolvedRpId,
        origin: resolvedOrigin,
        allowedOrigins: [...CANONICAL_ALLOWED_ORIGINS]
    };
}

/**
 * Signs a session JWT token for an authenticated user account.
 *
 * @param {{ username: string, userId: string }} account - Account identity.
 * @returns {string} Signed JWT.
 */
function generateToken(account) {
    const secret = process.env.JWT_SECRET || 'dev_insecure_jwt_secret_change_me_min_32_chars';
    return jwt.sign(
        {
            sub: account.username,
            userId: account.userId
        },
        secret,
        /** @type {any} */ ({
            expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY
        })
    );
}

/**
 * Verifies and decodes an authentication token.
 *
 * @param {string} token - Bearer JWT token.
 * @returns {{ sub: string, userId: string, iat: number, exp: number }} Decoded payload.
 */
function verifyToken(token) {
    const secret = process.env.JWT_SECRET || 'dev_insecure_jwt_secret_change_me_min_32_chars';
    return /** @type {any} */ (jwt.verify(token, secret));
}

/**
 * Generates WebAuthn registration options for creating or adding a passkey.
 *
 * @param {string} username - Display username.
 * @param {string} userId - User identifier.
 * @param {Array<any>} [existingPasskeys] - Currently registered passkeys.
 * @param {import('express').Request|string|null} [reqOrOrigin] - Optional request context for dynamic RP resolution.
 * @returns {Promise<any>} Registration options.
 */
async function generatePasskeyRegisterOptions(username, userId, existingPasskeys = [], reqOrOrigin = null) {
    const { rpName, rpID } = getWebAuthnConfig(reqOrOrigin);
    const excludeCredentials = existingPasskeys.map(pk => ({
        id: pk.credentialID,
        transports: pk.transports || ['internal', 'hybrid']
    }));

    return generateRegistrationOptions({
        rpName,
        rpID,
        userName: username,
        userID: new TextEncoder().encode(userId),
        attestationType: 'none',
        excludeCredentials,
        authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred'
        }
    });
}

/**
 * Verifies a WebAuthn registration attestation response.
 *
 * @param {any} response - Client registration response.
 * @param {string} expectedChallenge - Expected challenge string.
 * @param {import('express').Request|string|null} [reqOrOrigin] - Optional request context for dynamic RP resolution.
 * @returns {Promise<any>} Verified registration info.
 */
async function verifyPasskeyRegister(response, expectedChallenge, reqOrOrigin = null) {
    const { rpID, origin, allowedOrigins } = getWebAuthnConfig(reqOrOrigin);
    const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: allowedOrigins.includes(origin) ? allowedOrigins : origin,
        expectedRPID: rpID,
        requireUserVerification: false
    });

    if (!verification.verified || !verification.registrationInfo) {
        throw new Error('Registration verification failed');
    }

    const { credential } = verification.registrationInfo;
    return {
        credentialID: credential.id,
        publicKey: isoBase64URL.fromBuffer(credential.publicKey),
        counter: credential.counter,
        transports: response.response.transports || credential.transports || ['internal', 'hybrid']
    };
}

/**
 * Generates WebAuthn authentication options for passkey sign-in.
 *
 * @param {Array<any>} [allowedPasskeys] - Allowed credentials for user.
 * @param {import('express').Request|string|null} [reqOrOrigin] - Optional request context for dynamic RP resolution.
 * @returns {Promise<any>} Authentication options.
 */
async function generatePasskeyLoginOptions(allowedPasskeys = null, reqOrOrigin = null) {
    const { rpID } = getWebAuthnConfig(reqOrOrigin);
    const allowCredentials = allowedPasskeys && Array.isArray(allowedPasskeys)
        ? allowedPasskeys.map(pk => ({
            id: pk.credentialID,
            transports: pk.transports || ['internal', 'hybrid']
        }))
        : undefined;

    return generateAuthenticationOptions({
        rpID,
        allowCredentials,
        userVerification: 'preferred'
    });
}

/**
 * Verifies a WebAuthn authentication assertion response.
 *
 * @param {any} response - Client authentication response.
 * @param {string} expectedChallenge - Challenge that was issued.
 * @param {any} storedPasskey - Existing stored passkey document.
 * @param {import('express').Request|string|null} [reqOrOrigin] - Optional request context for dynamic RP resolution.
 * @returns {Promise<number>} New counter value.
 */
async function verifyPasskeyLogin(response, expectedChallenge, storedPasskey, reqOrOrigin = null) {
    const { rpID, origin, allowedOrigins } = getWebAuthnConfig(reqOrOrigin);
    const publicKeyBuffer = isoBase64URL.toBuffer(storedPasskey.publicKey);

    const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: allowedOrigins.includes(origin) ? allowedOrigins : origin,
        expectedRPID: rpID,
        credential: {
            id: storedPasskey.credentialID,
            publicKey: publicKeyBuffer,
            counter: storedPasskey.counter,
            transports: storedPasskey.transports
        },
        requireUserVerification: false
    });

    if (!verification.verified || !verification.authenticationInfo) {
        throw new Error('Authentication verification failed');
    }

    return verification.authenticationInfo.newCounter;
}

module.exports = {
    normalizeUsername,
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    getWebAuthnConfig,
    generatePasskeyRegisterOptions,
    verifyPasskeyRegister,
    generatePasskeyLoginOptions,
    verifyPasskeyLogin
};
