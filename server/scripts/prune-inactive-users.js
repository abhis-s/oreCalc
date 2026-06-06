const path = require('path');
const admin = require('firebase-admin');

// Load environment variables from server/.env or root .env
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.FIRESTORE_SA_KEY) {
    console.error("Error: FIRESTORE_SA_KEY environment variable is not set.");
    process.exit(1);
}

let serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.FIRESTORE_SA_KEY);
} catch (parseError) {
    console.error("Error parsing FIRESTORE_SA_KEY JSON:", parseError.message);
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

async function pruneInactiveUsers() {
    try {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - 90);
        const thresholdIsoString = thresholdDate.toISOString();

        console.log(`[PRUNE] Scanning for userStates documents inactive since (90 days): ${thresholdIsoString}`);

        // ISO string comparison works natively in Firestore query sorting/filtering
        const querySnapshot = await db.collection('userStates')
            .where('timestamp', '<', thresholdIsoString)
            .get();

        console.log(`[PRUNE] Found ${querySnapshot.size} inactive userStates documents to prune.`);

        if (querySnapshot.size === 0) {
            console.log("[PRUNE] No documents require pruning at this time.");
            return;
        }

        // Firestore batch limits operations to 500 writes
        const docs = querySnapshot.docs;
        const chunks = [];
        for (let i = 0; i < docs.length; i += 500) {
            chunks.push(docs.slice(i, i + 500));
        }

        let prunedCount = 0;
        for (const chunk of chunks) {
            const batch = db.batch();
            chunk.forEach(doc => {
                batch.delete(doc.ref);
                prunedCount++;
            });
            await batch.commit();
            console.log(`[PRUNE] Committed batch deletion of ${chunk.length} documents.`);
        }

        console.log(`[PRUNE] Successfully pruned a total of ${prunedCount} inactive userStates documents.`);
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
