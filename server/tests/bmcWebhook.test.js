const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
    verifyBmcSignature,
    extractBmcEventMetadata,
    generateSupporterCode,
    hashSupporterCode,
    getDevSupporterCodes,
    mintSupporterCode,
    redeemSupporterCodeAtomic
} = require('../services/supporterCodeService.js');
const {
    buildSupporterCodeEmail,
    buildSupporterRedeemedAdminEmail,
    sendSupporterCodeEmail,
    sendSupporterRedeemedAdminEmail
} = require('../services/supporterMailService.js');

/**
 * Creates a minimal in-memory Firestore mock supporting collections, docs, and runTransaction.
 *
 * @param {Record<string, Record<string, any>>} [initialData={}]
 */
function createInMemoryFirestore(initialData = {}) {
    /** @type {Map<string, Map<string, any>>} */
    const collections = new Map();
    for (const [colName, docs] of Object.entries(initialData)) {
        const docMap = new Map();
        for (const [docId, val] of Object.entries(docs)) {
            docMap.set(docId, { ...val });
        }
        collections.set(colName, docMap);
    }

    const getCol = (name) => {
        if (!collections.has(name)) collections.set(name, new Map());
        return collections.get(name);
    };

    const makeDocRef = (colName, docId) => ({
        _col: colName,
        _id: docId,
        async get() {
            const col = getCol(colName);
            const exists = col.has(docId);
            return {
                exists,
                data: () => (exists ? { ...col.get(docId) } : undefined)
            };
        },
        async set(data) {
            getCol(colName).set(docId, { ...data });
        },
        async update(patch) {
            const col = getCol(colName);
            const existing = col.get(docId) || {};
            col.set(docId, { ...existing, ...patch });
        }
    });

    return {
        collections,
        collection(colName) {
            return {
                doc(docId) {
                    return makeDocRef(colName, docId);
                }
            };
        },
        async runTransaction(fn) {
            const tx = {
                async get(ref) {
                    return ref.get();
                },
                set(ref, data) {
                    getCol(ref._col).set(ref._id, { ...data });
                },
                update(ref, patch) {
                    const col = getCol(ref._col);
                    const existing = col.get(ref._id) || {};
                    col.set(ref._id, { ...existing, ...patch });
                }
            };
            return fn(tx);
        }
    };
}

test('webhookRoutes - verifyBmcSignature validates HMAC-SHA256 strictly in constant time', () => {
    const secret = 'test_bmc_webhook_secret_12345';
    const payload = Buffer.from(JSON.stringify({ type: 'donation.created', data: { id: 42 } }), 'utf8');
    const validSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    assert.equal(verifyBmcSignature(payload, validSig, secret), true);
    assert.equal(verifyBmcSignature(payload, validSig.toUpperCase(), secret), true);

    // Tampered payload or wrong secret or malformed signature must fail
    const tampered = Buffer.from(JSON.stringify({ type: 'donation.created', data: { id: 99 } }), 'utf8');
    assert.equal(verifyBmcSignature(tampered, validSig, secret), false);
    assert.equal(verifyBmcSignature(payload, validSig, 'wrong_secret'), false);
    assert.equal(verifyBmcSignature(payload, 'not-a-hex-sig', secret), false);
    assert.equal(verifyBmcSignature(payload, '', secret), false);
    assert.equal(verifyBmcSignature(payload, validSig, ''), false);
});

test('webhookRoutes - extractBmcEventMetadata classifies grant vs non-grant events', () => {
    const donation = extractBmcEventMetadata({
        type: 'donation.created',
        data: {
            id: 98765,
            supporter_email: 'fan@example.com',
            supporter_name: 'RedFex'
        }
    });
    assert.equal(donation.isGrantEvent, true);
    assert.equal(donation.eventId, 'donation.created:98765');
    assert.equal(donation.supporterEmail, 'fan@example.com');
    assert.equal(donation.supporterName, 'RedFex');

    const membership = extractBmcEventMetadata({
        type: 'membership.started',
        data: { transaction_id: 'txn_abc', payer_email: 'member@example.com', payer_name: 'Chief' }
    });
    assert.equal(membership.isGrantEvent, true);
    assert.equal(membership.eventId, 'membership.started:txn_abc');

    const cancelled = extractBmcEventMetadata({
        type: 'membership.cancelled',
        data: { id: 111 }
    });
    assert.equal(cancelled.isGrantEvent, false);
});

test('supporterCodeService - minting, SHA-256 storage, idempotency, and single-use atomic redemption', async () => {
    const db = createInMemoryFirestore({
        accounts: {
            alice: { username: 'Alice', isSupporter: false },
            bob: { username: 'Bob', isSupporter: false }
        }
    });

    const sampleCode = generateSupporterCode();
    assert.match(sampleCode, /^CC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    // Mint code tied to a BMC event
    const mint1 = await mintSupporterCode({
        db,
        source: 'bmc',
        bmcEventId: 'donation.created:501',
        supporterEmail: 'alice@example.com',
        supporterName: 'Alice'
    });
    assert.equal(mint1.alreadyProcessed, false);
    assert.ok(mint1.code);
    assert.equal(mint1.codeHash, hashSupporterCode(mint1.code));

    // Only SHA-256 hash is stored, never plaintext
    const storedCodeDoc = db.collections.get('supporterCodes').get(mint1.codeHash);
    assert.equal(storedCodeDoc.status, 'active');
    assert.equal(JSON.stringify(storedCodeDoc).includes(mint1.code), false);

    // Duplicate webhook event must be deduplicated without minting a second code
    const mintDup = await mintSupporterCode({
        db,
        source: 'bmc',
        bmcEventId: 'donation.created:501',
        supporterEmail: 'alice@example.com'
    });
    assert.equal(mintDup.alreadyProcessed, true);
    assert.equal(mintDup.code, null);
    assert.equal(db.collections.get('supporterCodes').size, 1);

    // Alice redeems code successfully (case-insensitive, trimmed)
    const redeemAlice = await redeemSupporterCodeAtomic({
        db,
        account: { username: 'Alice', isSupporter: false },
        rawCode: `  ${mint1.code.toLowerCase()}  `,
        env: { NODE_ENV: 'production' }
    });
    assert.equal(redeemAlice.success, true);
    assert.equal(db.collections.get('accounts').get('alice').isSupporter, true);
    assert.equal(db.collections.get('supporterCodes').get(mint1.codeHash).status, 'redeemed');
    assert.equal(db.collections.get('supporterCodes').get(mint1.codeHash).redeemedBy, 'alice');

    // Bob attempting to reuse Alice's redeemed code is rejected
    const redeemBob = await redeemSupporterCodeAtomic({
        db,
        account: { username: 'Bob', isSupporter: false },
        rawCode: mint1.code,
        env: { NODE_ENV: 'production' }
    });
    assert.equal(redeemBob.success, false);
    assert.equal(redeemBob.reason, 'invalidSupporterCode');
    assert.equal(db.collections.get('accounts').get('bob').isSupporter, false);
});

test('supporterCodeService - SUPPORTER_DEV_CODES works in dev and is strictly ignored in production', async () => {
    const devSet = getDevSupporterCodes({ NODE_ENV: 'development', SUPPORTER_DEV_CODES: 'dev-vip-1, DEV-VIP-2' });
    assert.equal(devSet.has('DEV-VIP-1'), true);
    assert.equal(devSet.has('DEV-VIP-2'), true);

    const prodSet = getDevSupporterCodes({ NODE_ENV: 'production', SUPPORTER_DEV_CODES: 'dev-vip-1' });
    assert.equal(prodSet.size, 0);

    const db = createInMemoryFirestore({
        accounts: {
            tester: { username: 'Tester', isSupporter: false }
        }
    });

    // Rejected in production even if SUPPORTER_DEV_CODES is set
    const prodAttempt = await redeemSupporterCodeAtomic({
        db,
        account: { username: 'Tester', isSupporter: false },
        rawCode: 'DEV-VIP-1',
        env: { NODE_ENV: 'production', SUPPORTER_DEV_CODES: 'DEV-VIP-1' }
    });
    assert.equal(prodAttempt.success, false);
    assert.equal(prodAttempt.reason, 'invalidSupporterCode');

    // Accepted in development
    const devAttempt = await redeemSupporterCodeAtomic({
        db,
        account: { username: 'Tester', isSupporter: false },
        rawCode: 'dev-vip-1',
        env: { NODE_ENV: 'development', SUPPORTER_DEV_CODES: 'DEV-VIP-1' }
    });
    assert.equal(devAttempt.success, true);
    assert.equal(db.collections.get('accounts').get('tester').isSupporter, true);
});

test('supporterMailService - escapes HTML and gracefully skips when SMTP is unconfigured', async () => {
    const { subject, text, html } = buildSupporterCodeEmail({
        supporterName: '<script>alert(1)</script>',
        code: 'CC-ABCD-EFGH-2345'
    });
    assert.equal(subject, 'Your ClashCalc Supporter Code');
    assert.ok(text.includes('CC-ABCD-EFGH-2345'));
    assert.ok(html.includes('CC-ABCD-EFGH-2345'));
    assert.equal(html.includes('<script>'), false);
    assert.ok(html.includes('&lt;script&gt;'));

    // Gracefully skips when SMTP env is absent
    const skipped = await sendSupporterCodeEmail({
        toEmail: 'fan@example.com',
        supporterName: 'Fan',
        code: 'CC-ABCD-EFGH-2345',
        env: {}
    });
    assert.equal(skipped.sent, false);
    assert.equal(skipped.skipped, true);

    // Dispatches when transport is available
    let capturedMail = null;
    const dispatched = await sendSupporterCodeEmail({
        toEmail: 'fan@example.com',
        supporterName: 'RedFex',
        code: 'CC-ABCD-EFGH-2345',
        env: { EMAIL_FROM: 'noreply@clashcalc.com' },
        transporterOverride: {
            sendMail: async (opts) => {
                capturedMail = opts;
            }
        }
    });
    assert.equal(dispatched.sent, true);
    assert.equal(capturedMail.to, 'fan@example.com');
    assert.ok(capturedMail.text.includes('CC-ABCD-EFGH-2345'));
});

test('supporterMailService - sends admin notification on new supporter redemption without leaking plaintext code', async () => {
    const { subject, text } = buildSupporterRedeemedAdminEmail({
        username: 'ChiefAbhi',
        userId: 'user-uuid-1234',
        source: 'bmc',
        note: 'BMC donation.created',
        bmcEventId: 'donation.created:999',
        codeHash: 'abcdef1234567890abcdef1234567890'
    });
    assert.equal(subject, '[ClashCalc] Supporter Code Redeemed by ChiefAbhi');
    assert.ok(text.includes('ChiefAbhi'));
    assert.ok(text.includes('donation.created:999'));
    assert.ok(text.includes('abcdef123456...'));

    // Gracefully skips if no alert/support recipient configured
    const skipped = await sendSupporterRedeemedAdminEmail({
        username: 'ChiefAbhi',
        env: {}
    });
    assert.equal(skipped.sent, false);
    assert.equal(skipped.skipped, true);

    // Dispatches to RECIPIENT_EMAIL_ALERTS when configured
    let capturedAdminMail = null;
    const sent = await sendSupporterRedeemedAdminEmail({
        username: 'ChiefAbhi',
        userId: 'user-uuid-1234',
        source: 'manual',
        note: 'RedFex',
        codeHash: '1234567890abcdef1234567890abcdef',
        env: {
            EMAIL_FROM: 'noreply@clashcalc.com',
            RECIPIENT_EMAIL_ALERTS: 'alerts@clashcalc.com'
        },
        transporterOverride: {
            sendMail: async (opts) => {
                capturedAdminMail = opts;
            }
        }
    });
    assert.equal(sent.sent, true);
    assert.equal(capturedAdminMail.to, 'alerts@clashcalc.com');
    assert.ok(capturedAdminMail.text.includes('RedFex'));
});
