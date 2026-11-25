const crypto = require('crypto');

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const CODE_SEGMENT_COUNT = 3;
const CODE_SEGMENT_LENGTH = 4;

const SUPPORTED_BMC_GRANT_EVENTS = Object.freeze(new Set([
    'donation.created',
    'recurring_donation.started',
    'membership.started',
    'subscription.created'
]));

/**
 * Verifies a Buy Me a Coffee webhook HMAC-SHA256 signature using constant-time comparison.
 *
 * @param {Buffer | string} rawBody - Exact raw request payload bytes.
 * @param {string | undefined} signatureHeader - Value of the x-signature-sha256 header.
 * @param {string | undefined} secret - Configured BMC_WEBHOOK_SECRET.
 * @returns {boolean}
 */
function verifyBmcSignature(rawBody, signatureHeader, secret) {
    if (!secret || typeof secret !== 'string') return false;
    if (!signatureHeader || typeof signatureHeader !== 'string') return false;
    if (!rawBody || (typeof rawBody !== 'string' && !Buffer.isBuffer(rawBody))) return false;

    const receivedHex = signatureHeader.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(receivedHex)) return false;

    const expectedHex = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

    const expectedBuf = Buffer.from(expectedHex, 'hex');
    const receivedBuf = Buffer.from(receivedHex, 'hex');
    if (expectedBuf.length !== receivedBuf.length) return false;

    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

/**
 * Extracts normalized event metadata from a Buy Me a Coffee webhook payload.
 *
 * @param {Record<string, any> | null} payload
 * @returns {{
 *     eventType: string,
 *     eventId: string,
 *     supporterEmail: string,
 *     supporterName: string,
 *     isGrantEvent: boolean
 * }}
 */
function extractBmcEventMetadata(payload) {
    const eventType = String(payload?.type || payload?.event || '').trim().toLowerCase();
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};

    const rawId = data.transaction_id || data.support_id || data.id || payload?.event_id || payload?.id || '';
    const eventId = rawId ? `${eventType}:${String(rawId).trim()}` : '';
    const supporterEmail = String(data.supporter_email || data.payer_email || data.email || '').trim();
    const supporterName = String(data.supporter_name || data.payer_name || data.name || '').trim();

    return {
        eventType,
        eventId,
        supporterEmail,
        supporterName,
        isGrantEvent: SUPPORTED_BMC_GRANT_EVENTS.has(eventType)
    };
}

/**
 * Normalizes a supporter code for consistent hashing and comparison.
 *
 * @param {string} rawCode
 * @returns {string}
 */
function normalizeSupporterCode(rawCode) {
    if (typeof rawCode !== 'string') return '';
    return rawCode.trim().toUpperCase();
}

/**
 * Computes the SHA-256 hex digest of a normalized supporter code.
 *
 * @param {string} rawCode
 * @returns {string}
 */
function hashSupporterCode(rawCode) {
    const clean = normalizeSupporterCode(rawCode);
    if (!clean) return '';
    return crypto.createHash('sha256').update(clean, 'utf8').digest('hex');
}

/**
 * Generates a high-entropy, human-readable single-use supporter code (CC-XXXX-XXXX-XXXX).
 *
 * @returns {string}
 */
function generateSupporterCode() {
    const totalChars = CODE_SEGMENT_COUNT * CODE_SEGMENT_LENGTH;
    const alphabetLen = CODE_ALPHABET.length;
    const maxByte = 256 - (256 % alphabetLen);
    const chars = [];

    while (chars.length < totalChars) {
        const bytes = crypto.randomBytes(totalChars - chars.length + 8);
        for (let i = 0; i < bytes.length && chars.length < totalChars; i++) {
            if (bytes[i] < maxByte) {
                chars.push(CODE_ALPHABET[bytes[i] % alphabetLen]);
            }
        }
    }

    const segments = [];
    for (let s = 0; s < CODE_SEGMENT_COUNT; s++) {
        segments.push(chars.slice(s * CODE_SEGMENT_LENGTH, (s + 1) * CODE_SEGMENT_LENGTH).join(''));
    }
    return `CC-${segments.join('-')}`;
}

/**
 * Resolves configured dev-only supporter codes from SUPPORTER_DEV_CODES.
 * Strictly returns an empty set when NODE_ENV === 'production'.
 *
 * @param {Record<string, string | undefined>} [env=process.env]
 * @returns {Set<string>}
 */
function getDevSupporterCodes(env = process.env) {
    if (env.NODE_ENV === 'production') {
        return new Set();
    }
    const raw = env.SUPPORTER_DEV_CODES;
    if (typeof raw !== 'string' || !raw.trim()) {
        return new Set();
    }
    return new Set(
        raw
            .split(',')
            .map((entry) => normalizeSupporterCode(entry))
            .filter(Boolean)
    );
}

/**
 * Mints a single-use supporter code and stores its SHA-256 hash in Firestore.
 * Deduplicates by bmcEventId when provided so webhook retries never mint duplicate codes.
 *
 * @param {{
 *     db: any,
 *     source?: 'bmc' | 'manual',
 *     bmcEventId?: string | null,
 *     supporterEmail?: string | null,
 *     supporterName?: string | null,
 *     note?: string | null
 * }} params
 * @returns {Promise<{ code: string | null, codeHash: string | null, alreadyProcessed: boolean }>}
 */
async function mintSupporterCode({
    db,
    source = 'manual',
    bmcEventId = null,
    supporterEmail = null,
    supporterName = null,
    note = null
}) {
    const cleanEventId = typeof bmcEventId === 'string' ? bmcEventId.trim() : '';
    const code = generateSupporterCode();
    const codeHash = hashSupporterCode(code);
    const now = Date.now();

    const codeRef = db.collection('supporterCodes').doc(codeHash);
    const codeDoc = {
        status: 'active',
        source,
        bmcEventId: cleanEventId || null,
        note: typeof note === 'string' ? note.trim().slice(0, 200) : '',
        createdAt: now,
        redeemedBy: null,
        redeemedAt: null
    };

    if (cleanEventId) {
        const eventRef = db.collection('bmcWebhookEvents').doc(cleanEventId);
        const result = await db.runTransaction(async (tx) => {
            const existingEvent = await tx.get(eventRef);
            if (existingEvent.exists) {
                return { code: null, codeHash: existingEvent.data()?.codeHash || null, alreadyProcessed: true };
            }
            tx.set(codeRef, codeDoc);
            tx.set(eventRef, {
                bmcEventId: cleanEventId,
                source,
                codeHash,
                supporterEmail: typeof supporterEmail === 'string' ? supporterEmail.trim().slice(0, 200) : '',
                supporterName: typeof supporterName === 'string' ? supporterName.trim().slice(0, 120) : '',
                emailSent: false,
                createdAt: now
            });
            return { code, codeHash, alreadyProcessed: false };
        });
        return result;
    }

    await codeRef.set(codeDoc);
    return { code, codeHash, alreadyProcessed: false };
}

/**
 * Atomically validates and redeems a supporter code for an authenticated user.
 * Supports SUPPORTER_DEV_CODES strictly outside production, and single-use Firestore codes everywhere.
 *
 * @param {{
 *     db: any,
 *     account: { username?: string, isSupporter?: boolean, [key: string]: any },
 *     rawCode: string,
 *     env?: Record<string, string | undefined>
 * }} params
 * @returns {Promise<{
 *     success: boolean,
 *     newlyActivated?: boolean,
 *     source?: string,
 *     note?: string,
 *     bmcEventId?: string | null,
 *     codeHash?: string,
 *     reason?: string,
 *     message?: string
 * }>}
 */
async function redeemSupporterCodeAtomic({ db, account, rawCode, env = process.env }) {
    if (!account || !account.username) {
        return { success: false, reason: 'unauthorized', message: 'User must be authenticated.' };
    }

    const cleanCode = normalizeSupporterCode(rawCode);
    if (!cleanCode) {
        return { success: false, reason: 'invalidSupporterCode', message: 'Invalid supporter redemption code.' };
    }

    const cleanUsername = account.username.toLowerCase();
    const accountRef = db.collection('accounts').doc(cleanUsername);
    const codeHash = hashSupporterCode(cleanCode);

    // Development-only reusable test codes (strictly disabled in production)
    const devCodes = getDevSupporterCodes(env);
    if (devCodes.has(cleanCode)) {
        if (account.isSupporter) {
            return { success: true, newlyActivated: false, message: 'Account is already a verified supporter.' };
        }
        try {
            await accountRef.update({
                isSupporter: true,
                supporterSince: Date.now()
            });
            return {
                success: true,
                newlyActivated: true,
                source: 'dev',
                note: 'SUPPORTER_DEV_CODES',
                bmcEventId: null,
                codeHash,
                message: 'Supporter status successfully activated.'
            };
        } catch (err) {
            console.error('[SupporterCode] Dev code redemption error:', err);
            return { success: false, reason: 'internalError', message: 'Failed to redeem supporter code.' };
        }
    }

    const codeRef = db.collection('supporterCodes').doc(codeHash);

    try {
        return await db.runTransaction(async (tx) => {
            const codeSnap = await tx.get(codeRef);
            if (!codeSnap.exists) {
                return { success: false, reason: 'invalidSupporterCode', message: 'Invalid supporter redemption code.' };
            }

            const codeData = codeSnap.data() || {};
            if (codeData.status !== 'active') {
                return { success: false, reason: 'invalidSupporterCode', message: 'Invalid supporter redemption code.' };
            }

            const accountSnap = await tx.get(accountRef);
            if (!accountSnap.exists) {
                return { success: false, reason: 'accountNotFound', message: 'Account not found.' };
            }

            const currentAccount = accountSnap.data() || {};
            if (currentAccount.isSupporter) {
                // Do not burn a valid unused code if the account is already a verified supporter
                return { success: true, newlyActivated: false, message: 'Account is already a verified supporter.' };
            }

            const now = Date.now();
            tx.update(codeRef, {
                status: 'redeemed',
                redeemedBy: cleanUsername,
                redeemedAt: now
            });
            tx.update(accountRef, {
                isSupporter: true,
                supporterSince: now,
                supporterCodeHash: codeHash
            });

            return {
                success: true,
                newlyActivated: true,
                source: codeData.source || 'manual',
                note: codeData.note || '',
                bmcEventId: codeData.bmcEventId || null,
                codeHash,
                message: 'Supporter status successfully activated.'
            };
        });
    } catch (err) {
        console.error('[SupporterCode] Transaction redemption error:', err);
        return { success: false, reason: 'internalError', message: 'Failed to redeem supporter code.' };
    }
}

module.exports = {
    verifyBmcSignature,
    extractBmcEventMetadata,
    normalizeSupporterCode,
    hashSupporterCode,
    generateSupporterCode,
    getDevSupporterCodes,
    mintSupporterCode,
    redeemSupporterCodeAtomic
};
