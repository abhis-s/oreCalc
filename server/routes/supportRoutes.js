const express = require('express');
const rateLimit = require('express-rate-limit');
const { RATE_LIMIT_DEFAULTS } = require('../constants.js');
const { admin, db } = require('../services/firebase.js');

const router = express.Router();
// @ts-ignore
const sensitiveLimiter = rateLimit(RATE_LIMIT_DEFAULTS.sensitive);

router.post('/support/bug-report', sensitiveLimiter, async (req, res) => {
    const { email, description, attachData, userId } = req.body;

    if (!description || typeof description !== 'string' || description.trim().length < 20 || description.length > 5000) {
        return res.status(400).json({ reason: 'invalidDescription', message: 'Description must be between 20 and 5000 characters.' });
    }

    if (email && (typeof email !== 'string' || email.length > 100)) {
        return res.status(400).json({ reason: 'invalidEmail', message: 'Email must be 100 characters or fewer.' });
    }

    if (userId && (typeof userId !== 'string' || userId.length > 64)) {
        return res.status(400).json({ reason: 'invalidUserId', message: 'User ID must be 64 characters or fewer.' });
    }

    if (attachData) {
        const attachSize = Buffer.byteLength(JSON.stringify(attachData), 'utf8');
        if (attachSize > 1040000) {
            return res.status(413).json({ reason: 'payloadTooLarge', message: 'Attached data exceeds the maximum 1MB storage limit.' });
        }
    }

    try {
        const reportData = {
            description: description.trim().substring(0, 5000),
            email: email ? email.trim().substring(0, 100) : '',
            userId: userId ? userId.trim().substring(0, 64) : 'unknown',
            reportedAt: new Date().toISOString(),
            status: 'new'
        };

        if (attachData) {
            reportData.attachedState = attachData;
        }

        const docRef = await db.collection('bugReports').add(reportData);
        console.log(`[BUG REPORT] Saved report ${docRef.id} for UserID: ${reportData.userId}`);

        let emailSent = false;
        if (process.env.SMTP_USER && process.env.SMTP_HOST) {
            try {
                const nodemailer = require('nodemailer');
                const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: Number(process.env.SMTP_PORT) || 587,
                    secure: process.env.SMTP_SECURE === 'true',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                });

                const attachments = [];
                if (attachData) {
                    attachments.push({
                        filename: `user-data-${reportData.userId}.json`,
                        content: JSON.stringify(attachData, null, 2),
                        contentType: 'application/json'
                    });
                }

                const domain = resolveEmailDomain(reportData.environment, req.headers.host, req.headers.referer);
                const shortUserId = reportData.userId ? reportData.userId.substring(0, 8) : 'anon';
                const briefTitle = description.replace(/[\r\n]+/g, ' ').trim().substring(0, 50);

                const mailOptions = {
                    from: `"ClashCalc System" <${process.env.EMAIL_FROM || 'noreply@clashcalc.com'}>`,
                    to: process.env.RECIPIENT_EMAIL_SUPPORT || 'support@clashcalc.com',
                    subject: `[${domain}] Bug Report: "${briefTitle}" (User ${shortUserId})`,
                    text: [
                        '================================================================================',
                        'USER BUG REPORT SUBMISSION',
                        '================================================================================',
                        '',
                        'REPORT DETAILS',
                        '--------------------------------------------------------------------------------',
                        `Environment   : ${domain}`,
                        `Report ID     : ${docRef.id}`,
                        `User ID       : ${reportData.userId}`,
                        `Contact Email : ${reportData.email || 'none'}`,
                        `Submitted At  : ${reportData.reportedAt}`,
                        '',
                        'DESCRIPTION',
                        '--------------------------------------------------------------------------------',
                        description,
                        '',
                        attachData ? 'User data is attached to this email.' : 'No user data was attached.',
                        '',
                        '================================================================================',
                        'Notification managed by ClashCalc Support System'
                    ].join('\n'),
                    attachments
                };

                if (reportData.email) {
                    mailOptions.replyTo = reportData.email;
                }

                await transporter.sendMail(mailOptions);
                emailSent = true;
                console.log(`[BUG REPORT] Support email notification sent successfully.`);
            } catch (mailError) {
                console.error(`[BUG REPORT] Failed to send support email:`, mailError);
            }
        }

        res.status(200).json({
            message: 'Bug report submitted successfully.',
            reportId: docRef.id,
            emailSent
        });
    } catch (error) {
        console.error('Error handling bug report submission:', error);
        res.status(500).json({ reason: 'internalError', message: 'Internal Server Error', error: error.message });
    }
});

const {
    isIgnoredNoise,
    resolveEmailDomain,
    queueClientErrorAlert
} = require('../services/alertThrottle.js');

router.post('/support/client-error', sensitiveLimiter, async (req, res) => {
    const { userId, environment, message, source, line, col, stack, url, userAgent } = req.body;

    if (!message || typeof message !== 'string') {
        return res.status(400).json({ reason: 'invalidMessage', message: 'Error message is required.' });
    }

    // Completely discard client noise (extension scripts, 404 tag typos, CWL/war log states, wallet/browser injections)
    if (isIgnoredNoise(message, source, line, stack)) {
        return res.status(200).json({
            message: 'Ignored client noise error.',
            ignored: true,
            emailSent: false
        });
    }

    try {
        const now = new Date();
        const expireDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

        const parsedLine = Number.isInteger(Number(line)) ? Number(line) : 0;
        const parsedCol = Number.isInteger(Number(col)) ? Number(col) : 0;

        const errorData = {
            userId: typeof userId === 'string' ? userId.substring(0, 64) : 'unknown',
            environment: typeof environment === 'string' ? environment.substring(0, 50) : 'unknown',
            message: String(message).substring(0, 1000),
            source: typeof source === 'string' ? source.substring(0, 500) : '',
            line: parsedLine,
            col: parsedCol,
            stack: typeof stack === 'string' ? stack.substring(0, 4000) : '',
            url: typeof url === 'string' ? url.substring(0, 500) : '',
            userAgent: typeof userAgent === 'string' && userAgent.trim()
                ? userAgent.substring(0, 300)
                : (req.headers['user-agent'] ? String(req.headers['user-agent']).substring(0, 300) : ''),
            reportedAt: now.toISOString(),
            expireAt: admin.firestore.Timestamp.fromDate(expireDate),
            status: 'new'
        };

        const docRef = await db.collection('clientErrors').add(errorData);
        errorData.id = docRef.id;
        console.error(`[CLIENT ERROR] ${errorData.environment} | User: ${errorData.userId} | ${errorData.message} at ${errorData.source}:${errorData.line}`);

        const queueResult = queueClientErrorAlert(errorData);
        console.log(`[CLIENT ERROR] Alert batching status for ${docRef.id}: Queued=${queueResult.queued} (Batch Size=${queueResult.batchSize || 0}, Reason=${queueResult.reason || 'batched'})`);

        res.status(200).json({
            message: 'Client error logged successfully.',
            errorId: docRef.id,
            emailQueued: queueResult.queued,
            batchSize: queueResult.batchSize,
            throttleReason: queueResult.queued ? undefined : queueResult.reason
        });
    } catch (error) {
        console.error('Error handling client error submission:', error);
        res.status(500).json({ reason: 'internalError', message: 'Internal Server Error', error: error.message });
    }
});

router.get('/version', (req, res) => {
    res.json({ currentAppVersion: '3.0.0' });
});

router.get('/check-ip', async (req, res) => {
    const fetch = (await import('node-fetch')).default;
    try {
        const response = await fetch('https://icanhazip.com');
        const ip = await response.text();
        res.status(200).send(ip.trim());
    } catch (error) {
        console.error('Error checking egress IP:', error);
        res.status(500).json({ message: 'Failed to check egress IP', error: error.message });
    }
});

module.exports = router;
