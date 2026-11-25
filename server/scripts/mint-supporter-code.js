#!/usr/bin/env node
/**
 * Admin CLI script to mint a single-use ClashCalc Supporter redemption code directly in Firestore.
 *
 * Usage:
 *   node server/scripts/mint-supporter-code.js --note "RedFex"
 *   node server/scripts/mint-supporter-code.js --note "RedFex" --email "user@example.com" --name "RedFex"
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { db } = require('../services/firebase.js');
const { mintSupporterCode } = require('../services/supporterCodeService.js');
const { sendSupporterCodeEmail } = require('../services/supporterMailService.js');

/**
 * Parses simple --key value CLI flags.
 *
 * @param {string[]} argv
 * @returns {{ note: string, email: string, name: string }}
 */
function parseArgs(argv) {
    const out = { note: '', email: '', name: '' };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const next = argv[i + 1] || '';
        if (arg === '--note' && next) {
            out.note = next;
            i++;
        } else if (arg === '--email' && next) {
            out.email = next;
            i++;
        } else if (arg === '--name' && next) {
            out.name = next;
            i++;
        }
    }
    return out;
}

async function main() {
    const { note, email, name } = parseArgs(process.argv.slice(2));
    const result = await mintSupporterCode({
        db,
        source: 'manual',
        supporterEmail: email || null,
        supporterName: name || null,
        note: note || 'Manual admin mint'
    });

    if (!result.code) {
        console.error('[ERROR] Failed to mint supporter code.');
        process.exit(1);
    }

    console.log('[OK] Single-use supporter code minted and stored (SHA-256 hashed) in Firestore:');
    console.log(`     Code : ${result.code}`);
    if (note) console.log(`     Note : ${note}`);

    if (email) {
        const mailRes = await sendSupporterCodeEmail({
            toEmail: email,
            supporterName: name,
            code: result.code
        });
        if (mailRes.sent) {
            console.log(`[OK] Supporter code email sent to ${email}.`);
        } else {
            console.warn(`[WARN] Email was not sent (${mailRes.error || 'SMTP not configured'}). Share the code above manually.`);
        }
    }
}

main().catch((err) => {
    console.error('[ERROR] Mint script failed:', err);
    process.exit(1);
});
