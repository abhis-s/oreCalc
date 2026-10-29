const { SERVER_CONSTANTS } = require('../constants.js');
const { db, FieldValue } = require('../services/firebase.js');
const { pruneExpiredAuthChallenges } = require('../services/authService.js');

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

        let prunedCount = 0;
        let subcollectionDocsDeleted = 0;
        const prunedUserIds = [];

        for (const doc of querySnapshot.docs) {
            const data = doc.data() || {};
            const savedPlayerTags = Array.isArray(data.savedPlayerTags) ? data.savedPlayerTags : [];
            const currentUiSettings = data.uiSettings && typeof data.uiSettings === 'object' ? data.uiSettings : {};
            const preservedUiSettings = {
                currency: currentUiSettings.currency || { code: 'USD' },
                theme: currentUiSettings.theme || 'dark',
                language: currentUiSettings.language || 'auto'
            };

            const prunedRootDoc = {
                appVersion: SERVER_CONSTANTS.MIN_SUPPORTED_APP_VERSION,
                savedPlayerTags,
                uiSettings: preservedUiSettings,
                timestamp: new Date().toISOString(),
                stateResetEpoch: Date.now(),
                isPruned: true,
                isMigrated: true,
                ownerAccount: data.ownerAccount ?? null,
                authRequired: data.authRequired ?? false
            };

            const batch = db.batch();
            // Full replacement on parent document wipes heavy state properties
            batch.set(doc.ref, prunedRootDoc);

            // Subcollection Sweeper: fetch and delete stranded player documents
            const playersSnapshot = await doc.ref.collection('players').get();
            for (const playerDoc of playersSnapshot.docs) {
                batch.delete(playerDoc.ref);
                subcollectionDocsDeleted++;
            }

            await batch.commit();
            prunedUserIds.push(doc.id);
            prunedCount++;
            console.log(`[PRUNE] Successfully pruned user ${doc.id} (deleted ${playersSnapshot.size} subcollection player docs).`);
        }

        let challengesPruned = 0;
        try {
            const challengePruneResult = await pruneExpiredAuthChallenges(db);
            challengesPruned = challengePruneResult.firestorePurged;
        } catch (err) {
            console.error('[PRUNE] Failed to prune auth challenges:', err);
        }

        // Persist audit record in pruneAuditLogs collection
        const auditLogRef = await db.collection('pruneAuditLogs').add({
            executedAt: new Date().toISOString(),
            serverTimestamp: FieldValue.serverTimestamp(),
            inactiveThresholdDate: thresholdIsoString,
            inactiveDaysThreshold: SERVER_CONSTANTS.INACTIVE_USER_DAYS_THRESHOLD,
            prunedCount,
            subcollectionDocsDeleted,
            prunedUserIds,
            challengesPruned
        });

        console.log(`[PRUNE] Successfully pruned a total of ${prunedCount} inactive userStates documents (${subcollectionDocsDeleted} player subcollection docs wiped) and ${challengesPruned} expired challenges. Audit log ID: ${auditLogRef.id}`);
        return { prunedCount, subcollectionDocsDeleted, prunedUserIds, challengesPruned, auditLogId: auditLogRef.id };
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
