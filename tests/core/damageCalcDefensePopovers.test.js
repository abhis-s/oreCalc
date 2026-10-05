/**
 * Feature Domain Tests for Damage Calculator Defense & Grid Popovers.
 * Validates combo breakdown popovers, cluster target breakdown, casualty details, and supercharge pips.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../../js/core/state.js';
import { loadTranslations } from '../../js/i18n/translator.js';
import {
    getComboBreakdownPopoverContent,
    getClusterTargetPopoverContent
} from '../../js/components/damage/damageCalcGridPopoversDisplay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));
const deJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/de.json'), 'utf8'));

state.uiSettings = { language: 'en' };
import { preloadDefensesData } from '../../js/data/defenseTargetsData.js';
import { readFileSync as _rfs } from 'node:fs';
const _targetsDir2 = path.resolve(__dirname, '../../js/data/targets');
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

test('Defense Popovers Supercharge Pips Replacing Tier Text', async (t) => {
    const dummyState = {
        leagueId: 'standard',
        offense: {
            spells: { lightning: 13, earthquake: 8 },
            equipment: { giant_arrow: 18 }
        },
        simulator: {
            steps: [{ id: 'giant_arrow', type: 'equipment' }],
            superchargeTier: 2
        }
    };

    await t.test('Combo defense breakdown popover shows supercharge bolts and removes Tier m text', () => {
        const mockWithSupercharge = {
            closest: (sel) => (sel.includes('data-combo-defense-info') || sel.includes('data-combo-row-index')) ? mockWithSupercharge : null,
            getAttribute: (attr) => {
                const map = {
                    'data-building-target': 'air_defense',
                    'data-building-level': '16',
                    'data-supercharge': '2',
                    'data-eq-count': '0',
                    'data-zap-count': '0',
                    'data-max-hp': '2000',
                    'data-equip': JSON.stringify([{ id: 'giant_arrow', level: 18, rawLevel: 18 }])
                };
                return map[attr] || null;
            }
        };

        const popover = getComboBreakdownPopoverContent(mockWithSupercharge, dummyState);
        assert.ok(popover);
        assert.ok(popover.header.includes('Air Defense (Lvl 16)'));
        assert.ok(popover.header.includes('calc-supercharge-pips'), 'Must render supercharge pips');
        assert.ok(popover.header.includes('/assets/supercharge/supercharge_bolt.png'), 'Must render charged bolt asset');
        assert.ok(!popover.header.includes(', Tier'), 'Must strictly NOT include ", Tier"');
        assert.ok(!popover.header.includes('Tier 2)'), 'Must strictly NOT include "Tier 2)" in title text');
        assert.ok(popover.header.includes('2,000 HP'), 'Must display HP in popover badge');
        assert.ok(!popover.header.includes('HP Base'), 'Must not display HP Base');
        assert.ok(!popover.header.includes('Hitpoints'), 'Must not display Hitpoints');

        const mockWithoutSupercharge = {
            closest: (sel) => (sel.includes('data-combo-defense-info') || sel.includes('data-combo-row-index')) ? mockWithoutSupercharge : null,
            getAttribute: (attr) => {
                const map = {
                    'data-building-target': 'air_defense',
                    'data-building-level': '16',
                    'data-supercharge': '0',
                    'data-eq-count': '0',
                    'data-zap-count': '0',
                    'data-max-hp': '2000',
                    'data-equip': JSON.stringify([{ id: 'giant_arrow', level: 18, rawLevel: 18 }])
                };
                return map[attr] || null;
            }
        };

        const popoverUncharged = getComboBreakdownPopoverContent(mockWithoutSupercharge, dummyState);
        assert.ok(popoverUncharged);
        assert.ok(popoverUncharged.header.includes('Air Defense (Lvl 16)</span>'));
        assert.ok(!popoverUncharged.header.includes('calc-supercharge-pips'), 'Must not render supercharge pips when tier is 0');

        const esportsComboState = {
            ...dummyState,
            leagueId: 'esports'
        };
        const popoverEsports = getComboBreakdownPopoverContent(mockWithSupercharge, esportsComboState);
        assert.ok(popoverEsports);
        assert.ok(popoverEsports.body.includes('Giant Arrow (Lvl 15)'), 'Must show clean effective level');
        assert.ok(!popoverEsports.body.includes('· -3'), 'Must strictly NOT include "· -3" in strike breakdown');
        assert.ok(!popoverEsports.body.includes('Esports'), 'Must strictly NOT include "Esports" in strike breakdown');
    });

    await t.test('Combo defense breakdown popover shows survival details for remaining defenses', () => {
        const mockRemainingImmune = {
            closest: (sel) => (sel.includes('data-combo-defense-info') || sel.includes('data-combo-row-index')) ? mockRemainingImmune : null,
            getAttribute: (attr) => {
                const map = {
                    'data-building-target': 'town_hall',
                    'data-building-level': '17',
                    'data-is-remaining': 'true',
                    'data-max-hp': '10500'
                };
                return map[attr] || null;
            }
        };

        const popoverImmune = getComboBreakdownPopoverContent(mockRemainingImmune, dummyState);
        assert.ok(popoverImmune);
        assert.ok(popoverImmune.header.includes('Town Hall'));
        assert.strictEqual(popoverImmune.body.includes('Survived'), false);
        assert.ok(popoverImmune.body.includes('Immune'));
        assert.ok(popoverImmune.body.includes('Remaining HP'));
        assert.ok(popoverImmune.body.includes('calc-breakdown-row--remaining'));
        assert.strictEqual(popoverImmune.body.includes('Deficit'), false);

        const mockRemainingCapacity = {
            closest: (sel) => (sel.includes('data-combo-defense-info') || sel.includes('data-combo-row-index')) ? mockRemainingCapacity : null,
            getAttribute: (attr) => {
                const map = {
                    'data-building-target': 'monolith',
                    'data-building-level': '3',
                    'data-is-remaining': 'true',
                    'data-max-hp': '5400'
                };
                return map[attr] || null;
            }
        };

        const popoverCapacity = getComboBreakdownPopoverContent(mockRemainingCapacity, dummyState);
        assert.ok(popoverCapacity);
        assert.ok(popoverCapacity.header.includes('Monolith'));
        assert.strictEqual(popoverCapacity.body.includes('Survived'), false);
        assert.ok(popoverCapacity.body.includes('Remaining HP'));
        assert.ok(popoverCapacity.body.includes('calc-breakdown-row--remaining'));
        assert.strictEqual(popoverCapacity.body.includes('Deficit'), false);
    });

    await t.test('Remaining defense popovers conditionally display immunities based on enabled spells', () => {
        /**
         * @param {{ lightning: boolean, earthquake: boolean }} enabledSpells
         */
        const createImmuneCard = (enabledSpells) => {
            const cardObj = {
                closest: (sel) => (sel.includes('data-combo-defense-info') || sel.includes('data-combo-row-index')) ? cardObj : null,
                getAttribute: (attr) => {
                    const map = {
                        'data-building-target': 'town_hall',
                        'data-building-level': '17',
                        'data-is-remaining': 'true',
                        'data-max-hp': '10500',
                        'data-enabled-spells': JSON.stringify(enabledSpells)
                    };
                    return map[attr] || null;
                }
            };
            return cardObj;
        };

        // 1. Both enabled -> shows both
        const popBoth = getComboBreakdownPopoverContent(createImmuneCard({ lightning: true, earthquake: true }), dummyState);
        assert.ok(popBoth.body.includes('Lightning'));
        assert.ok(popBoth.body.includes('Earthquake'));

        // 2. Only lightning enabled -> shows only lightning
        const popZapOnly = getComboBreakdownPopoverContent(createImmuneCard({ lightning: true, earthquake: false }), dummyState);
        assert.ok(popZapOnly.body.includes('Lightning'));
        assert.strictEqual(popZapOnly.body.includes('Earthquake'), false);

        // 3. Only eq enabled -> shows only earthquake
        const popEqOnly = getComboBreakdownPopoverContent(createImmuneCard({ lightning: false, earthquake: true }), dummyState);
        assert.ok(popEqOnly.body.includes('Earthquake'));
        assert.strictEqual(popEqOnly.body.includes('Lightning'), false);

        // 4. Neither enabled -> shows neither
        const popNone = getComboBreakdownPopoverContent(createImmuneCard({ lightning: false, earthquake: false }), dummyState);
        assert.strictEqual(popNone.body.includes('Earthquake'), false);
        assert.strictEqual(popNone.body.includes('Lightning'), false);
        assert.strictEqual(popNone.body.includes('Immune'), false);
        assert.ok(popNone.body.includes('Remaining HP'));
        assert.strictEqual(popNone.body.includes('Deficit'), false);
        assert.strictEqual(popNone.body.includes('Survived'), false);
    });

    await t.test('Cluster target popover shows supercharge bolts and removes Tier m text', () => {
        const mockClusterTarget = {
            closest: (sel) => sel.includes('data-cluster-target-info') ? mockClusterTarget : null,
            getAttribute: (attr) => {
                const map = {
                    'data-building-key': 'air_defense',
                    'data-building-level': '16',
                    'data-supercharge': '2',
                    'data-max-hp': '2000',
                    'data-eq-dmg': '580',
                    'data-rem-hp': '1420',
                    'data-zap-count': '2',
                    'data-shared-eq': '1'
                };
                return map[attr] || null;
            }
        };

        const popover = getClusterTargetPopoverContent(mockClusterTarget);
        assert.ok(popover);
        assert.ok(popover.header.includes('Air Defense (Lvl 16)'));
        assert.ok(popover.header.includes('calc-supercharge-pips'), 'Must render supercharge pips');
        assert.ok(popover.header.includes('/assets/supercharge/supercharge_bolt.png'), 'Must render charged bolt asset');
        assert.ok(!popover.header.includes(', Tier'), 'Must strictly NOT include ", Tier"');
        assert.ok(!popover.header.includes('Tier 2)'), 'Must strictly NOT include "Tier 2)" in title text');
    });
});

test('Defense Popovers Localization & HP Unit (German TP vs English HP)', async (t) => {
    await loadTranslations('de');

    await t.test('Combo breakdown popover renders localized names and TP in German without English leaks', () => {
        state.uiSettings = { language: 'de' };

        const mockCard = {
            closest: () => mockCard,
            dataset: {
                buildingKey: 'air_defense',
                buildingLevel: '16',
                supercharge: '0',
                eqCount: '0',
                zapCount: '0',
                maxHp: '2000',
                equip: JSON.stringify([{ id: 'giant_arrow', rawLevel: 18 }])
            },
            getAttribute: (attr) => mockCard.dataset[attr.replace(/^data-/, '').replace(/-([a-z])/g, (_, l) => l.toUpperCase())]
        };

        const mockState = {
            offense: {
                spells: { lightning: 13, earthquake: 8 },
                equipment: { giant_arrow: 18 }
            },
            leagueId: 'standard'
        };

        const popover = getComboBreakdownPopoverContent(mockCard, mockState);
        assert.ok(popover, 'Popover must be returned');

        // Header
        assert.ok(popover.header.includes('Luftabwehr'), 'Must localize Air Defense as Luftabwehr');
        assert.ok(popover.header.includes('2.000 TP'), 'Must render 2.000 TP in German');
        assert.ok(!popover.header.includes('2.000 HP'), 'Must not render 2.000 HP in German');

        // Body rows
        assert.ok(popover.body.includes('Riesenpfeil'), 'Must localize Giant Arrow in German');
        assert.ok(popover.body.includes('2x Luftabwehr'), 'Must localize 2x Air Defense as 2x Luftabwehr');
        assert.ok(popover.body.includes('-3.000 TP'), 'Must render -3.000 TP raw equipment damage');
        assert.ok(!popover.body.includes('Gesamtschaden'), 'Must not render Total Damage (Gesamtschaden)');
        assert.ok(popover.body.includes('Überschuss'), 'Must render localized Overkill (Überschuss) label');
        assert.ok(popover.body.includes('+1.000 TP'), 'Must render overkill +1.000 TP');
        assert.ok(!popover.body.includes(' HP'), 'Must strictly contain zero raw HP in German body');

        // Reset to English
        state.uiSettings = { language: 'en' };
    });

    await t.test('Cluster target popover renders localized labels and TP in German', () => {
        state.uiSettings = { language: 'de' };

        const mockCluster = {
            closest: (sel) => sel.includes('data-cluster-target-info') ? mockCluster : null,
            getAttribute: (attr) => {
                const map = {
                    'data-building-key': 'inferno_tower',
                    'data-building-level': '10',
                    'data-supercharge': '0',
                    'data-max-hp': '4200',
                    'data-eq-dmg': '1218',
                    'data-rem-hp': '2982',
                    'data-zap-count': '5',
                    'data-shared-eq': '1'
                };
                return map[attr] || null;
            }
        };

        try {
            const popover = getClusterTargetPopoverContent(mockCluster);
            assert.ok(popover);
            assert.ok(popover.header.includes('Infernoturm'), 'Must localize Inferno Tower to Infernoturm');
            assert.ok(popover.header.includes('4.200 TP'), 'Must render 4.200 TP in German header badge');
            assert.ok(!popover.header.includes('Cluster-Ziel'), 'Must NOT contain Cluster-Ziel badge');
            assert.ok(popover.body.includes('Geteilter Erdbebenzauber') || popover.body.includes('Erdbeben'), 'Must localize shared earthquake');
            assert.ok(!popover.body.includes('Nach Erdbeben'), 'Must not contain intermediate Nach Erdbeben');
            assert.ok(popover.body.includes('Benötigte Blitze') || popover.body.includes('Blitzzauber') || popover.body.includes('Blitz'), 'Must localize required zaps');
            assert.ok(popover.body.includes('TP'), 'Must use TP unit in German');
            assert.ok(!popover.body.includes(' HP'), 'Must strictly not leak English HP unit');
        } finally {
            // Reset
            state.uiSettings = { language: 'en' };
        }
    });
});

test('Clan Castle Spell Levels in Combo Defense Breakdown Popover', async (t) => {
    const testState = {
        leagueId: 'standard',
        offense: {
            spells: { lightning: 13, earthquake: 8 },
            ccSpells: { lightning: 5, earthquake: 8 },
            equipment: { fireball: 27 },
            enabledSources: { lightning: false, cc_lightning: true, fireball: true }
        }
    };

    await t.test('Defense breakdown popover uses CC spell level and damage for donated strikes', () => {
        const mockXBowCard = {
            closest: (sel) => (sel.includes('data-combo-defense-info') || sel.includes('data-combo-row-index')) ? mockXBowCard : null,
            getAttribute: (attr) => {
                const map = {
                    'data-building-target': 'x_bow',
                    'data-building-level': '13',
                    'data-supercharge': '2',
                    'data-eq-count': '0',
                    'data-zap-count': '4',
                    'data-reg-zap': '0',
                    'data-cc-zap': '4',
                    'data-zap-level': '13',
                    'data-cc-zap-level': '5',
                    'data-max-hp': '5100',
                    'data-equip': JSON.stringify([{ id: 'fireball', level: 27, rawLevel: 27 }])
                };
                return map[attr] || null;
            }
        };

        const popover = getComboBreakdownPopoverContent(mockXBowCard, testState);
        assert.ok(popover, 'Popover must be returned');
        assert.ok(popover.header.includes('X-Bow (Lvl 13)'));
        assert.ok(popover.header.includes('5,100 HP'));

        // Fireball row
        assert.ok(popover.body.includes('Fireball (Lvl 27)'));
        assert.ok(popover.body.includes('-4,100 HP'));

        // 4x CC Lightning row (270 each = 1080 total)
        assert.ok(popover.body.includes('4x Lightning (CC) (270 each)'));
        assert.ok(popover.body.includes('-1,080 HP'));

        // Totals and Overkill
        assert.ok(!popover.body.includes('Total Damage'), 'Must strictly NOT render Total Damage row');
        assert.ok(!popover.body.includes('calc-breakdown-row--total'), 'Must strictly NOT include total row class');
        assert.ok(popover.body.includes('+80 HP'), 'Overkill must equal 5180 - 5100 = +80 HP');
        assert.ok(popover.body.includes('Overkill'), 'Must render Overkill label');

        // Negative assertions: strictly no regular lightning leakage
        assert.ok(!popover.body.includes('720 each'), 'Must strictly NOT evaluate CC lightning using regular 720 HP');
        assert.ok(!popover.body.includes('6,980 HP'), 'Must strictly NOT display erroneous 6980 HP total');
        assert.ok(!popover.body.includes('+1,880 HP'), 'Must strictly NOT display erroneous +1880 HP overkill');
    });

    await t.test('Defense breakdown popover separates regular and donated CC lightning rows', () => {
        const mockMixedCard = {
            closest: (sel) => (sel.includes('data-combo-defense-info') || sel.includes('data-combo-row-index')) ? mockMixedCard : null,
            getAttribute: (attr) => {
                const map = {
                    'data-building-target': 'inferno_tower',
                    'data-building-level': '10',
                    'data-eq-count': '0',
                    'data-zap-count': '3',
                    'data-reg-zap': '2',
                    'data-cc-zap': '1',
                    'data-zap-level': '13',
                    'data-cc-zap-level': '5',
                    'data-max-hp': '4200',
                    'data-equip': JSON.stringify([])
                };
                return map[attr] || null;
            }
        };

        const popover = getComboBreakdownPopoverContent(mockMixedCard, testState);
        assert.ok(popover);
        assert.ok(popover.body.includes('2x Lightning (720 each)'));
        assert.ok(popover.body.includes('-1,440 HP'));
        assert.ok(popover.body.includes('1x Lightning (CC) (270 each)'));
        assert.ok(popover.body.includes('-270 HP'));
        assert.ok(!popover.body.includes('Total Damage'), 'Must not render Total Damage');
        assert.ok(popover.body.includes('2,490 HP'), 'Remaining HP: 4200 - 1710 = 2490 HP');
    });

    await t.test('Defense breakdown popover correctly sequences and labels mixed earthquake strikes', () => {
        const mockMixedEqCard = {
            closest: (sel) => (sel.includes('data-combo-defense-info') || sel.includes('data-combo-row-index')) ? mockMixedEqCard : null,
            getAttribute: (attr) => {
                const map = {
                    'data-building-target': 'eagle_artillery',
                    'data-building-level': '7',
                    'data-eq-count': '2',
                    'data-reg-eq': '1',
                    'data-cc-eq': '1',
                    'data-eq-level': '4',
                    'data-cc-eq-level': '8',
                    'data-zap-count': '0',
                    'data-max-hp': '6000',
                    'data-equip': JSON.stringify([])
                };
                return map[attr] || null;
            }
        };

        const popover = getComboBreakdownPopoverContent(mockMixedEqCard, testState);
        assert.ok(popover);
        // CC EQ level 8 (29%) > Regular EQ level 6 (25%), so CC strikes first
        assert.ok(popover.body.includes('Earthquake #1 (CC) (29.0%)'));
        assert.ok(popover.body.includes('Earthquake #2 (8.3%)'));
    });

    await t.test('Defense breakdown popover resolves correctly from inner info button or card', () => {
        const mockParentCard = {
            dataset: {
                buildingKey: 'super_wizard_tower',
                buildingLevel: '2',
                supercharge: '2',
                maxHp: '6450',
                eqCount: '0',
                zapCount: '0',
                equip: JSON.stringify([{ id: 'spiky_ball', level: 27, rawLevel: 27 }])
            },
            getAttribute: (attr) => {
                const clean = attr.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
                return mockParentCard.dataset[clean] || null;
            }
        };
        const mockInnerBtn = {
            closest: (sel) => {
                if (sel.includes('calc-combo-defense-card')) return mockParentCard;
                return null;
            }
        };

        const popover = getComboBreakdownPopoverContent(mockInnerBtn, testState);
        assert.ok(popover, 'Must resolve popover content when called with inner info button');
        assert.ok(popover.header.includes('Super Wizard Tower'));
        assert.ok(popover.body.includes('Spiky Ball'));
    });

    await t.test('Cluster target popover resolves correctly from inner info button inside cluster card', () => {
        const mockClusterCard = {
            dataset: {
                buildingKey: 'air_defense',
                buildingLevel: '14',
                supercharge: '0',
                maxHp: '1750',
                eqDmg: '500',
                remHp: '1250',
                zapCount: '3',
                sharedEq: '1'
            },
            getAttribute: (attr) => {
                const clean = attr.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
                return mockClusterCard.dataset[clean] || null;
            }
        };
        const mockClusterBtn = {
            closest: (sel) => {
                if (sel.includes('cluster-target-card')) return mockClusterCard;
                return null;
            }
        };

        const popover = getClusterTargetPopoverContent(mockClusterBtn);
        assert.ok(popover, 'Must resolve cluster target popover when called with inner info button');
        assert.ok(popover.header.includes('Air Defense'));
        assert.ok(popover.header.includes('1,750 HP'));
    });
});
