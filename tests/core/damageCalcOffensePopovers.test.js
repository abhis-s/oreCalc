/**
 * Feature Domain Tests for Damage Calculator Offense Stat & Rules Popovers.
 * Validates equipment combat stats, diminishing EQ series, lightning scaling, modifiers, and localization.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../../js/core/state.js';
import { loadTranslations } from '../../js/i18n/translator.js';
import {
    getEquipmentStatsPopoverContent,
    getEarthquakeStatsPopoverContent,
    getLightningStatsPopoverContent,
    getDamageSourcePopoverContent,
    getGenericInfoPopoverContent,
    getActionInfoPopoverContent,
    getNoteCodePopoverContent
} from '../../js/components/damage/damageCalcOffensePopoversDisplay.js';
import { getComboBadgePopoverContent } from '../../js/components/damage/damageCalcGridPopoversDisplay.js';
import { getHpUnit } from '../../js/components/damage/damageCalcDisplay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));
const deJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/de.json'), 'utf8'));

import { preloadDefensesData } from '../../js/data/defenseTargetsData.js';
import { readFileSync as _rfs } from 'node:fs';
const _targetsDir2 = path.resolve(__dirname, '../../js/data/targets');
state.uiSettings = { language: 'en' };
globalThis.fetch = async (url) => {
    if (typeof url === 'string') {
        if (url.includes('/en.json')) return { ok: true, json: async () => enJson };
        if (url.includes('/de.json')) return { ok: true, json: async () => deJson };
        if (url.includes('/targets/')) {
            const file = url.split('/').pop();
            const data = JSON.parse(_rfs(path.resolve(_targetsDir2, file), 'utf8'));
            return { ok: true, json: async () => data };
        }
    }
    return { ok: false, status: 404 };
};
await Promise.all([preloadDefensesData(), loadTranslations('en')]);

test('Equipment Stat Popover Content Generation', async (t) => {
    await t.test('Giant Arrow returns relevant combat stats with 2x Air Defense multiplier', () => {
        const popover = getEquipmentStatsPopoverContent('giant_arrow', 18);
        assert.ok(popover, 'Popover content must be returned');
        assert.ok(popover.header.includes('Giant Arrow (Lvl 18)'));
        assert.ok(popover.header.includes('Archer Queen'));
        assert.ok(!popover.header.includes('Common'), 'Header must not include Common rarity');

        // Relevant stats
        assert.ok(popover.body.includes('1,500 HP'), 'Must include 1,500 HP base damage');
        assert.ok(popover.body.includes('Damage:</strong> 1,500 HP'));
        assert.ok(popover.body.includes('Favorite Target:</strong> Air Defense (2x · 3,000 HP)'), 'Must include 3,000 HP Air Defense damage');
        assert.ok(popover.body.includes('Damage Radius:</strong> 1.0 tiles'), 'Must include 1.0 tiles radius');
        assert.ok(!popover.body.includes('Trajectory:'), 'Must not include trajectory');
        assert.ok(!popover.body.includes('Damage Type:'), 'Must not include damage type');
    });

    await t.test('Fireball returns splash radius and damage without damage type', () => {
        const popover = getEquipmentStatsPopoverContent('fireball', 27);
        assert.ok(popover);
        assert.ok(popover.header.includes('Fireball (Lvl 27)'));
        assert.ok(popover.header.includes('Grand Warden'));
        assert.ok(!popover.header.includes('Epic'), 'Header must not include Epic rarity');

        assert.ok(popover.body.includes('4,100 HP'), 'Must include 4,100 HP damage');
        assert.ok(popover.body.includes('Damage:</strong> 4,100 HP'));
        assert.ok(popover.body.includes('Damage Radius:</strong> 6.0 tiles'), 'Must include 6.0 tiles radius');
        assert.ok(!popover.body.includes('Damage Type:'), 'Must not include damage type');
    });

    await t.test('Spiky Ball returns clean damage per hit and target count without total or favorite target', () => {
        const popover = getEquipmentStatsPopoverContent('spiky_ball', 27);
        assert.ok(popover);
        assert.ok(popover.header.includes('Spiky Ball (Lvl 27)'));
        assert.ok(popover.header.includes('Barbarian King'));
        assert.ok(!popover.header.includes('Epic'), 'Header must not include Epic rarity');

        assert.ok(popover.body.includes('3,250 HP'), 'Must include 3,250 HP per hit');
        assert.ok(popover.body.includes('Damage per Hit:</strong> 3,250 HP'));
        assert.ok(popover.body.includes('Number of Targets:</strong> 8'), 'Must include 8 targets at Lvl 27');
        assert.ok(!popover.body.includes('Total:'), 'Must not include total damage');
        assert.ok(!popover.body.includes('Favorite Target:'), 'Must not include favorite target');
    });

    await t.test('Seeking Shield returns chained target count and simplified defense favorite target without total', () => {
        const popover = getEquipmentStatsPopoverContent('seeking_shield', 18);
        assert.ok(popover);
        assert.ok(popover.header.includes('Seeking Shield (Lvl 18)'));
        assert.ok(popover.header.includes('Royal Champion'));
        assert.ok(!popover.header.includes('Common'), 'Header must not include Common rarity');

        assert.ok(popover.body.includes('2,500 HP'), 'Must include 2,500 HP per hit');
        assert.ok(popover.body.includes('Damage per Hit:</strong> 2,500 HP'));
        assert.ok(popover.body.includes('Number of Targets:</strong> 4'), 'Must include 4 targets');
        assert.ok(popover.body.includes('Favorite Target:</strong> Defenses'), 'Must include clean Defenses favorite target');
        assert.ok(!popover.body.includes('crafted'), 'Must not include regular & crafted in favorite target');
        assert.ok(!popover.body.includes('Total:'), 'Must not include total damage');
    });

    await t.test('Dragon Duke equipment maps hero name correctly and uses Damage label', () => {
        const flame = getEquipmentStatsPopoverContent('flame_blower', 18);
        assert.ok(flame);
        assert.ok(flame.header.includes('Dragon Duke'), 'Flame Blower must display Dragon Duke');
        assert.ok(flame.body.includes('Damage:</strong> 2,500 HP'), 'Flame Blower must display Damage');
        assert.ok(!flame.body.includes('Damage per Hit:'), 'Flame Blower must not display Damage per Hit');

        const rocket = getEquipmentStatsPopoverContent('rocket_backpack', 27);
        assert.ok(rocket);
        assert.ok(rocket.header.includes('Dragon Duke'), 'Rocket Backpack must display Dragon Duke');
        assert.ok(rocket.body.includes('Damage:</strong> 2,150 HP'), 'Rocket Backpack must display Damage');
        assert.ok(rocket.body.includes('4.0 tiles'));

        const flameAction = getActionInfoPopoverContent('flame_blower');
        assert.ok(flameAction);
        assert.ok(flameAction.header.includes('Dragon Duke'), 'Flame Blower action popover must display Dragon Duke');

        const rocketAction = getActionInfoPopoverContent('rocket_backpack');
        assert.ok(rocketAction);
        assert.ok(rocketAction.header.includes('Dragon Duke'), 'Rocket Backpack action popover must display Dragon Duke');
    });

    await t.test('Esports Mode reduces Common equipment by 3 levels and Epic by 6 levels', () => {
        const gaEsports = getEquipmentStatsPopoverContent('giant_arrow', 18, { leagueId: 'esports', rawLevel: 18 });
        assert.ok(gaEsports);
        assert.ok(gaEsports.header.includes('Giant Arrow (Lvl 15)'), 'Must show clean title with effective level');
        assert.ok(gaEsports.header.includes('Archer Queen'), 'Must show clean hero badge');
        assert.ok(!gaEsports.header.includes('Common'), 'Header must not include Common rarity');
        assert.ok(!gaEsports.body.includes('Level:'), 'Must omit redundant level bullet');
        assert.ok(gaEsports.body.includes('1,350 HP'), 'Must show reduced 1,350 HP damage');
        assert.ok(gaEsports.body.includes('Air Defense (2x · 2,700 HP)'), 'Must show reduced 2,700 HP Air Defense damage');

        const spikyEsports = getEquipmentStatsPopoverContent('spiky_ball', 27, { leagueId: 'esports', rawLevel: 27 });
        assert.ok(spikyEsports);
        assert.ok(spikyEsports.header.includes('Spiky Ball (Lvl 21)'), 'Must show clean title with effective level');
        assert.ok(spikyEsports.header.includes('Barbarian King'), 'Must show clean hero badge');
        assert.ok(!spikyEsports.header.includes('Epic'), 'Header must not include Epic rarity');
        assert.ok(!spikyEsports.header.includes('Esports'), 'Header must not redundantly mention Esports');
        assert.ok(!spikyEsports.body.includes('Level:'), 'Must omit redundant level bullet');
        assert.ok(spikyEsports.body.includes('2,750 HP'), 'Must show reduced 2,750 HP per hit');
        assert.ok(spikyEsports.body.includes('Number of Targets:</strong> 7'), 'Must show reduced 7 targets at Lvl 21');
    });

    await t.test('Unknown equipment returns null safely', () => {
        assert.strictEqual(getEquipmentStatsPopoverContent('unknown_sword', 1), null);
    });
});

test('Earthquake Stat Popover Content Generation', async (t) => {
    await t.test('Damage Sources Mode shows complete diminishing percentage series without housing space', () => {
        const popover = getEarthquakeStatsPopoverContent({ level: 8, count: 1, isCombo: false });
        assert.ok(popover);
        assert.ok(popover.header.includes('Earthquake (Lvl 8)'));
        assert.ok(popover.header.includes('Spell'));
        assert.ok(!popover.header.includes('1 Space'), 'Header must not include 1 Space');

        // Stats list
        assert.ok(popover.body.includes('Building Damage:</strong> 29.0%'));
        assert.ok(popover.body.includes('Troop Damage:</strong> 14.5%'), 'Must include troop damage at Lvl 8');
        assert.ok(popover.body.includes('Damage Radius:</strong> 4.7 tiles'));
        assert.ok(popover.body.includes('Walls:</strong> Breaks any level walls in 4 strikes'));
        assert.ok(popover.body.includes('Immunities:</strong> Storages'));
        assert.ok(!popover.body.includes('Housing Space:'), 'Must not include housing space');

        // Diminishing returns section
        assert.ok(popover.body.includes('Diminishing Damage by Strike'));
        assert.ok(popover.body.includes('Strike 1'));
        assert.ok(popover.body.includes('29.0%'));
        assert.ok(popover.body.includes('(29.0% total)'));

        assert.ok(popover.body.includes('Strike 2'));
        assert.ok(popover.body.includes('9.7%'));
        assert.ok(popover.body.includes('(38.7% total)'));

        assert.ok(popover.body.includes('Strike 3'));
        assert.ok(popover.body.includes('5.8%'));
        assert.ok(popover.body.includes('(44.5% total)'));

        assert.ok(popover.body.includes('Strike 4'));
        assert.ok(popover.body.includes('4.1%'));
        assert.ok(popover.body.includes('(48.6% total)'));

        assert.ok(popover.body.includes('Strike 5+'));
        assert.ok(popover.body.includes('3.2% each'));
    });

    await t.test('Clan Castle Earthquake in Damage Sources mode displays donated indicator without housing space', () => {
        const popover = getEarthquakeStatsPopoverContent({ level: 8, count: 1, isCombo: false, isCc: true });
        assert.ok(popover);
        assert.ok(popover.header.includes('Donated Earthquake (Lvl 8)'));
        assert.ok(popover.header.includes('Donated Spell'));
        assert.ok(!popover.header.includes('1 Space'), 'Must not include 1 Space');
        assert.ok(popover.body.includes('Diminishing Damage by Strike'));
    });

    await t.test('Combo Card Mode with 1x Earthquake omits ordered strike breakdown and housing space', () => {
        const popover = getEarthquakeStatsPopoverContent({ level: 8, count: 1, isCombo: true });
        assert.ok(popover);
        assert.ok(popover.header.includes('1x Earthquake'));
        assert.ok(popover.header.includes('Spell'));
        assert.ok(!popover.header.includes('1 Space'), 'Must not include 1 Space');

        // Only single strike stat
        assert.ok(popover.body.includes('Building Damage:</strong> 29.0%'));
        assert.ok(!popover.body.includes('Strike 1)'), 'Must not have Strike 1 qualifier for single strike');
        assert.ok(popover.body.includes('Damage Radius:</strong> 4.7 tiles'));

        // No breakdown list or total for single EQ
        assert.ok(!popover.body.includes('Ordered Strike Breakdown'));
        assert.ok(!popover.body.includes('calc-popover-diminishing-section'));
        assert.ok(!popover.body.includes('Housing Space:'));
    });

    await t.test('Combo Card Mode correctly orders diminishing percentages for 2x EQ combo without housing space', () => {
        const popover = getEarthquakeStatsPopoverContent({ level: 8, count: 2, isCombo: true });
        assert.ok(popover);
        assert.ok(popover.header.includes('2x Earthquake'));
        assert.ok(!popover.header.includes('1 Space'));

        assert.ok(popover.body.includes('Building Damage:</strong> 29.0% (Strike 1)'));

        // Ordered breakdown
        assert.ok(popover.body.includes('Ordered Strike Breakdown'));
        assert.ok(popover.body.includes('Earthquake #1'));
        assert.ok(popover.body.includes('29.0%'));

        assert.ok(popover.body.includes('Earthquake #2'));
        assert.ok(popover.body.includes('9.7%'));

        // Cumulative total
        assert.ok(popover.body.includes('calc-breakdown-row--total'));
        assert.ok(popover.body.includes('Total Damage'));
        assert.ok(popover.body.includes('38.7%'));
    });

    await t.test('Combo Card Mode correctly orders diminishing percentages for 3x EQ combo', () => {
        const popover = getEarthquakeStatsPopoverContent({ level: 8, count: 3, isCombo: true });
        assert.ok(popover);
        assert.ok(popover.header.includes('3x Earthquake'));

        assert.ok(popover.body.includes('Earthquake #1'));
        assert.ok(popover.body.includes('29.0%'));

        assert.ok(popover.body.includes('Earthquake #2'));
        assert.ok(popover.body.includes('9.7%'));

        assert.ok(popover.body.includes('Earthquake #3'));
        assert.ok(popover.body.includes('5.8%'));

        assert.ok(popover.body.includes('44.5%'));
    });

    await t.test('Combo Card Mode with troops scope displays only Troop Damage', () => {
        const popover1x = getEarthquakeStatsPopoverContent({ level: 8, count: 1, isCombo: true, targetScope: 'troops' });
        assert.ok(popover1x);
        assert.ok(popover1x.body.includes('Troop Damage:</strong> 14.5%'));
        assert.ok(!popover1x.body.includes('Building Damage'));

        const popover2x = getEarthquakeStatsPopoverContent({ level: 8, count: 2, isCombo: true, targetScope: 'troops' });
        assert.ok(popover2x);
        assert.ok(popover2x.body.includes('Troop Damage:</strong> 14.5% (Strike 1)'));
        assert.ok(!popover2x.body.includes('Building Damage'));
        assert.ok(popover2x.body.includes('Earthquake #1'));
        assert.ok(popover2x.body.includes('14.5%'));
        assert.ok(popover2x.body.includes('Earthquake #2'));
        assert.ok(popover2x.body.includes('4.8%'));
        assert.ok(popover2x.body.includes('19.3%'));
    });

    await t.test('Combo Card Mode with both scope displays both Building and Troop Damage', () => {
        const popoverBoth = getEarthquakeStatsPopoverContent({ level: 8, count: 2, isCombo: true, targetScope: 'both' });
        assert.ok(popoverBoth);
        assert.ok(popoverBoth.body.includes('Building Damage:</strong> 29.0% (Strike 1)'));
        assert.ok(popoverBoth.body.includes('Troop Damage:</strong> 14.5% (Strike 1)'));
        assert.ok(popoverBoth.body.includes('29.0%'));
        assert.ok(popoverBoth.body.includes('14.5%'));
        assert.ok(popoverBoth.body.includes('38.7%'));
        assert.ok(popoverBoth.body.includes('19.3%'));
    });
});

test('Lightning Stat Popover Content Generation', async (t) => {
    await t.test('Damage Sources Mode shows correct strike damage at level 13 without housing space', () => {
        const popover = getLightningStatsPopoverContent({ level: 13, count: 1, isCombo: false });
        assert.ok(popover);
        assert.ok(popover.header.includes('Lightning (Lvl 13)'));
        assert.ok(popover.header.includes('Spell'));
        assert.ok(!popover.header.includes('1 Space'), 'Header must not include 1 Space');

        assert.ok(popover.body.includes('Damage:</strong> 720 HP'));
        assert.ok(popover.body.includes('Damage Radius:</strong> 2.0 tiles'));
        assert.ok(popover.body.includes('Stun Effect:</strong> 0.1s'));
        assert.ok(popover.body.includes('Immunities:</strong> Town Hall, Clan Castle, Storages'));
        assert.ok(!popover.body.includes('Housing Space:'), 'Must not include housing space');
    });

    await t.test('Combo Card Mode with 1x Lightning adapts without "each", without total calc, and without housing space', () => {
        const popover = getLightningStatsPopoverContent({ level: 13, count: 1, isCombo: true });
        assert.ok(popover);
        assert.ok(popover.header.includes('1x Lightning'));
        assert.ok(!popover.header.includes('1 Space'));

        assert.ok(popover.body.includes('Damage:</strong> 720 HP'));
        assert.ok(!popover.body.includes('720 HP each'), 'Must not say "each" when only 1 lightning');
        assert.ok(popover.body.includes('Damage Radius:</strong> 2.0 tiles'));

        // No redundant total calc section for 1x
        assert.ok(!popover.body.includes('Damage Calculation'));
        assert.ok(!popover.body.includes('calc-popover-diminishing-section'));
        assert.ok(!popover.body.includes('1x Lightning &times; 720 HP'));
    });

    await t.test('Combo Card Mode correctly calculates total damage for 3x Lightning strictly in bottom section', () => {
        const popover = getLightningStatsPopoverContent({ level: 13, count: 3, isCombo: true });
        assert.ok(popover);
        assert.ok(popover.header.includes('3x Lightning'));

        // Top stat list shows each strike damage
        assert.ok(popover.body.includes('Damage:</strong> 720 HP each'));
        assert.ok(!popover.body.includes('Damage:</strong> 2160 HP'), 'Top bullet must NOT show total damage');

        // Bottom section displays mathematical formula and total
        assert.ok(popover.body.includes('Damage Calculation'));
        assert.ok(popover.body.includes('3x Lightning &times; 720 HP'));
        assert.ok(popover.body.includes('Total Damage'));
        assert.ok(popover.body.includes('2,160 HP'));
    });

    await t.test('Combo Card Mode with Donated CC Lightning calculates mixed damage strictly in bottom section', () => {
        // Personal level 10 (600 HP), Donated CC level 13 (720 HP)
        const popover = getLightningStatsPopoverContent({ level: 10, count: 3, isCombo: true, ccLevel: 13 });
        assert.ok(popover);
        assert.ok(popover.header.includes('Spell'));
        assert.ok(!popover.header.includes('Housing Space'));
        assert.ok(!popover.body.includes('Housing Space'));

        // Top info does not have total damage
        assert.ok(!popover.body.includes('Total Lightning Damage'));
        assert.ok(popover.body.includes('Damage:</strong> 600 HP each (CC: 720 HP)'));

        // Bottom section has calculation: 1x 720 (CC) + 2x 600 (personal) = 1920 HP
        assert.ok(popover.body.includes('Damage Calculation'));
        assert.ok(popover.body.includes('1x Donated Spell (Lvl 13)') || popover.body.includes('1x CC Strike (Lvl 13)'));
        assert.ok(popover.body.includes('720 HP'));
        assert.ok(popover.body.includes('2x Personal (600 each)') || popover.body.includes('2x Personal (600 ea)'));
        assert.ok(popover.body.includes('1,200 HP'));
        assert.ok(popover.body.includes('Total Damage'));
        assert.ok(popover.body.includes('1,920 HP'));
    });
});

test('Damage Source Dispatcher & Combo Badge Helper', async (t) => {
    const dummyState = {
        leagueId: 'standard',
        offense: {
            spells: { lightning: 13, earthquake: 8 },
            equipment: { giant_arrow: 18, fireball: 27 }
        }
    };

    await t.test('getDamageSourcePopoverContent resolves all sources', () => {
        const zap = getDamageSourcePopoverContent('lightning', 13, dummyState);
        assert.ok(zap);
        assert.ok(zap.header.includes('Lightning (Lvl 13)'));

        const ccZap = getDamageSourcePopoverContent('cc_lightning', 13, dummyState);
        assert.ok(ccZap);
        assert.ok(ccZap.header.includes('Donated Lightning'));

        const eq = getDamageSourcePopoverContent('earthquake', 8, dummyState);
        assert.ok(eq);
        assert.ok(eq.header.includes('Earthquake (Lvl 8)'));

        const ccEq = getDamageSourcePopoverContent('cc_earthquake', 8, dummyState);
        assert.ok(ccEq);
        assert.ok(ccEq.header.includes('Donated Earthquake'));

        const equip = getDamageSourcePopoverContent('giant_arrow', 18, dummyState);
        assert.ok(equip);
        assert.ok(equip.header.includes('Giant Arrow (Lvl 18)'));

        assert.strictEqual(getDamageSourcePopoverContent('invalid_key', 1, dummyState), null);
    });

    await t.test('getComboBadgePopoverContent resolves equipment badge', () => {
        const elem = {
            getAttribute(attr) {
                if (attr === 'data-equip-id') return 'giant_arrow';
                if (attr === 'data-equip-level') return '18';
                return null;
            }
        };
        const popover = getComboBadgePopoverContent(elem, 'equipment', dummyState);
        assert.ok(popover);
        assert.ok(popover.header.includes('Giant Arrow (Lvl 18)'));
        assert.ok(popover.body.includes('Damage:</strong> 1,500 HP'));
        assert.ok(popover.body.includes('Favorite Target:</strong> Air Defense (2x · 3,000 HP)'));
        assert.ok(!popover.body.includes('Hero:'), 'Combo badges must omit Hero name bullet');
        assert.ok(!popover.body.includes('Level:'), 'Combo badges must omit Level bullet');
    });

    await t.test('getComboBadgePopoverContent resolves earthquake badge', () => {
        const elem = {
            getAttribute(attr) {
                if (attr === 'data-eq-count') return '2';
                if (attr === 'data-eq-level') return '8';
                return null;
            }
        };
        const popover = getComboBadgePopoverContent(elem, 'earthquake', dummyState);
        assert.ok(popover);
        assert.ok(popover.header.includes('2x Earthquake'));
        assert.ok(popover.body.includes('Ordered Strike Breakdown'));
        assert.ok(popover.body.includes('38.7%'));
    });

    await t.test('getComboBadgePopoverContent resolves earthquake badge with troops target scope', () => {
        const elem = {
            getAttribute(attr) {
                if (attr === 'data-eq-count') return '2';
                if (attr === 'data-eq-level') return '8';
                if (attr === 'data-target-scope') return 'troops';
                return null;
            }
        };
        const popover = getComboBadgePopoverContent(elem, 'earthquake', dummyState);
        assert.ok(popover);
        assert.ok(popover.body.includes('Troop Damage:</strong> 14.5% (Strike 1)'));
        assert.ok(!popover.body.includes('Building Damage'));
        assert.ok(popover.body.includes('19.3%'));
    });

    await t.test('getComboBadgePopoverContent resolves lightning badge', () => {
        const elem = {
            getAttribute(attr) {
                if (attr === 'data-zap-count') return '4';
                if (attr === 'data-zap-level') return '13';
                return null;
            }
        };
        const popover = getComboBadgePopoverContent(elem, 'lightning', dummyState);
        assert.ok(popover);
        assert.ok(popover.header.includes('4x Lightning'));
        assert.ok(popover.body.includes('720 HP each'));
        assert.ok(popover.body.includes('2,880 HP'));
    });

    await t.test('getComboBadgePopoverContent resolves cc_earthquake badge', () => {
        const elem = {
            getAttribute(attr) {
                if (attr === 'data-eq-count') return '1';
                if (attr === 'data-cc-eq-level') return '8';
                return null;
            }
        };
        const popover = getComboBadgePopoverContent(elem, 'cc_earthquake', dummyState);
        assert.ok(popover);
        assert.ok(popover.header.includes('Donated Earthquake'));
        assert.ok(popover.header.includes('Donated Spell'));
    });

    await t.test('getComboBadgePopoverContent resolves cc_lightning badge', () => {
        const elem = {
            getAttribute(attr) {
                if (attr === 'data-zap-count') return '1';
                if (attr === 'data-cc-zap-level') return '13';
                return null;
            }
        };
        const popover = getComboBadgePopoverContent(elem, 'cc_lightning', dummyState);
        assert.ok(popover);
        assert.ok(popover.header.includes('Donated Lightning'));
        assert.ok(popover.header.includes('Donated Spell'));
    });

    await t.test('Combo Card Mode strips redundant bullets across all equipment types', () => {
        const mockElem = (id, lvl, raw) => ({
            getAttribute(attr) {
                if (attr === 'data-equip-id') return id;
                if (attr === 'data-equip-level') return String(lvl);
                if (attr === 'data-equip-raw-level') return String(raw || lvl);
                return null;
            }
        });

        const testKeys = ['giant_arrow', 'fireball', 'spiky_ball', 'seeking_shield', 'flame_blower', 'rocket_backpack'];
        for (const key of testKeys) {
            const popover = getComboBadgePopoverContent(mockElem(key, 18), 'equipment', dummyState);
            assert.ok(popover, `Popover for ${key} must exist`);
            assert.ok(!popover.body.includes('Hero:</strong>'), `${key} must not include Hero: in combo card mode`);
            assert.ok(!popover.body.includes('Level:</strong>'), `${key} must not include Level: in combo card mode`);
        }

        // Damage Source mode omits redundant Level and Hero
        const srcPopover = getDamageSourcePopoverContent('giant_arrow', 18, dummyState);
        assert.ok(srcPopover);
        assert.ok(!srcPopover.body.includes('Level:</strong>'), 'Damage source popover omits redundant Level');
        assert.ok(!srcPopover.body.includes('Hero:</strong>'), 'Damage source popover omits redundant Hero');

        // Action info popover in Simulator
        const actionPopover = getActionInfoPopoverContent('giant_arrow', dummyState);
        assert.ok(actionPopover);
        assert.ok(!actionPopover.body.includes('Level:</strong>'), 'Action popover omits redundant Level');
        assert.ok(!actionPopover.body.includes('Hero:</strong>'), 'Action popover omits redundant Hero');
    });

    await t.test('Esports Mode resolves effective levels for Damage Sources and Combo Badges', () => {
        const esportsState = {
            leagueId: 'esports',
            offense: {
                spells: { lightning: 13, earthquake: 8 },
                equipment: { giant_arrow: 18, fireball: 27 }
            }
        };

        const mockElem = {
            getAttribute(attr) {
                if (attr === 'data-equip-id') return 'fireball';
                if (attr === 'data-equip-level') return '21';
                if (attr === 'data-equip-raw-level') return '27';
                return null;
            }
        };

        const comboPopover = getComboBadgePopoverContent(mockElem, 'equipment', esportsState);
        assert.ok(comboPopover);
        assert.ok(comboPopover.header.includes('Fireball (Lvl 21)'));
        assert.ok(comboPopover.body.includes('3,650 HP'));

        const sourcePopover = getDamageSourcePopoverContent('fireball', 21, esportsState);
        assert.ok(sourcePopover);
        assert.ok(sourcePopover.header.includes('Fireball (Lvl 21)'));
        assert.ok(!sourcePopover.body.includes('Level:'));
        assert.ok(sourcePopover.body.includes('3,650 HP'));
    });

    await t.test('getComboBadgePopoverContent resolves remaining badge', () => {
        const elem = {
            getAttribute() { return null; }
        };
        const popover = getComboBadgePopoverContent(elem, 'remaining', dummyState);
        assert.ok(popover);
        assert.ok(popover.header.includes('Remaining Defenses'));
        assert.ok(popover.header.includes('Survived'));
        assert.ok(popover.body.includes('cannot be destroyed'));
    });
});

test('Battle Modifier & League Rules Popover', async (t) => {
    await t.test('getGenericInfoPopoverContent returns structured bullets for all competitive modes', () => {
        const popover = getGenericInfoPopoverContent('modifier');
        assert.ok(popover, 'Modifier popover must be defined');
        assert.ok(popover.header.includes('Battle Modifiers &amp; League Rules') || popover.header.includes('Battle Modifiers'), 'Header title must match');
        assert.ok(popover.header.includes('Modifiers'), 'Badge must match');

        // Body must use standard popover stat list
        assert.ok(popover.body.includes('<ul class="calc-popover-stat-list">'), 'Must use calc-popover-stat-list');

        assert.ok(popover.body.includes('Legend III (+10%):'), 'Legend III must be present');
        assert.ok(popover.body.includes('Def. DPS +10%'), 'Legend III Def. DPS');
        assert.ok(popover.body.includes('-5%'), 'Legend III -5% hero stats');

        assert.ok(popover.body.includes('Legend II (+15%):'), 'Legend II must be present');
        assert.ok(popover.body.includes('Def. DPS +15%'), 'Legend II Def. DPS');
        assert.ok(popover.body.includes('-10%'), 'Legend II -10% hero stats');

        assert.ok(popover.body.includes('Legend I (+20%):'), 'Legend I must be present');
        assert.ok(popover.body.includes('Def. DPS +20%'), 'Legend I Def. DPS');
        assert.ok(popover.body.includes('-20%'), 'Legend I -20% hero stats');

        assert.ok(popover.body.includes('Esports Mode:'), 'Esports Mode must be present');
        assert.ok(popover.body.includes('Common eq. -3 lvls'), 'Esports Common downgrade');
        assert.ok(popover.body.includes('Epic eq. -6 lvls'), 'Esports Epic downgrade');
    });

    await t.test('getGenericInfoPopoverContent returns supercharge popover explaining interactions', () => {
        const popover = getGenericInfoPopoverContent('supercharge');
        assert.ok(popover, 'Supercharge popover must be defined');
        assert.ok(popover.header.includes('Supercharge Overdrive'));
        assert.ok(popover.body.includes('which usually do not change any spell or equipment interactions.'));
        assert.ok(!popover.body.includes('raising required spell thresholds'));
    });

    await t.test('getGenericInfoPopoverContent returns CC spells popover explaining separate capacity and level setting', () => {
        const popover = getGenericInfoPopoverContent('cc_spells');
        assert.ok(popover, 'CC spells popover must be defined');
        assert.ok(popover.header.includes('Clan Castle Donated Spells') || popover.header.includes('Clan Castle Spells'));
        assert.ok(popover.header.includes('Donated Spell') || popover.header.includes('Donation'));
        assert.ok(popover.body.includes('separate capacity of up to 4 spell housing space'));
        assert.ok(popover.body.includes('differ from your own army spells'));
        assert.ok(popover.body.includes('Edit Levels'));
        assert.ok(!popover.body.includes('up to 3 slots'));
        assert.ok(!popover.body.includes('do not consume army camp spell space'));
    });

    await t.test('getGenericInfoPopoverContent returns cluster popover explaining Earthquake, Shared Lightning, and Equipment', () => {
        const popover = getGenericInfoPopoverContent('cluster');
        assert.ok(popover, 'Cluster popover must be defined');
        assert.ok(popover.header.includes('Clustered ZapQuake Mechanics'));
        assert.ok(popover.body.includes('Shared Earthquake'));
        assert.ok(popover.body.includes('4.7-tile radius'));
        assert.ok(popover.body.includes('Shared Lightning'));
        assert.ok(!popover.body.includes('Double-Zap'));
        assert.ok(popover.body.includes('2-tile radius'));
        assert.ok(popover.body.includes('Hero Equipment'));
        assert.ok(popover.body.includes('Fireball'));
        assert.ok(!popover.body.includes('Giant Arrow'));
        assert.ok(popover.body.includes('calc-popover-stat-list'));
    });

    await t.test('getActionInfoPopoverContent returns structured stats for builder repair and damage sources', () => {
        const repairAction = getActionInfoPopoverContent('builder_repair');
        assert.ok(repairAction);
        assert.ok(repairAction.header.includes('Builder Repair'));
        assert.ok(repairAction.body.includes('+71.25 HP per hit'));

        const fireballAction = getActionInfoPopoverContent('fireball');
        assert.ok(fireballAction);
        assert.ok(fireballAction.header.includes('Grand Warden'));
        assert.ok(fireballAction.body.includes('4,100 HP'));

        const esportsState = {
            leagueId: 'esports',
            offense: {
                equipment: { fireball: 27 },
                spells: { lightning: 13, earthquake: 8 }
            },
            simulator: { builderHutLevel: 5 }
        };
        const fireballEsports = getActionInfoPopoverContent('fireball', esportsState);
        assert.ok(fireballEsports);
        assert.ok(fireballEsports.header.includes('Fireball (Lvl 21)'));
        assert.ok(fireballEsports.header.includes('Grand Warden'));
        assert.ok(!fireballEsports.body.includes('Level:'));
        assert.ok(fireballEsports.body.includes('3,650 HP'));
        assert.ok(fireballEsports.body.includes('5.0 tiles'));

        const repairLvl5 = getActionInfoPopoverContent('builder_repair', esportsState);
        assert.ok(repairLvl5);
        assert.ok(repairLvl5.header.includes('level_5.png'));
        assert.ok(repairLvl5.body.includes('Builder Hut (Lvl 5)'));
        assert.ok(repairLvl5.body.includes('+60 HP per hit'));
    });

    await t.test('getNoteCodePopoverContent returns concise 200% damage note for Giant Arrow vs Air Defense', () => {
        const notePopover = getNoteCodePopoverContent('giant_arrow_air_defense_2x');
        assert.ok(notePopover);
        assert.ok(notePopover.header.includes('Giant Arrow (2x Damage)'));
        assert.ok(notePopover.body.includes('Giant Arrow deals 200% damage against all Air Defenses.'));
        assert.ok(!notePopover.body.includes('4,200'), 'Must not contain obsolete 4,200 damage text');
    });
});

test('Strict Zero-Emoji & Invariants Check', async (t) => {
    await t.test('Generated popover contents contain zero emojis or unicode dingbats', () => {
        const popovers = [
            getEquipmentStatsPopoverContent('giant_arrow', 18),
            getEquipmentStatsPopoverContent('fireball', 27),
            getEquipmentStatsPopoverContent('spiky_ball', 27),
            getEquipmentStatsPopoverContent('seeking_shield', 18),
            getEquipmentStatsPopoverContent('flame_blower', 18),
            getEquipmentStatsPopoverContent('rocket_backpack', 27),
            getEarthquakeStatsPopoverContent({ level: 8, count: 1, isCombo: false }),
            getEarthquakeStatsPopoverContent({ level: 8, count: 2, isCombo: true }),
            getLightningStatsPopoverContent({ level: 13, count: 1, isCombo: false }),
            getLightningStatsPopoverContent({ level: 13, count: 3, isCombo: true }),
            getGenericInfoPopoverContent('modifier'),
            getActionInfoPopoverContent('builder_repair'),
            getNoteCodePopoverContent('giant_arrow_air_defense_2x')
        ];

        // Strict emoji and unicode dingbat regex
        const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{2300}-\u{23FF}]/u;

        for (const popover of popovers) {
            assert.ok(popover, 'Popover must not be null');
            assert.ok(!emojiRegex.test(popover.header), `Popover header must not contain emojis: ${popover.header}`);
            assert.ok(!emojiRegex.test(popover.body), `Popover body must not contain emojis: ${popover.body}`);
        }
    });
});

test('Damage Calculator Offense Popovers Localization & HP Unit', async (t) => {
    await loadTranslations('de');

    await t.test('getHpUnit returns HP in English and TP in German', () => {
        state.uiSettings = { language: 'en' };
        assert.strictEqual(getHpUnit(), 'HP');

        state.uiSettings = { language: 'de' };
        assert.strictEqual(getHpUnit(), 'TP');
    });

    await t.test('Spell Popover Immunities and Combo Titles Localized Dynamically', () => {
        // 1. English immunities & titles
        state.uiSettings = { language: 'en' };
        const eqEn = getEarthquakeStatsPopoverContent({ level: 8, count: 1, isCombo: false });
        assert.ok(eqEn.body.includes('Storages'));
        const zapEn = getLightningStatsPopoverContent({ level: 13, count: 1, isCombo: false });
        assert.ok(zapEn.body.includes('Town Hall, Clan Castle, Storages'));

        // 2. German immunities
        state.uiSettings = { language: 'de' };
        const eqDe = getEarthquakeStatsPopoverContent({ level: 8, count: 1, isCombo: false });
        assert.ok(eqDe.body.includes('Lager'), 'Must compose Earthquake immunities from German building names');
        const zapDe = getLightningStatsPopoverContent({ level: 13, count: 1, isCombo: false });
        assert.ok(zapDe.body.includes('Rathaus, Clanburg, Lager'), 'Must compose Lightning immunities from German building names');

        // 3. German combo titles
        const eqComboDe = getEarthquakeStatsPopoverContent({ level: 8, count: 2, isCombo: true });
        assert.ok(eqComboDe.header.includes('2x Erdbeben'), 'Must localize Earthquake combo title in German');
        const zapComboDe = getLightningStatsPopoverContent({ level: 13, count: 3, isCombo: true });
        assert.ok(zapComboDe.header.includes('3x Blitz'), 'Must localize Lightning combo title in German');

        // Reset
        state.uiSettings = { language: 'en' };
    });
});
