const express = require('express');
const { db } = require('../services/firebase.js');
const {
    verifyBmcSignature,
    extractBmcEventMetadata,
    mintSupporterCode
} = require('../services/supporterCodeService.js');
const { sendSupporterCodeEmail } = require('../services/supporterMailService.js');
const { safeJsonParse } = require('../utils/jsonUtils.js');

const router = express.Router();

router.post('/bmc', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
    const webhookSecret = process.env.BMC_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('[Webhook:BMC] [ERROR] BMC_WEBHOOK_SECRET is not configured.');
        return res.status(503).json({ reason: 'webhookNotConfigured', message: 'Webhook receiver is not configured.' });
    }

    const signatureHeader = typeof req.headers['x-signature-sha256'] === 'string'
        ? req.headers['x-signature-sha256']
        : '';

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ''), 'utf8');
    if (!verifyBmcSignature(rawBody, signatureHeader, webhookSecret)) {
        return res.status(401).json({ reason: 'invalidSignature', message: 'Invalid webhook signature.' });
    }

    const payload = safeJsonParse(rawBody.toString('utf8'), null);
    if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ reason: 'invalidPayload', message: 'Malformed JSON payload.' });
    }

    const meta = extractBmcEventMetadata(payload);
    if (!meta.isGrantEvent) {
        return res.status(200).json({ received: true, ignored: true, eventType: meta.eventType });
    }

    if (!meta.eventId) {
        return res.status(400).json({ reason: 'missingEventId', message: 'Missing transaction or event identifier.' });
    }

    try {
        const mintResult = await mintSupporterCode({
            db,
            source: 'bmc',
            bmcEventId: meta.eventId,
            supporterEmail: meta.supporterEmail,
            supporterName: meta.supporterName,
            note: `BMC ${meta.eventType}`
        });

        if (mintResult.alreadyProcessed || !mintResult.code) {
            return res.status(200).json({ received: true, duplicate: true });
        }

        let emailSent = false;
        if (meta.supporterEmail) {
            const mailResult = await sendSupporterCodeEmail({
                toEmail: meta.supporterEmail,
                supporterName: meta.supporterName,
                code: mintResult.code
            });
            emailSent = Boolean(mailResult.sent);

            if (emailSent) {
                try {
                    await db.collection('bmcWebhookEvents').doc(meta.eventId).update({
                        emailSent: true,
                        emailedAt: Date.now()
                    });
                } catch (updateErr) {
                    console.warn('[Webhook:BMC] [WARN] Failed to record emailSent flag:', updateErr);
                }
            }
        }

        console.log(`[Webhook:BMC] [OK] Minted supporter code for event ${meta.eventId} (emailSent=${emailSent}).`);
        return res.status(200).json({ received: true, minted: true, emailSent });
    } catch (err) {
        console.error('[Webhook:BMC] [ERROR] Failed to process BMC webhook event:', err);
        return res.status(500).json({ reason: 'internalError', message: 'Failed to process webhook event.' });
    }
});

module.exports = router;
