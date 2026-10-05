/**
 * Feature Domain Tests for Battle Modifier Decoupling & Unified Architecture.
 *
 * Verifies that:
 * 1. Battle Modifier is decoupled from Player League ID while keeping the player's league as smart default.
 * 2. state.uiSettings.leagueModifier acts as the persistent global source of truth.
 * 3. Domain damage engines (zapQuakeSolver, equipmentDamage, attackSimulator) accept options.modifier
 *    and maintain backward-compatible fallback to options.leagueId.
 * 4. User explicit choice (e.g. Esports) is preserved and not clobbered by player village refresh.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { getDefaultState, state as appGlobalState } from '../../js/core/state.js';
import {
    damageCalcState,
    resetDamageCalcState
} from '../../js/components/damage/damageCalcState.js';
import { syncPlayerVillageData } from '../../js/components/damage/damageCalcSyncService.js';
import { getEffectiveEquipmentLevel } from '../../js/domain/damage/damageFormulas.js';
import { solveZapQuakeCombinations } from '../../js/domain/damage/zapQuakeSolver.js';
import { calculateEquipmentDamage } from '../../js/domain/damage/equipmentDamage.js';
import {
    simulateAttackSequence,
    simulateSequenceAcrossAllDefenses
} from '../../js/domain/damage/attackSimulator.js';
import { getDefaultModifierKey } from '../../js/domain/equipment/modifierCalculator.js';
import {
    getModifierLabel,
    MODIFIER_PERCENTAGE_SUFFIXES,
    getBattleModifierSwitcherMarkup,
    renderBattleModifierSwitcher
} from '../../js/components/common/battleModifierSwitcher.js';
import { loadTranslations } from '../../js/i18n/translator.js';
import enJson from '../../js/i18n/en.json' with { type: 'json' };
import deJson from '../../js/i18n/de.json' with { type: 'json' };
import trJson from '../../js/i18n/tr.json' with { type: 'json' };
import zhJson from '../../js/i18n/zh.json' with { type: 'json' };

import { preloadDefensesData } from '../../js/data/defenseTargetsData.js';
import { readFileSync as _rfs } from 'node:fs';
import _path2 from 'node:path';
import { fileURLToPath as _ftu2 } from 'node:url';
const _tdir2 = _path2.dirname(_ftu2(import.meta.url));
const _tgdir2 = _path2.resolve(_tdir2, '../../js/data/targets');
globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/en.json')) return { ok: true, json: async () => enJson };
    if (urlStr.includes('/de.json')) return { ok: true, json: async () => deJson };
    if (urlStr.includes('/tr.json')) return { ok: true, json: async () => trJson };
    if (urlStr.includes('/zh.json')) return { ok: true, json: async () => zhJson };
    if (urlStr.includes('/targets/')) {
        const file = urlStr.split('/').pop();
        const data = JSON.parse(_rfs(_path2.resolve(_tgdir2, file), 'utf8'));
        return { ok: true, json: async () => data };
    }
    return { ok: false, status: 404 };
};
await preloadDefensesData();

test('Battle Modifier Decoupling & Unified Architecture', async (t) => {
    // Mock localStorage
    const mockStorage = new Map();
    globalThis.localStorage = {
        getItem: (k) => mockStorage.get(k) || null,
        setItem: (k, v) => mockStorage.set(k, String(v)),
        removeItem: (k) => mockStorage.delete(k),
        clear: () => mockStorage.clear()
    };

    // Ensure global app state uiSettings is initialized
    appGlobalState.uiSettings = getDefaultState().uiSettings;

    await t.test('Top-level UI settings defines default leagueModifier as standard', () => {
        const defaultState = getDefaultState();
        assert.equal(defaultState.uiSettings.leagueModifier, 'standard');
    });

    await t.test('getDefaultModifierKey maps league IDs accurately with fallback to standard', () => {
        assert.equal(getDefaultModifierKey(105000036, 'Legend League'), 'legend1');
        assert.equal(getDefaultModifierKey(105000035, 'Legend League II'), 'legend2');
        assert.equal(getDefaultModifierKey(105000034, 'Legend League III'), 'legend3');
        assert.equal(getDefaultModifierKey(105000033, 'Titan League I'), 'standard');
        assert.equal(getDefaultModifierKey(0, ''), 'standard');
        assert.equal(getDefaultModifierKey(null, null), 'standard');
    });

    await t.test('Domain getEffectiveEquipmentLevel applies esports modifier reductions correctly', () => {
        // Epic equipment (Fireball): -6 levels capped at 21
        assert.equal(getEffectiveEquipmentLevel('fireball', 27, 'esports'), 21);
        assert.equal(getEffectiveEquipmentLevel('fireball', 20, 'esports'), 14);
        assert.equal(getEffectiveEquipmentLevel('fireball', 5, 'esports'), 1);

        // Common equipment (Giant Arrow): -3 levels capped at 15
        assert.equal(getEffectiveEquipmentLevel('giant_arrow', 18, 'esports'), 15);
        assert.equal(getEffectiveEquipmentLevel('giant_arrow', 14, 'esports'), 11);
        assert.equal(getEffectiveEquipmentLevel('giant_arrow', 2, 'esports'), 1);

        // Standard / Legend modifiers: 0 level loss
        assert.equal(getEffectiveEquipmentLevel('fireball', 27, 'standard'), 27);
        assert.equal(getEffectiveEquipmentLevel('fireball', 27, 'legend1'), 27);
        assert.equal(getEffectiveEquipmentLevel('fireball', 27, 'legend2'), 27);
        assert.equal(getEffectiveEquipmentLevel('fireball', 27, 'legend3'), 27);
    });

    await t.test('calculateEquipmentDamage honors modifier option and legacy leagueId alias', () => {
        // Fireball vs Eagle Artillery (Lvl 7, HP 6000)
        // Lvl 27 in standard = 4100 damage
        const dmgStandard = calculateEquipmentDamage('fireball', 27, 'eagle_artillery', 7, { modifier: 'standard' });
        assert.equal(dmgStandard.rawDamage, 4100);
        assert.equal(dmgStandard.damageDealt, 4100);

        // Lvl 27 in esports (effective level 21) = 3650 damage
        const dmgEsports = calculateEquipmentDamage('fireball', 27, 'eagle_artillery', 7, { modifier: 'esports' });
        assert.equal(dmgEsports.rawDamage, 3650);
        assert.equal(dmgEsports.damageDealt, 3650);

        // Backward compatibility: using options.leagueId
        const dmgLegacy = calculateEquipmentDamage('fireball', 27, 'eagle_artillery', 7, { leagueId: 'esports' });
        assert.equal(dmgLegacy.rawDamage, 3650);
        assert.equal(dmgLegacy.damageDealt, 3650);
    });

    await t.test('simulateAttackSequence and simulateSequenceAcrossAllDefenses accept modifier and legacy leagueId', () => {
        const steps = [
            { type: 'equipment', id: 'fireball', level: 27, rawLevel: 27 }
        ];

        const resModifier = simulateAttackSequence('eagle_artillery', 7, steps, { modifier: 'esports' });
        const resLegacy = simulateAttackSequence('eagle_artillery', 7, steps, { leagueId: 'esports' });
        assert.equal(resModifier.totalDamageDealt, resLegacy.totalDamageDealt);
        assert.equal(resModifier.totalDamageDealt, 3650);

        const multiModifier = simulateSequenceAcrossAllDefenses(steps, { modifier: 'esports' });
        const multiLegacy = simulateSequenceAcrossAllDefenses(steps, { leagueId: 'esports' });
        const eagleMod = multiModifier.find(c => c.defenseKey === 'eagle_artillery');
        const eagleLeg = multiLegacy.find(c => c.defenseKey === 'eagle_artillery');
        assert.equal(eagleMod.totalDamageDealt, eagleLeg.totalDamageDealt);
        assert.equal(eagleMod.totalDamageDealt, 3650);
    });

    await t.test('solveZapQuakeCombinations honors modifier option and legacy leagueId alias', () => {
        const solModifier = solveZapQuakeCombinations('air_defense', 16, 13, 8, {
            modifier: 'esports',
            enabledEquipment: [{ id: 'giant_arrow', level: 15, rawLevel: 18 }]
        });
        const solLegacy = solveZapQuakeCombinations('air_defense', 16, 13, 8, {
            leagueId: 'esports',
            enabledEquipment: [{ id: 'giant_arrow', level: 15, rawLevel: 18 }]
        });
        assert.equal(solModifier.combinations.length, solLegacy.combinations.length);
        assert.equal(solModifier.targetHp, solLegacy.targetHp);
    });

    await t.test('syncPlayerVillageData synchronizes to appGlobalState.uiSettings.leagueModifier', () => {
        resetDamageCalcState();
        appGlobalState.uiSettings.leagueModifier = 'standard';

        syncPlayerVillageData({
            leagueTier: { id: 105000035, name: 'Legend League II' }
        });

        assert.equal(damageCalcState.modifier, 'legend2');
        assert.equal(damageCalcState.leagueId, 'legend2');
        assert.equal(appGlobalState.uiSettings.leagueModifier, 'legend2');
    });

    await t.test('Explicit modifier choice in damageCalcState is preserved across syncPlayerVillageData', () => {
        resetDamageCalcState();
        damageCalcState.modifier = 'esports';
        damageCalcState.isModifierExplicit = true;
        appGlobalState.uiSettings.leagueModifier = 'esports';

        // Subsequent village data sync with different league
        syncPlayerVillageData({
            leagueTier: { id: 105000036, name: 'Legend League' }
        });

        // User explicit choice remains esports
        assert.equal(damageCalcState.modifier, 'esports');
        assert.equal(damageCalcState.leagueId, 'esports');
        assert.equal(appGlobalState.uiSettings.leagueModifier, 'esports');
    });

    await t.test('MODIFIER_PERCENTAGE_SUFFIXES defines canonical suffixes', () => {
        assert.equal(MODIFIER_PERCENTAGE_SUFFIXES.standard, '');
        assert.equal(MODIFIER_PERCENTAGE_SUFFIXES.legend3, ' (+10%)');
        assert.equal(MODIFIER_PERCENTAGE_SUFFIXES.legend2, ' (+15%)');
        assert.equal(MODIFIER_PERCENTAGE_SUFFIXES.legend1, ' (+20%)');
        assert.equal(MODIFIER_PERCENTAGE_SUFFIXES.esports, '');
    });

    await t.test('getModifierLabel returns accurate localized names across all 4 locales', async () => {
        // English
        appGlobalState.uiSettings.language = 'en';
        await loadTranslations('en');
        assert.equal(getModifierLabel('standard', true), 'Standard');
        assert.equal(getModifierLabel('legend3', true), 'Legend III (+10%)');
        assert.equal(getModifierLabel('legend2', true), 'Legend II (+15%)');
        assert.equal(getModifierLabel('legend1', true), 'Legend I (+20%)');
        assert.equal(getModifierLabel('esports', true), 'Esports');

        assert.equal(getModifierLabel('standard', false), 'Standard');
        assert.equal(getModifierLabel('legend3', false), 'Legend III');
        assert.equal(getModifierLabel('legend2', false), 'Legend II');
        assert.equal(getModifierLabel('legend1', false), 'Legend I');
        assert.equal(getModifierLabel('esports', false), 'Esports');

        // German
        appGlobalState.uiSettings.language = 'de';
        await loadTranslations('de');
        assert.equal(getModifierLabel('standard', true), 'Standard');
        assert.equal(getModifierLabel('legend3', true), 'Legende III (+10%)');
        assert.equal(getModifierLabel('legend2', true), 'Legende II (+15%)');
        assert.equal(getModifierLabel('legend1', true), 'Legende I (+20%)');
        assert.equal(getModifierLabel('esports', true), 'E-Sports');

        assert.equal(getModifierLabel('standard', false), 'Standard');
        assert.equal(getModifierLabel('legend3', false), 'Legende III');
        assert.equal(getModifierLabel('legend2', false), 'Legende II');
        assert.equal(getModifierLabel('legend1', false), 'Legende I');
        assert.equal(getModifierLabel('esports', false), 'E-Sports');

        // Turkish
        appGlobalState.uiSettings.language = 'tr';
        await loadTranslations('tr');
        assert.equal(getModifierLabel('standard', true), 'Standart');
        assert.equal(getModifierLabel('legend3', true), 'Efsane III (+10%)');
        assert.equal(getModifierLabel('legend2', true), 'Efsane II (+15%)');
        assert.equal(getModifierLabel('legend1', true), 'Efsane I (+20%)');
        assert.equal(getModifierLabel('esports', true), 'E-spor');

        assert.equal(getModifierLabel('standard', false), 'Standart');
        assert.equal(getModifierLabel('legend3', false), 'Efsane III');
        assert.equal(getModifierLabel('legend2', false), 'Efsane II');
        assert.equal(getModifierLabel('legend1', false), 'Efsane I');
        assert.equal(getModifierLabel('esports', false), 'E-spor');

        // Chinese
        appGlobalState.uiSettings.language = 'zh';
        await loadTranslations('zh');
        assert.equal(getModifierLabel('standard', true), '标准');
        assert.equal(getModifierLabel('legend3', true), '传奇杯 III (+10%)');
        assert.equal(getModifierLabel('legend2', true), '传奇杯 II (+15%)');
        assert.equal(getModifierLabel('legend1', true), '传奇杯 I (+20%)');
        assert.equal(getModifierLabel('esports', true), '电竞');

        assert.equal(getModifierLabel('standard', false), '标准');
        assert.equal(getModifierLabel('legend3', false), '传奇杯 III');
        assert.equal(getModifierLabel('legend2', false), '传奇杯 II');
        assert.equal(getModifierLabel('legend1', false), '传奇杯 I');
        assert.equal(getModifierLabel('esports', false), '电竞');

        // Restore English
        appGlobalState.uiSettings.language = 'en';
        await loadTranslations('en');
    });

    await t.test('getBattleModifierSwitcherMarkup generates data-i18n attributes and percentage span', async () => {
        appGlobalState.uiSettings.language = 'en';
        await loadTranslations('en');
        const markupWithPct = getBattleModifierSwitcherMarkup('legend3', { includePercentages: true });
        assert.ok(markupWithPct.includes('data-i18n="views.equipment.modifiers.legend3"'));
        assert.ok(markupWithPct.includes('<span class="mod-tab-percent"> (+10%)</span>'));
        assert.ok(markupWithPct.includes('Legend III'));

        const markupWithoutPct = getBattleModifierSwitcherMarkup('legend3', { includePercentages: false });
        assert.ok(markupWithoutPct.includes('data-i18n="views.equipment.modifiers.legend3"'));
        assert.ok(!markupWithoutPct.includes('<span class="mod-tab-percent">'));
    });

    await t.test('renderBattleModifierSwitcher updates button text nodes in-place when re-rendered', async () => {
        appGlobalState.uiSettings.language = 'en';
        await loadTranslations('en');
        const mockBtn = {
            getAttribute: (attr) => attr === 'data-mod-key' ? 'legend3' : null,
            classList: { toggle: () => {} },
            setAttribute: () => {},
            childNodes: [{ nodeType: 3, textContent: 'Legend III' }]
        };
        const mockContainer = {
            classList: { contains: () => true },
            querySelector: (sel) => sel === '.mod-tab-btn' ? mockBtn : null,
            querySelectorAll: (sel) => sel === '.mod-tab-btn' ? [mockBtn] : [],
            dataset: {}
        };

        // Switch language to German
        appGlobalState.uiSettings.language = 'de';
        await loadTranslations('de');
        renderBattleModifierSwitcher(/** @type {any} */ (mockContainer), 'legend3', { includePercentages: true });
        assert.equal(mockBtn.childNodes[0].textContent, 'Legende III');

        // Restore English
        appGlobalState.uiSettings.language = 'en';
        await loadTranslations('en');
    });
});
