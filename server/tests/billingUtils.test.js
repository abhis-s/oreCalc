const { test } = require('node:test');
const assert = require('node:assert/strict');

const { aggregateMonthlyBilling } = require('../utils/billingUtils.js');

test('aggregateMonthlyBilling aggregates raw BigQuery rows and calculates totals', () => {
    const mockRows = [
        { service_name: 'Compute Engine', total_cost: 15.50, billing_month: '2026-05' },
        { service_name: 'Networking', total_cost: 4.50, billing_month: '2026-05' },
        { service_name: 'Cloud Storage', total_cost: 2.00, billing_month: '2026-05' },
        { service_name: 'Compute Engine', total_cost: 12.00, billing_month: '2026-06' },
        { service_name: 'Networking', total_cost: 3.00, billing_month: '2026-06' }
    ];

    const result = aggregateMonthlyBilling(mockRows, { extras: [], footers: [] }, '2026-07');

    assert.equal(result.totalCostTillDate, 37.00);
    assert.equal(result.breakdown.length, 2);

    const may = result.breakdown.find(b => b.month === '2026-05');
    assert.ok(may);
    assert.equal(may.totalCost, 22.00);
    assert.equal(may.services.length, 3);
    assert.equal(may.services[0].name, 'Compute Engine');
    assert.equal(may.services[0].cost, 15.50);

    const june = result.breakdown.find(b => b.month === '2026-06');
    assert.ok(june);
    assert.equal(june.totalCost, 15.00);
});

test('aggregateMonthlyBilling merges manual extras and footers correctly', () => {
    const mockRows = [
        { service_name: 'Compute Engine', total_cost: 10.00, billing_month: '2026-05' }
    ];
    const extrasConfig = {
        extras: [
            { name: 'Custom Domain SSL', cost: 5.00, month: '2026-05' }
        ],
        footers: [
            { month: '2026-05', text: 'Domain renewed for 1 year.' }
        ]
    };

    const result = aggregateMonthlyBilling(mockRows, extrasConfig, '2026-07');

    assert.equal(result.totalCostTillDate, 15.00);
    const may = result.breakdown[0];
    assert.equal(may.totalCost, 15.00);
    assert.equal(may.footer, 'Domain renewed for 1 year.');

    const highlightedExtra = may.services.find(s => s.highlight);
    assert.ok(highlightedExtra);
    assert.equal(highlightedExtra.name, 'Custom Domain SSL');
    assert.equal(highlightedExtra.cost, 5.00);
});

test('aggregateMonthlyBilling rolls up negligible costs into Others category', () => {
    const mockRows = [
        { service_name: 'Compute Engine', total_cost: 20.00, billing_month: '2026-05' },
        { service_name: 'Secret Manager', total_cost: 0.003, billing_month: '2026-05' },
        { service_name: 'Cloud DNS', total_cost: 0.004, billing_month: '2026-05' }
    ];

    const result = aggregateMonthlyBilling(mockRows, { extras: [], footers: [] }, '2026-07');
    const may = result.breakdown[0];

    const othersService = may.services.find(s => s.name === 'Others');
    assert.ok(othersService);
    assert.equal(othersService.cost, 0.01);
});

test('aggregateMonthlyBilling handles empty or malformed rows safely', () => {
    const result = aggregateMonthlyBilling([], undefined, '2026-07');
    assert.equal(result.totalCostTillDate, 0);
    assert.deepEqual(result.breakdown, []);
});
