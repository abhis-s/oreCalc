const fs = require('fs');
const path = require('path');
const { BigQuery } = require('@google-cloud/bigquery');

// Resolve the root directory and .env file
const projectRoot = process.cwd();
const envPath = path.join(projectRoot, '.env');

if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    require('dotenv').config();
}

const outputFile = path.join(projectRoot, 'js/data/runningCostsData.js');

async function main() {
    const projectId = process.env.GCP_BILLING_PROJECT_ID || 'orecalc';
    const datasetId = process.env.GCP_BILLING_DATASET_ID || 'orecalc_billing_bq';
    const tableId = process.env.GCP_BILLING_TABLE_ID || 'unified_billing_data';

    // We check if we have credentials set up
    const hasCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                           fs.existsSync(path.join(projectRoot, 'service-account-key.json'));

    if (!hasCredentials && !process.env.GCP_BILLING_PROJECT_ID) {
        console.warn('GCP Billing credentials not configured. Generating default running costs data.');
        writeMockData();
        return;
    }

    // Load optional billing extras
    let extrasConfig = { extras: [], footers: [] };
    const extrasPath = path.join(projectRoot, 'billing-extras.json');
    if (fs.existsSync(extrasPath)) {
        try {
            extrasConfig = JSON.parse(fs.readFileSync(extrasPath, 'utf8'));
        } catch (err) {
            console.error('Error parsing billing-extras.json:', err);
        }
    }

    try {
        const bigquery = new BigQuery({ projectId: projectId });

        // Retrieve the service and SKU level costs per month
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

        console.log(`Fetching billing costs from BigQuery using view: ${projectId}.${datasetId}.${tableId}...`);
        const [rows] = await bigquery.query({ query });

        // Current Month (for filtering out of history and excluding from total cost)
        const currentDate = new Date();
        const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

        let totalCostTillDate = 0;
        const monthlyGroups = {};
        
        // 1. Process BigQuery rows
        rows.forEach(row => {
            const cost = parseFloat(row.total_cost || 0);
            const month = row.billing_month; // e.g. "2026-05"
            if (!month) return;

            // Only add to total cost if it belongs to a completed month (prior to the current month)
            if (month < currentMonthStr) {
                totalCostTillDate += cost;
            }

            if (!monthlyGroups[month]) {
                monthlyGroups[month] = {
                    month: month,
                    services: {}
                };
            }

            const serviceName = row.service_name || 'Other Services';
            if (!monthlyGroups[month].services[serviceName]) {
                monthlyGroups[month].services[serviceName] = 0;
            }
            monthlyGroups[month].services[serviceName] += cost;
        });

        // 2. Merge Extras into totalCostTillDate and ensure their months exist in monthlyGroups
        if (extrasConfig.extras && extrasConfig.extras.length > 0) {
            extrasConfig.extras.forEach(extra => {
                const cost = parseFloat(extra.cost || 0);
                const month = extra.month;
                if (!month) return;

                // Add to totalCostTillDate if completed month
                if (month < currentMonthStr) {
                    totalCostTillDate += cost;
                }

                if (!monthlyGroups[month]) {
                    monthlyGroups[month] = {
                        month: month,
                        services: {}
                    };
                }
            });
        }

        // Get months, sort descending
        const sortedMonths = Object.keys(monthlyGroups)
            .sort((a, b) => b.localeCompare(a));

        // Filter out the current month and any future months from history, and take the last 6 completed months
        const historyMonths = sortedMonths
            .filter(m => m < currentMonthStr)
            .slice(0, 6);

        const breakdown = historyMonths.map(month => {
            const group = monthlyGroups[month];
            
            // Map services to array
            const servicesArray = Object.keys(group.services).map(name => ({
                name: name,
                cost: parseFloat(group.services[name].toFixed(2))
            }));

            // Filter out negligible costs (< 0.01) and group into "Others"
            let negligibleSum = 0;
            const filteredServices = [];

            servicesArray.forEach(s => {
                if (s.cost < 0.01) {
                    negligibleSum += s.cost;
                } else {
                    filteredServices.push(s);
                }
            });

            if (negligibleSum > 0) {
                filteredServices.push({
                    name: 'Others',
                    cost: parseFloat(negligibleSum.toFixed(2))
                });
            }

            // Sort standard services by cost descending
            filteredServices.sort((a, b) => b.cost - a.cost);

            // Fetch and map extras for this month (marked with highlight: true)
            const monthExtras = (extrasConfig.extras || [])
                .filter(e => e.month === month)
                .map(e => ({
                    name: e.name,
                    cost: parseFloat((e.cost || 0).toFixed(2)),
                    highlight: true
                }));

            // Prepend extras at the very top
            const finalServices = [...monthExtras, ...filteredServices];

            // Calculate total cost (including extras)
            const totalCost = parseFloat(finalServices.reduce((sum, s) => sum + s.cost, 0).toFixed(2));

            // Check if there is a footer for this month
            const footerMatch = (extrasConfig.footers || []).find(f => f.month === month);

            const result = {
                month: month,
                totalCost: totalCost,
                services: finalServices
            };

            if (footerMatch && footerMatch.text) {
                result.footer = footerMatch.text;
            }

            return result;
        });

        const data = {
            lastUpdated: new Date().toISOString(),
            totalCostTillDate: parseFloat(totalCostTillDate.toFixed(2)),
            breakdown: breakdown
        };

        writeCostsData(data);
        console.log('Successfully injected running costs data.');
    } catch (error) {
        console.error('Error fetching billing costs from BigQuery:', error);
        console.warn('Falling back to default running costs data.');
        writeMockData();
    }
}

function writeCostsData(data) {
    try {
        const dir = path.dirname(outputFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const content = `// This file is auto-generated at build time by scripts/fetch-billing-costs.js.
// Do not edit this file directly.

export const runningCostsData = ${JSON.stringify(data, null, 4)};
`;
        fs.writeFileSync(outputFile, content, 'utf8');
    } catch (writeError) {
        console.error('Error writing running costs data file:', writeError);
    }
}

function writeMockData() {
    let extrasConfig = { extras: [], footers: [] };
    const extrasPath = path.join(process.cwd(), 'billing-extras.json');
    if (fs.existsSync(extrasPath)) {
        try {
            extrasConfig = JSON.parse(fs.readFileSync(extrasPath, 'utf8'));
        } catch (err) {}
    }

    const currentDate = new Date();
    const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    const defaultData = {
        lastUpdated: new Date().toISOString(),
        isMock: true,
        totalCostTillDate: 0,
        breakdown: [
            {
                month: "2026-05",
                totalCost: 37.00,
                services: [
                    { name: "Compute Engine", cost: 9.50 },
                    { name: "Networking", cost: 27.50 }
                ]
            },
            {
                month: "2026-04",
                totalCost: 36.00,
                services: [
                    { name: "Compute Engine", cost: 9.20 },
                    { name: "Networking", cost: 26.80 }
                ]
            },
            {
                month: "2026-03",
                totalCost: 35.00,
                services: [
                    { name: "Compute Engine", cost: 8.90 },
                    { name: "Networking", cost: 26.10 }
                ]
            },
            {
                month: "2026-02",
                totalCost: 34.00,
                services: [
                    { name: "Compute Engine", cost: 8.60 },
                    { name: "Networking", cost: 25.40 }
                ]
            },
            {
                month: "2026-01",
                totalCost: 33.00,
                services: [
                    { name: "Compute Engine", cost: 8.30 },
                    { name: "Networking", cost: 24.70 }
                ]
            },
            {
                month: "2025-12",
                totalCost: 32.00,
                services: [
                    { name: "Compute Engine", cost: 8.00 },
                    { name: "Networking", cost: 24.00 }
                ]
            }
        ]
    };

    let grandTotal = 0;

    defaultData.breakdown.forEach(item => {
        const month = item.month;

        // Find and map extras for this month
        const monthExtras = (extrasConfig.extras || [])
            .filter(e => e.month === month)
            .map(e => ({
                name: e.name,
                cost: parseFloat((e.cost || 0).toFixed(2)),
                highlight: true
            }));

        // Prepend extras
        if (monthExtras.length > 0) {
            item.services = [...monthExtras, ...item.services];
            item.totalCost = parseFloat(item.services.reduce((sum, s) => sum + s.cost, 0).toFixed(2));
        }

        // Find footer note
        const footerMatch = (extrasConfig.footers || []).find(f => f.month === month);
        if (footerMatch && footerMatch.text) {
            item.footer = footerMatch.text;
        }

        // Accumulate month total cost since they are completed
        grandTotal += item.totalCost;
    });

    // Add any historical extras that are not in the last 6 months but are completed
    if (extrasConfig.extras) {
        const breakdownMonths = defaultData.breakdown.map(i => i.month);
        extrasConfig.extras.forEach(extra => {
            const cost = parseFloat(extra.cost || 0);
            const month = extra.month;
            if (month && month < currentMonthStr && !breakdownMonths.includes(month)) {
                grandTotal += cost;
            }
        });
    }

    defaultData.totalCostTillDate = parseFloat(grandTotal.toFixed(2));

    writeCostsData(defaultData);
}

main();
