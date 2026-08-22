import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    computeEffectiveLevels,
    getRecommendedLevelForTownHall,
    isStatModifiable,
    formatDiffVal,
    resolveModifierRecommendation,
    getDefaultModifierKey,
    formatRegionalDate,
    ESPORTS_COMMON_DOWNGRADE,
    ESPORTS_EPIC_DOWNGRADE,
    MODIFIER_HERO_BOOST_MULTIPLIERS
} from '../../js/domain/equipment/modifierCalculator.js';

test('computeEffectiveLevels calculates standard modifier levels with clamping', () => {
    const standard = computeEffectiveLevels(10, 18, 'Common', 'standard');
    assert.deepEqual(standard, {
        effectiveLevel: 10,
        effectiveMaxLevel: 18,
        trueMaxLevel: 18,
        isDowngraded: false,
        downgrade: 0
    });

    const overMax = computeEffectiveLevels(25, 18, 'Common', 'standard');
    assert.equal(overMax.effectiveLevel, 18);

    const underMin = computeEffectiveLevels(0, 18, 'Common', 'standard');
    assert.equal(underMin.effectiveLevel, 1);
});

test('computeEffectiveLevels applies esports downgrades for Common and Epic rarities', () => {
    const commonEsports = computeEffectiveLevels(18, 18, 'Common', 'esports');
    assert.deepEqual(commonEsports, {
        effectiveLevel: 15,
        effectiveMaxLevel: 15,
        trueMaxLevel: 18,
        isDowngraded: true,
        downgrade: ESPORTS_COMMON_DOWNGRADE
    });

    const epicEsports = computeEffectiveLevels(27, 27, 'Epic', 'esports');
    assert.deepEqual(epicEsports, {
        effectiveLevel: 21,
        effectiveMaxLevel: 21,
        trueMaxLevel: 27,
        isDowngraded: true,
        downgrade: ESPORTS_EPIC_DOWNGRADE
    });

    const lowLevelEsports = computeEffectiveLevels(2, 18, 'Common', 'esports');
    assert.equal(lowLevelEsports.effectiveLevel, 1);
});

test('getRecommendedLevelForTownHall returns appropriate TH recommendation or fallback', () => {
    const rec = {
        recommendedLevels: {
            default: 15,
            byTownHall: {
                8: 6,
                11: 9,
                14: 12,
                16: 15
            }
        }
    };

    assert.equal(getRecommendedLevelForTownHall(rec, 14), 12);
    assert.equal(getRecommendedLevelForTownHall(rec, 15), 12);
    assert.equal(getRecommendedLevelForTownHall(rec, 7), 15);
    assert.equal(getRecommendedLevelForTownHall(null, 16), null);
    assert.equal(getRecommendedLevelForTownHall({}, 16), null);
});

test('isStatModifiable accurately detects modifiable heroBoost stats and custom overrides', () => {
    assert.equal(isStatModifiable({ isModifiable: true }), true);
    assert.equal(isStatModifiable({ isModifiable: false, category: 'heroBoost', key: 'dpsIncrease' }), false);

    assert.equal(isStatModifiable({ category: 'heroBoost', key: 'dpsIncrease' }), true);
    assert.equal(isStatModifiable({ category: 'heroBoost', key: 'hitpointIncrease' }), true);
    assert.equal(isStatModifiable({ category: 'heroBoost', key: 'selfHealingPerSecond' }), true);
    assert.equal(isStatModifiable({ category: 'heroBoost', key: 'healthRecovery' }), true);

    assert.equal(isStatModifiable({ category: 'heroBoost', key: 'speedIncrease' }), false);
    assert.equal(isStatModifiable({ category: 'ability', key: 'dpsIncrease' }), false);
    assert.equal(isStatModifiable(null), false);
    assert.equal(isStatModifiable(undefined), false);
});

test('formatDiffVal formats positive, negative, zero, and unit-based differences', () => {
    assert.equal(formatDiffVal(0), '0');
    assert.equal(formatDiffVal(NaN), '0');
    assert.equal(formatDiffVal(null), '0');

    assert.equal(formatDiffVal(15), '+15');
    assert.equal(formatDiffVal(-8), '-8');
    assert.equal(formatDiffVal(12.5), '+12.5');

    assert.equal(formatDiffVal(1.5, 'seconds'), '+1.5s');
    assert.equal(formatDiffVal(-0.8, 'seconds'), '-0.8s');
    assert.equal(formatDiffVal(2, 'tiles'), '+2 tiles');

    assert.equal(formatDiffVal(25, 'percentage'), '+25%');
    assert.equal(formatDiffVal(-10.5, 'percent'), '-10.5%');
});

test('resolveModifierRecommendation resolves unreleased status and modifier overrides', () => {
    const unreleased = resolveModifierRecommendation({}, 'standard', 16, 18, true);
    assert.equal(unreleased.recStatus, 'unreleased');
    assert.equal(unreleased.targetRecLevel, null);

    const nullRec = resolveModifierRecommendation(null);
    assert.equal(nullRec.recStatus, null);

    const modRec = {
        recStatus: 'recommended',
        recommendedLevels: { default: 18 },
        modifiers: {
            esports: {
                recStatus: 'not_recommended'
            }
        }
    };
    const esportsResolved = resolveModifierRecommendation(modRec, 'esports', 16, 18);
    assert.equal(esportsResolved.recStatus, 'not_recommended');
});

test('getDefaultModifierKey resolves Legends league IDs and names to corresponding modifier keys', () => {
    assert.equal(getDefaultModifierKey(105000036), 'legend1');
    assert.equal(getDefaultModifierKey(105000035), 'legend2');
    assert.equal(getDefaultModifierKey(105000034), 'legend3');

    assert.equal(getDefaultModifierKey(0, 'Legend I'), 'legend1');
    assert.equal(getDefaultModifierKey(0, 'Legend II'), 'legend2');
    assert.equal(getDefaultModifierKey(0, 'Legend III'), 'legend3');

    assert.equal(getDefaultModifierKey(105000000, 'Titan I'), 'standard');
});

test('formatRegionalDate formats ISO dates or gracefully falls back', () => {
    assert.equal(formatRegionalDate(''), '');
    assert.ok(formatRegionalDate('2026-06-05', 'en').includes('2026'));
    assert.equal(formatRegionalDate('invalid-date'), 'invalid-date');
});
