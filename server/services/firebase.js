const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { safeJsonParse } = require('../utils/jsonUtils.js');
const { isValidUserId } = require('../utils/validation.js');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.FIRESTORE_SA_KEY) {
    console.error("Error: FIRESTORE_SA_KEY environment variable is not set.");
    process.exit(1);
}

const serviceAccount = safeJsonParse(process.env.FIRESTORE_SA_KEY);
if (!serviceAccount) {
    console.error("Error parsing FIRESTORE_SA_KEY JSON. Please ensure the secret content is valid JSON.");
    process.exit(1);
}

const app = getApps().length === 0
    ? initializeApp({ credential: cert(serviceAccount) })
    : getApps()[0];

const db = getFirestore(app);

/**
 * Checks whether a given user UUID has been marked as deleted (tombstone).
 *
 * @param {string|null|undefined} userId - The user ID to inspect.
 * @returns {Promise<boolean>} True if the user is deleted.
 */
async function isUserDeleted(userId) {
    if (!isValidUserId(userId)) return false;
    const doc = await db.collection('deletedUuids').doc(userId).get();
    return doc.exists;
}

module.exports = {
    db,
    FieldValue,
    Timestamp,
    isUserDeleted
};
