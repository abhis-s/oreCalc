const fs = require('fs');
const path = require('path');
const { BigQuery } = require('@google-cloud/bigquery');
const { db } = require('./firebase.js');
const { safeJsonParse } = require('../utils/jsonUtils.js');
const { aggregateMonthlyBilling } = require('../utils/billingUtils.js');

let cachedBillingData = null;
let isFetchingBillingData = false;

/**
 * Returns mock billing data for local development or BigQuery fallback.
 *
 * @param {string} monthStr - Month string (YYYY-MM).
 * @returns {any} Mock billing data object.
 */
function getMockBillingData(monthStr) {
    return {
        lastUpdated: new Date().toISOString(),
        isMock: true,
        billingMonth: monthStr,
        totalCostTillDate: 0,
        breakdown: [
            {
                month: "2026-05",
                totalCost: 37.00,
                services: [
                    { name: "Compute Engine", cost: 9.50 },
                    { name: "Networking", cost: 27.50 }
                ]
            }
        ]
    };
}

/**
 * Executes BigQuery query to fetch aggregate billing costs grouped by service and month.
 *
 * @returns {Promise<any>} Aggregated monthly billing payload.
 */
async function fetchBillingCostsFromBigQuery() {
    const projectId = process.env.GCP_BILLING_PROJECT_ID || 'orecalc';
    const datasetId = process.env.GCP_BILLING_DATASET_ID || 'orecalc_billing_bq';
    const tableId = process.env.GCP_BILLING_TABLE_ID || 'unified_billing_data';

    const bigquery = new BigQuery({ projectId: projectId });
    const query = `
        SELECT
          service_name,
          sku_name,
          ROUND(SUM(amount), 2) as total_cost,
          FORMAT_TIMESTAMP('%Y-%m', activity_date) as billing_month
        FROM \`${projectId}.${datasetId}.${tableId}\`
        GROUP BY 1, 2, 4
        ORDER BY billing_month DESC, total_cost DESC
    `;

    console.log(`[Billing Cache] Fetching billing costs from BigQuery...`);
    const [rows] = await bigquery.query({ query });

    let extrasConfig = { extras: [], footers: [] };
    const extrasPath = path.join(__dirname, '../billing-extras.json');
    if (fs.existsSync(extrasPath)) {
        extrasConfig = safeJsonParse(fs.readFileSync(extrasPath, 'utf8'), { extras: [], footers: [] });
    }

    const { totalCostTillDate, breakdown } = aggregateMonthlyBilling(rows, extrasConfig);

    const data = {
        lastUpdated: new Date().toISOString(),
        totalCostTillDate,
        breakdown
    };

    return data;
}

/**
 * Retrieves cached billing data from memory or Firestore, triggering background BigQuery fetches if needed.
 *
 * @returns {Promise<any>}
 */
async function getOrUpdateBillingCache() {
    const currentDate = new Date();
    const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    if (cachedBillingData && cachedBillingData.billingMonth === currentMonthStr) {
        return cachedBillingData;
    }

    try {
        const docRef = db.collection('metadata').doc('billingCosts');
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const data = docSnap.data();
            if (data.billingMonth === currentMonthStr) {
                cachedBillingData = data;
                return cachedBillingData;
            }

            if (!isFetchingBillingData) {
                triggerBackgroundBillingFetch(currentMonthStr);
            }
            cachedBillingData = data;
            return cachedBillingData;
        }
    } catch (err) {
        console.error('[Billing Cache] Failed to read from Firestore:', err);
    }

    if (!isFetchingBillingData) {
        try {
            isFetchingBillingData = true;
            const data = await fetchBillingCostsFromBigQuery();
            data.billingMonth = currentMonthStr;
            await db.collection('metadata').doc('billingCosts').set(data);
            cachedBillingData = data;
        } catch (err) {
            console.error('[Billing Cache] Synchronous BigQuery fetch failed:', err);
            cachedBillingData = getMockBillingData(currentMonthStr);
        } finally {
            isFetchingBillingData = false;
        }
    }

    return cachedBillingData;
}

/**
 * Triggers asynchronous background BigQuery fetch and Firestore cache update.
 *
 * @param {string} targetMonthStr - Target month string (YYYY-MM).
 */
function triggerBackgroundBillingFetch(targetMonthStr) {
    isFetchingBillingData = true;
    console.log(`[Billing Cache] Outdated cache detected. Triggering background BigQuery fetch for ${targetMonthStr}...`);
    fetchBillingCostsFromBigQuery().then(async (data) => {
        data.billingMonth = targetMonthStr;
        await db.collection('metadata').doc('billingCosts').set(data);
        cachedBillingData = data;
        console.log(`[Billing Cache] Background cache update successful for ${targetMonthStr}.`);
    }).catch(err => {
        console.error(`[Billing Cache] Background cache update failed:`, err);
    }).finally(() => {
        isFetchingBillingData = false;
    });
}

module.exports = {
    getMockBillingData,
    fetchBillingCostsFromBigQuery,
    getOrUpdateBillingCache,
    triggerBackgroundBillingFetch
};
