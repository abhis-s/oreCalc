const path = require('path');
const admin = require('firebase-admin');
const { safeJsonParse } = require('../utils/jsonUtils.js');
const { SERVER_CONSTANTS } = require('../constants.js');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.FIRESTORE_SA_KEY) {
    console.error("[ERROR] FIRESTORE_SA_KEY environment variable is not set.");
    process.exit(1);
}

const serviceAccount = safeJsonParse(process.env.FIRESTORE_SA_KEY);
if (!serviceAccount) {
    console.error("[ERROR] Failed to parse FIRESTORE_SA_KEY JSON. Please ensure the secret content is valid JSON.");
    process.exit(1);
}

let db;
if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
} else {
    db = admin.firestore();
}

/**
 * Scans and prunes userStates documents that have been inactive past the threshold period.
 * Records execution metadata and pruned user IDs in the pruneAuditLogs collection.
 */
async function pruneInactiveUsers() {
    try {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - SERVER_CONSTANTS.INACTIVE_USER_DAYS_THRESHOLD);
        const thresholdIsoString = thresholdDate.toISOString();

        console.log(`[PRUNE] Scanning for userStates documents inactive since (${SERVER_CONSTANTS.INACTIVE_USER_DAYS_THRESHOLD} days): ${thresholdIsoString}`);

        // ISO string comparison works natively in Firestore query sorting/filtering.
        // Limit to configured document limit per run to avoid large transactions.
        const querySnapshot = await db.collection('userStates')
            .where('timestamp', '<', thresholdIsoString)
            .limit(SERVER_CONSTANTS.PRUNE_BATCH_LIMIT)
            .get();

        console.log(`[PRUNE] Found ${querySnapshot.size} inactive userStates documents to prune.`);

        if (querySnapshot.size === 0) {
            console.log("[PRUNE] No documents require pruning at this time.");
            return { prunedCount: 0, prunedUserIds: [] };
        }

        // Firestore batch limits operations to 500 writes. We use 25 here
        // to avoid "Transaction too big" errors when documents/index entries are large.
        const docs = querySnapshot.docs;
        const chunks = [];
        for (let i = 0; i < docs.length; i += 25) {
            chunks.push(docs.slice(i, i + 25));
        }

        let prunedCount = 0;
        const prunedUserIds = [];

        for (const chunk of chunks) {
            const batch = db.batch();
            chunk.forEach(doc => {
                batch.delete(doc.ref);
                prunedUserIds.push(doc.id);
                prunedCount++;
            });
            await batch.commit();
            console.log(`[PRUNE] Committed batch deletion of ${chunk.length} documents.`);
        }

        // Persist audit record in pruneAuditLogs collection
        const auditLogRef = await db.collection('pruneAuditLogs').add({
            executedAt: new Date().toISOString(),
            serverTimestamp: admin.firestore.FieldValue.serverTimestamp(),
            inactiveThresholdDate: thresholdIsoString,
            inactiveDaysThreshold: SERVER_CONSTANTS.INACTIVE_USER_DAYS_THRESHOLD,
            prunedCount,
            prunedUserIds
        });

        console.log(`[PRUNE] Successfully pruned a total of ${prunedCount} inactive userStates documents. Audit log ID: ${auditLogRef.id}`);
        return { prunedCount, prunedUserIds, auditLogId: auditLogRef.id };
    } catch (error) {
        console.error('[PRUNE] Error during inactive data pruning:', error);
        throw error;
    }
}

if (require.main === module) {
    pruneInactiveUsers()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
} else {
    module.exports = { pruneInactiveUsers };
}
