import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
    STORAGE_LIMITS,
    STORAGE_STEPS,
    MEDAL_STEPS,
    CUSTOM_CHIP_LIMITS,
    CALENDAR_SETTINGS_DEFAULTS,
    STAR_BONUS_2X_DEFAULTS,
    STORAGE_KEYS,
    MAX_SAVED_PLAYERS,
    UNRANKED_LEAGUE_ID,
    LEGENDS_LEAGUE_ID,
    FREE_WEEKLY_GLOWY
} from '../../js/core/constants.js';

import { CLAN_WAR_DEFAULTS, calculateClanWarIncome } from '../../js/domain/income/clanWarIncome.js';
import { CWL_DEFAULTS, calculateCwlIncome } from '../../js/domain/income/cwlIncome.js';
import { WAR_ORE_MAX_LIMITS, warOreTownHallValues, getWarOreValue } from '../../js/data/incomeSources/warOres.js';
import { raidMedalTraderData, gemTraderData, eventTraderData } from '../../js/data/incomeSources/traders.js';
import { shopOfferData } from '../../js/data/incomeSources/shopOffers.js';
import { eventPassData } from '../../js/data/incomeSources/eventPass.js';
import { starBonusData, townHallLeagueFloors } from '../../js/data/incomeSources/starBonus.js';
import { supercellEventsData } from '../../js/data/incomeSources/supercellEvents.js';
import { conversionRates, oreMaxValues, storageCapacities } from '../../js/data/oreConversionData.js';
import { EQUIPMENT_MAX_LEVELS, getEquipmentMaxLevel } from '../../js/data/equipmentCommonData.js';
import { heroData } from '../../js/data/heroData.js';
import { leagueTiers } from '../../js/data/leagueTiers.js';
import { currencyData, priceTierRegistry } from '../../js/data/pricingData.js';
import { incomeData, getSourceById } from '../../js/data/incomeSourceRegistry.js';
import { DEFAULT_CUSTOM_CHIP_SETTINGS } from '../../js/core/state.js';

const projectRoot = process.cwd();

function extractInputAttributes(htmlContent) {
    const inputRegex = /<input\b([^>]*)>/gi;
    const inputs = [];
    let match;
    while ((match = inputRegex.exec(htmlContent)) !== null) {
        const attrStr = match[1];
        const attrRegex = /([a-zA-Z0-9_-]+)(?:=["']([^"']*)["'])?/g;
        const attrs = {};
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
            attrs[attrMatch[1]] = attrMatch[2] !== undefined ? attrMatch[2] : true;
        }
        inputs.push(attrs);
    }
    return inputs;
}

describe('Single Source of Truth Integrity Test Suite', () => {

    describe('1. Core Application Limits & Constants (constants.js)', () => {
        test('STORAGE_LIMITS is strictly frozen and defines canonical ore capacities', () => {
            assert.ok(Object.isFrozen(STORAGE_LIMITS));
            assert.equal(STORAGE_LIMITS.shiny, 50000);
            assert.equal(STORAGE_LIMITS.glowy, 5000);
            assert.equal(STORAGE_LIMITS.starry, 1000);
        });

        test('STORAGE_STEPS is strictly frozen and defines input steppers', () => {
            assert.ok(Object.isFrozen(STORAGE_STEPS));
            assert.equal(STORAGE_STEPS.shiny, 100);
            assert.equal(STORAGE_STEPS.glowy, 10);
            assert.equal(STORAGE_STEPS.starry, 1);
        });

        test('MEDAL_STEPS is strictly frozen and defines input steppers', () => {
            assert.ok(Object.isFrozen(MEDAL_STEPS));
            assert.equal(MEDAL_STEPS.raidMedals, 50);
            assert.equal(MEDAL_STEPS.bonusTrackMedals, 40);
            assert.equal(MEDAL_STEPS.purchasedMedals, 50);
        });

        test('CUSTOM_CHIP_LIMITS is strictly frozen and defines max and maxlength bounds', () => {
            assert.ok(Object.isFrozen(CUSTOM_CHIP_LIMITS));
            assert.deepEqual(CUSTOM_CHIP_LIMITS.shiny, { max: 25000, maxlength: 5 });
            assert.deepEqual(CUSTOM_CHIP_LIMITS.glowy, { max: 2500, maxlength: 4 });
            assert.deepEqual(CUSTOM_CHIP_LIMITS.starry, { max: 500, maxlength: 3 });
        });

        test('CALENDAR_SETTINGS_DEFAULTS is strictly frozen and defines valid planner defaults', () => {
            assert.ok(Object.isFrozen(CALENDAR_SETTINGS_DEFAULTS));
            assert.equal(CALENDAR_SETTINGS_DEFAULTS.firstDayOfWeek, 'auto');
            assert.equal(CALENDAR_SETTINGS_DEFAULTS.autoPlaceScope, 'month');
            assert.equal(CALENDAR_SETTINGS_DEFAULTS.showChipIcons, true);
            assert.equal(CALENDAR_SETTINGS_DEFAULTS.showEquipmentMilestones, true);
            assert.equal(CALENDAR_SETTINGS_DEFAULTS.highlightUpgradeRanges, true);
        });

        test('STAR_BONUS_2X_DEFAULTS is strictly frozen and defines multiplier bounds', () => {
            assert.ok(Object.isFrozen(STAR_BONUS_2X_DEFAULTS));
            assert.equal(STAR_BONUS_2X_DEFAULTS.frequency, 2);
            assert.equal(STAR_BONUS_2X_DEFAULTS.duration, 5);
            assert.equal(STAR_BONUS_2X_DEFAULTS.minFrequency, 1);
            assert.equal(STAR_BONUS_2X_DEFAULTS.maxFrequency, 4);
            assert.equal(STAR_BONUS_2X_DEFAULTS.minDuration, 0);
            assert.equal(STAR_BONUS_2X_DEFAULTS.maxDuration, 7);
        });

        test('STORAGE_KEYS is strictly frozen and defines canonical localStorage namespaces', () => {
            assert.ok(Object.isFrozen(STORAGE_KEYS));
            assert.equal(STORAGE_KEYS.STATE, 'oreCalculatorState');
            assert.equal(STORAGE_KEYS.APP_VERSION, 'oreCalc_appVersion');
            assert.equal(STORAGE_KEYS.USER_ID, 'oreCalc_userId');
            assert.equal(STORAGE_KEYS.PLAYER_PREFIX, 'oreCalc_player_');
            assert.equal(STORAGE_KEYS.SETTINGS, undefined);
            assert.equal(STORAGE_KEYS.SAVED_TAGS, undefined);
            assert.equal(Object.keys(STORAGE_KEYS).length, 4);
        });

        test('DEFAULT_CUSTOM_CHIP_SETTINGS is strictly frozen and defines canonical defaults for all chip types', () => {
            assert.ok(Object.isFrozen(DEFAULT_CUSTOM_CHIP_SETTINGS));
            assert.ok(DEFAULT_CUSTOM_CHIP_SETTINGS.custom !== undefined);
            assert.ok(DEFAULT_CUSTOM_CHIP_SETTINGS.starBonus !== undefined);
            assert.ok(DEFAULT_CUSTOM_CHIP_SETTINGS.clanWar !== undefined);
            assert.ok(DEFAULT_CUSTOM_CHIP_SETTINGS.prospector !== undefined);
        });

        test('Primitive constants have expected invariant values', () => {
            assert.equal(MAX_SAVED_PLAYERS, 12);
            assert.equal(UNRANKED_LEAGUE_ID, 105000000);
            assert.equal(LEGENDS_LEAGUE_ID, 105000036);
            assert.equal(FREE_WEEKLY_GLOWY, 10);
        });
    });

    describe('2. Domain Calculation Defaults & War Ore Bounds', () => {
        test('CLAN_WAR_DEFAULTS is frozen and provides correct domain bounds', () => {
            assert.ok(Object.isFrozen(CLAN_WAR_DEFAULTS));
            assert.equal(CLAN_WAR_DEFAULTS.WARS_PER_MONTH, 8);
            assert.equal(CLAN_WAR_DEFAULTS.MIN_WARS, 0);
            assert.equal(CLAN_WAR_DEFAULTS.MAX_WARS, 15);
            assert.equal(CLAN_WAR_DEFAULTS.WIN_RATE, 50);
            assert.equal(CLAN_WAR_DEFAULTS.DRAW_RATE, 0);
            assert.equal(CLAN_WAR_DEFAULTS.ATTACKS_PER_EVENT, 2);

            const emptyIncome = calculateClanWarIncome();
            assert.equal(emptyIncome.monthly.shiny, 0);
            assert.equal(emptyIncome.monthly.glowy, 0);
            assert.equal(emptyIncome.monthly.starry, 0);
        });

        test('CWL_DEFAULTS is frozen and provides correct domain bounds', () => {
            assert.ok(Object.isFrozen(CWL_DEFAULTS));
            assert.equal(CWL_DEFAULTS.HITS_PER_SEASON, 7);
            assert.equal(CWL_DEFAULTS.MIN_HITS, 0);
            assert.equal(CWL_DEFAULTS.MAX_HITS, 7);
            assert.equal(CWL_DEFAULTS.WIN_RATE, 50);
            assert.equal(CWL_DEFAULTS.DRAW_RATE, 0);
            assert.equal(CWL_DEFAULTS.ATTACKS_PER_EVENT, 1);

            const emptyIncome = calculateCwlIncome();
            assert.equal(emptyIncome.monthly.shiny, 0);
            assert.equal(emptyIncome.monthly.glowy, 0);
            assert.equal(emptyIncome.monthly.starry, 0);
        });

        test('WAR_ORE_MAX_LIMITS is frozen and matches maximum Town Hall 16 war rewards', () => {
            assert.ok(Object.isFrozen(WAR_ORE_MAX_LIMITS));
            assert.equal(WAR_ORE_MAX_LIMITS.shiny, 1110);
            assert.equal(WAR_ORE_MAX_LIMITS.glowy, 39);
            assert.equal(WAR_ORE_MAX_LIMITS.starry, 6);

            assert.equal(getWarOreValue('shiny', 16), WAR_ORE_MAX_LIMITS.shiny);
            assert.equal(getWarOreValue('glowy', 16), WAR_ORE_MAX_LIMITS.glowy);
            assert.equal(getWarOreValue('starry', 16), WAR_ORE_MAX_LIMITS.starry);
        });

        test('getWarOreValue correctly clamps across boundary Town Halls', () => {
            assert.equal(getWarOreValue('shiny', 1), 380);
            assert.equal(getWarOreValue('glowy', 5), 15);
            assert.equal(getWarOreValue('starry', 7), 0);

            assert.equal(getWarOreValue('shiny', 18), 1110);
            assert.equal(getWarOreValue('glowy', 20), 39);
            assert.equal(getWarOreValue('starry', 99), 6);
        });
    });

    describe('3. Trader Datasets & Offer IDs Normalization (traders.js)', () => {
        test('All 9 normalized trader IDs exist and are mutually unique', () => {
            const raidIds = raidMedalTraderData.map(o => o.id);
            const gemIds = gemTraderData.map(o => o.id);
            const eventIds = eventTraderData.map(o => o.id);

            assert.deepEqual(raidIds, ['raid_starry', 'raid_glowy', 'raid_shiny']);
            assert.deepEqual(gemIds, ['gem_starry', 'gem_glowy', 'gem_shiny']);
            assert.deepEqual(eventIds, ['event_starry', 'event_glowy', 'event_shiny']);

            const allIds = [...raidIds, ...gemIds, ...eventIds];
            assert.equal(new Set(allIds).size, 9);
        });

        test('Raid Medal Trader data maintains correct currencies and pack caps', () => {
            assert.equal(raidMedalTraderData.length, 3);
            for (const offer of raidMedalTraderData) {
                assert.equal(offer.currency, 'raid_medals');
                assert.equal(offer.maxPacks, 2);
                assert.ok(offer.cost > 0);
            }
        });

        test('Gem Trader data maintains correct currencies and pack caps', () => {
            assert.equal(gemTraderData.length, 3);
            for (const offer of gemTraderData) {
                assert.equal(offer.currency, 'gems');
                assert.equal(offer.maxPacks, 10);
                assert.ok(offer.cost > 0);
            }
            const starry = gemTraderData.find(o => o.id === 'gem_starry');
            const glowy = gemTraderData.find(o => o.id === 'gem_glowy');
            const shiny = gemTraderData.find(o => o.id === 'gem_shiny');
            assert.equal(starry.cost, 115);
            assert.equal(glowy.cost, 90);
            assert.equal(shiny.cost, 75);
        });

        test('Event Trader data maintains correct currencies and pack caps', () => {
            assert.equal(eventTraderData.length, 3);
            for (const offer of eventTraderData) {
                assert.equal(offer.currency, 'event_medals');
                assert.ok(offer.maxPacks > 0);
                assert.ok(offer.cost > 0);
            }
            const starry = eventTraderData.find(o => o.id === 'event_starry');
            const glowy = eventTraderData.find(o => o.id === 'event_glowy');
            const shiny = eventTraderData.find(o => o.id === 'event_shiny');
            assert.equal(starry.maxPacks, 8);
            assert.equal(glowy.maxPacks, 10);
            assert.equal(shiny.maxPacks, 40);
        });
    });

    describe('4. Prospector & Ore Conversion Alignment (oreConversionData.js)', () => {
        test('conversionRates and oreMaxValues are strictly frozen with correct ratios', () => {
            assert.ok(Object.isFrozen(conversionRates));
            assert.ok(Object.isFrozen(oreMaxValues));
            assert.deepEqual(conversionRates, { shiny: 2000, glowy: 120, starry: 2 });
            assert.deepEqual(oreMaxValues, { shiny: 2000, glowy: 120, starry: 2 });
        });

        test('storageCapacities is directly identical to STORAGE_LIMITS (SSOT reference)', () => {
            assert.strictEqual(storageCapacities, STORAGE_LIMITS);
            assert.deepEqual(storageCapacities, { shiny: 50000, glowy: 5000, starry: 1000 });
        });
    });

    describe('5. Equipment Level Caps & Definitions (equipmentCommonData.js)', () => {
        test('EQUIPMENT_MAX_LEVELS is strictly frozen and getEquipmentMaxLevel resolves accurately', () => {
            assert.ok(Object.isFrozen(EQUIPMENT_MAX_LEVELS));
            assert.equal(EQUIPMENT_MAX_LEVELS.common, 18);
            assert.equal(EQUIPMENT_MAX_LEVELS.epic, 27);

            assert.equal(getEquipmentMaxLevel('common'), 18);
            assert.equal(getEquipmentMaxLevel('Common'), 18);
            assert.equal(getEquipmentMaxLevel('epic'), 27);
            assert.equal(getEquipmentMaxLevel('Epic'), 27);
            assert.equal(getEquipmentMaxLevel(), 18);
        });

        test('All 42 equipment JSON definition files match rarity level caps', () => {
            const equipmentDir = path.join(projectRoot, 'js', 'data', 'equipment');
            const files = fs.readdirSync(equipmentDir).filter(f => f.endsWith('.json'));
            assert.equal(files.length, 42, 'Expected 42 equipment definition files');

            for (const file of files) {
                const filePath = path.join(equipmentDir, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                assert.ok(data.id, `Equipment ${file} must have an id`);
                assert.ok(['common', 'epic'].includes(data.rarity), `Equipment ${file} has invalid rarity: ${data.rarity}`);

                const expectedMaxLevel = getEquipmentMaxLevel(data.rarity);
                const levelKeys = Object.keys(data.levels || {}).map(Number);
                const maxDefinedLevel = Math.max(...levelKeys);

                assert.equal(maxDefinedLevel, expectedMaxLevel, `Equipment ${file} max level (${maxDefinedLevel}) does not match rarity cap (${expectedMaxLevel})`);
            }
        });

        test('All hero equipment definitions in heroData.js have valid rarities and matching JSON definitions', () => {
            const equipmentDir = path.join(projectRoot, 'js', 'data', 'equipment');
            const files = fs.readdirSync(equipmentDir).filter(f => f.endsWith('.json'));
            const jsonIds = new Set();
            for (const file of files) {
                const data = JSON.parse(fs.readFileSync(path.join(equipmentDir, file), 'utf8'));
                jsonIds.add(data.id);
            }

            for (const [heroKey, hero] of Object.entries(heroData)) {
                assert.ok(Array.isArray(hero.equipment), `Hero ${heroKey} must have an equipment array`);
                for (const eq of hero.equipment) {
                    assert.ok(['common', 'epic'].includes(eq.type), `Equipment ${eq.key} in hero ${heroKey} has invalid type: ${eq.type}`);
                    const snakeCaseId = eq.key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                    assert.ok(jsonIds.has(snakeCaseId), `Equipment ${eq.key} (${snakeCaseId}) missing JSON definition`);
                }
            }
        });
    });

    describe('6. League Tiers & Constants Alignment (leagueTiers.js)', () => {
        test('leagueTiers contains 37 items with sequential IDs matching constants', () => {
            assert.ok(Array.isArray(leagueTiers.items));
            assert.equal(leagueTiers.items.length, 37);

            const unrankedItem = leagueTiers.items[0];
            assert.equal(unrankedItem.id, UNRANKED_LEAGUE_ID);
            assert.equal(unrankedItem.name, 'Unranked');

            const legendsItem = leagueTiers.items[36];
            assert.equal(legendsItem.id, LEGENDS_LEAGUE_ID);
            assert.equal(legendsItem.name, 'Legend I');

            for (let i = 0; i < 37; i++) {
                assert.equal(leagueTiers.items[i].id, 105000000 + i);
            }
        });
    });

    describe('7. Pricing & Currency Registries (pricingData.js)', () => {
        test('currencyData defines all 11 supported fiat currencies with active symbols', () => {
            const supportedCurrencies = ['EUR', 'USD', 'GBP', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'JPY', 'NZD', 'TRY'];
            assert.equal(Object.keys(currencyData).length, 11);
            for (const code of supportedCurrencies) {
                assert.ok(currencyData[code], `Currency ${code} must exist in currencyData`);
                assert.equal(currencyData[code].enabled, true);
                assert.ok(currencyData[code].symbol && currencyData[code].symbol.length > 0);
            }
        });

        test('priceTierRegistry provides valid currency pricing across all tiers', () => {
            const tiers = ['tier1', 'tier3', 'tier4', 'tier5', 'tier6', 'tier7', 'tier10', 'tier15', 'tier20', 'tier50', 'tier100', 'tier200'];
            for (const tier of tiers) {
                assert.ok(priceTierRegistry[tier], `Tier ${tier} must exist in priceTierRegistry`);
                assert.ok(priceTierRegistry[tier].USD > 0, `Tier ${tier} must have positive USD cost`);
                assert.ok(priceTierRegistry[tier].EUR > 0, `Tier ${tier} must have positive EUR cost`);
            }
        });
    });

    describe('8. Income Source Registry Invariants (incomeSourceRegistry.js)', () => {
        test('Master catalog incomeData contains all standard income sources', () => {
            const expectedSources = [
                'starBonus',
                'shopOffers',
                'raidMedalTrader',
                'gemTrader',
                'eventPass',
                'eventTrader',
                'clanWar',
                'cwl',
                'supercellEvents',
                'prospector'
            ];

            for (const sourceId of expectedSources) {
                assert.ok(incomeData[sourceId], `Income source ${sourceId} must be registered in incomeData`);
                assert.equal(incomeData[sourceId].id, sourceId);
            }
        });

        test('getSourceById resolves primary sources and star bonus subcategories', () => {
            assert.equal(getSourceById('clanWar')?.id, 'clanWar');
            assert.equal(getSourceById('cwl')?.id, 'cwl');
            assert.equal(getSourceById('starBonus2x')?.id, 'starBonus2x');
            assert.equal(getSourceById('starBonus4x')?.id, 'starBonus4x');
            assert.equal(getSourceById('nonExistentSource'), null);
        });
    });

    describe('9. Static HTML Template Attribute Invariant Checker', () => {
        test('Stored ore inputs across equipment.html, stored-ores-modal.html, and setup-wizard-view.html match STORAGE_LIMITS and STORAGE_STEPS', () => {
            const files = [
                path.join(projectRoot, 'partials', 'tabs', 'equipment.html'),
                path.join(projectRoot, 'partials', 'modals', 'stored-ores-modal.html'),
                path.join(projectRoot, 'partials', 'modals', 'welcome', 'setup-wizard-view.html')
            ];

            for (const filePath of files) {
                const content = fs.readFileSync(filePath, 'utf8');
                const inputs = extractInputAttributes(content);

                const shinyInputs = inputs.filter(i => String(i.id).includes('shiny') && (String(i.id).includes('storage') || String(i.id).includes('stored')));
                assert.ok(shinyInputs.length > 0, `File ${path.basename(filePath)} should contain stored shiny ore input`);
                for (const input of shinyInputs) {
                    assert.equal(input.min, '0', `${input.id} in ${path.basename(filePath)} must have min="0"`);
                    assert.equal(input.max, String(STORAGE_LIMITS.shiny), `${input.id} in ${path.basename(filePath)} max must match STORAGE_LIMITS.shiny (${STORAGE_LIMITS.shiny})`);
                    assert.equal(input.step, String(STORAGE_STEPS.shiny), `${input.id} in ${path.basename(filePath)} step must match STORAGE_STEPS.shiny (${STORAGE_STEPS.shiny})`);
                    assert.equal(input.maxlength, '5', `${input.id} in ${path.basename(filePath)} must have maxlength="5"`);
                }

                const glowyInputs = inputs.filter(i => String(i.id).includes('glowy') && (String(i.id).includes('storage') || String(i.id).includes('stored')));
                assert.ok(glowyInputs.length > 0, `File ${path.basename(filePath)} should contain stored glowy ore input`);
                for (const input of glowyInputs) {
                    assert.equal(input.min, '0', `${input.id} in ${path.basename(filePath)} must have min="0"`);
                    assert.equal(input.max, String(STORAGE_LIMITS.glowy), `${input.id} in ${path.basename(filePath)} max must match STORAGE_LIMITS.glowy (${STORAGE_LIMITS.glowy})`);
                    assert.equal(input.step, String(STORAGE_STEPS.glowy), `${input.id} in ${path.basename(filePath)} step must match STORAGE_STEPS.glowy (${STORAGE_STEPS.glowy})`);
                    assert.equal(input.maxlength, '4', `${input.id} in ${path.basename(filePath)} must have maxlength="4"`);
                }

                const starryInputs = inputs.filter(i => String(i.id).includes('starry') && (String(i.id).includes('storage') || String(i.id).includes('stored')));
                assert.ok(starryInputs.length > 0, `File ${path.basename(filePath)} should contain stored starry ore input`);
                for (const input of starryInputs) {
                    assert.equal(input.min, '0', `${input.id} in ${path.basename(filePath)} must have min="0"`);
                    assert.equal(input.max, String(STORAGE_LIMITS.starry), `${input.id} in ${path.basename(filePath)} max must match STORAGE_LIMITS.starry (${STORAGE_LIMITS.starry})`);
                    assert.equal(input.step, String(STORAGE_STEPS.starry), `${input.id} in ${path.basename(filePath)} step must match STORAGE_STEPS.starry (${STORAGE_STEPS.starry})`);
                    assert.equal(input.maxlength, '4', `${input.id} in ${path.basename(filePath)} must have maxlength="4"`);
                }
            }
        });

        test('Custom chip ore inputs in create-custom-chips.html match CUSTOM_CHIP_LIMITS and STORAGE_STEPS', () => {
            const filePath = path.join(projectRoot, 'partials', 'modals', 'create-custom-chips.html');
            const content = fs.readFileSync(filePath, 'utf8');
            const inputs = extractInputAttributes(content);

            const chipSources = ['extras', 'shopOffers', 'gemTrader', 'raidMedalTrader', 'eventTrader', 'eventPass', 'supercellEvents'];

            for (const source of chipSources) {
                const shinyInput = inputs.find(i => i.id === `custom-chip-${source}-shiny`);
                assert.ok(shinyInput, `Missing custom-chip-${source}-shiny input`);
                assert.equal(shinyInput.min, '0');
                assert.equal(shinyInput.max, String(CUSTOM_CHIP_LIMITS.shiny.max));
                assert.equal(shinyInput.step, String(STORAGE_STEPS.shiny));
                assert.equal(shinyInput.maxlength, String(CUSTOM_CHIP_LIMITS.shiny.maxlength));

                const glowyInput = inputs.find(i => i.id === `custom-chip-${source}-glowy`);
                assert.ok(glowyInput, `Missing custom-chip-${source}-glowy input`);
                assert.equal(glowyInput.min, '0');
                assert.equal(glowyInput.max, String(CUSTOM_CHIP_LIMITS.glowy.max));
                assert.equal(glowyInput.step, String(STORAGE_STEPS.glowy));
                assert.equal(glowyInput.maxlength, String(CUSTOM_CHIP_LIMITS.glowy.maxlength));

                const starryInput = inputs.find(i => i.id === `custom-chip-${source}-starry`);
                assert.ok(starryInput, `Missing custom-chip-${source}-starry input`);
                assert.equal(starryInput.min, '0');
                assert.equal(starryInput.max, String(CUSTOM_CHIP_LIMITS.starry.max));
                assert.equal(starryInput.step, String(STORAGE_STEPS.starry));
                assert.equal(starryInput.maxlength, String(CUSTOM_CHIP_LIMITS.starry.maxlength));
            }
        });

        test('Medal inputs in income.html match MEDAL_STEPS', () => {
            const incomePath = path.join(projectRoot, 'partials', 'tabs', 'income.html');
            const incomeInputs = extractInputAttributes(fs.readFileSync(incomePath, 'utf8'));

            const raidMedals = incomeInputs.find(i => i.id === 'inc-raid-medals-total-input');
            assert.ok(raidMedals, 'Missing inc-raid-medals-total-input');
            assert.equal(raidMedals.step, String(MEDAL_STEPS.raidMedals), `inc-raid-medals-total-input step must match MEDAL_STEPS.raidMedals (${MEDAL_STEPS.raidMedals})`);

            const bonusTrackMedals = incomeInputs.find(i => i.id === 'inc-bonus-track-medals-input');
            assert.ok(bonusTrackMedals, 'Missing inc-bonus-track-medals-input');
            assert.equal(bonusTrackMedals.step, String(MEDAL_STEPS.bonusTrackMedals), `inc-bonus-track-medals-input step must match MEDAL_STEPS.bonusTrackMedals (${MEDAL_STEPS.bonusTrackMedals})`);

            const purchasedMedals = incomeInputs.find(i => i.id === 'inc-event-purchased-medals-input');
            assert.ok(purchasedMedals, 'Missing inc-event-purchased-medals-input');
            assert.equal(purchasedMedals.step, String(MEDAL_STEPS.purchasedMedals), `inc-event-purchased-medals-input step must match MEDAL_STEPS.purchasedMedals (${MEDAL_STEPS.purchasedMedals})`);
        });

        test('Clan War and CWL inputs in income.html and create-custom-chips.html match domain constants', () => {
            const incomePath = path.join(projectRoot, 'partials', 'tabs', 'income.html');
            const incomeInputs = extractInputAttributes(fs.readFileSync(incomePath, 'utf8'));

            const cwWars = incomeInputs.find(i => i.id === 'inc-clan-war-wars-per-month-input');
            assert.ok(cwWars);
            assert.equal(cwWars.min, String(CLAN_WAR_DEFAULTS.MIN_WARS));
            assert.equal(cwWars.max, String(CLAN_WAR_DEFAULTS.MAX_WARS));

            const cwShiny = incomeInputs.find(i => i.id === 'inc-clan-war-shiny-bonus-input');
            assert.ok(cwShiny);
            assert.equal(cwShiny.max, String(WAR_ORE_MAX_LIMITS.shiny));

            const cwGlowy = incomeInputs.find(i => i.id === 'inc-clan-war-glowy-bonus-input');
            assert.ok(cwGlowy);
            assert.equal(cwGlowy.max, String(WAR_ORE_MAX_LIMITS.glowy));

            const cwStarry = incomeInputs.find(i => i.id === 'inc-clan-war-starry-bonus-input');
            assert.ok(cwStarry);
            assert.equal(cwStarry.max, String(WAR_ORE_MAX_LIMITS.starry));

            const cwlHits = incomeInputs.find(i => i.id === 'inc-cwl-hits-per-season-input');
            assert.ok(cwlHits);
            assert.equal(cwlHits.min, String(CWL_DEFAULTS.MIN_HITS));
            assert.equal(cwlHits.max, String(CWL_DEFAULTS.MAX_HITS));

            const cwlShiny = incomeInputs.find(i => i.id === 'inc-cwl-shiny-bonus-input');
            assert.ok(cwlShiny);
            assert.equal(cwlShiny.max, String(WAR_ORE_MAX_LIMITS.shiny));

            const cwlGlowy = incomeInputs.find(i => i.id === 'inc-cwl-glowy-bonus-input');
            assert.ok(cwlGlowy);
            assert.equal(cwlGlowy.max, String(WAR_ORE_MAX_LIMITS.glowy));

            const cwlStarry = incomeInputs.find(i => i.id === 'inc-cwl-starry-bonus-input');
            assert.ok(cwlStarry);
            assert.equal(cwlStarry.max, String(WAR_ORE_MAX_LIMITS.starry));

            const chipsPath = path.join(projectRoot, 'partials', 'modals', 'create-custom-chips.html');
            const chipInputs = extractInputAttributes(fs.readFileSync(chipsPath, 'utf8'));

            const chipCwCount = chipInputs.find(i => i.id === 'custom-chip-clanWar-count');
            assert.ok(chipCwCount);
            assert.equal(chipCwCount.max, String(CLAN_WAR_DEFAULTS.MAX_WARS));

            const chipCwlCount = chipInputs.find(i => i.id === 'custom-chip-cwl-count');
            assert.ok(chipCwlCount);
            assert.equal(chipCwlCount.max, String(CWL_DEFAULTS.MAX_HITS));
        });

        test('Star Bonus 2x modal inputs in star-bonus-multiplier.html match STAR_BONUS_2X_DEFAULTS', () => {
            const filePath = path.join(projectRoot, 'partials', 'modals', 'star-bonus-multiplier.html');
            const inputs = extractInputAttributes(fs.readFileSync(filePath, 'utf8'));

            const freq = inputs.find(i => i.id === 'inc-star-bonus-2x-frequency-input');
            assert.ok(freq);
            assert.equal(freq.min, String(STAR_BONUS_2X_DEFAULTS.minFrequency));
            assert.equal(freq.max, String(STAR_BONUS_2X_DEFAULTS.maxFrequency));
            assert.equal(freq.value, String(STAR_BONUS_2X_DEFAULTS.frequency));

            const dur = inputs.find(i => i.id === 'inc-star-bonus-2x-duration-input');
            assert.ok(dur);
            assert.equal(dur.min, String(STAR_BONUS_2X_DEFAULTS.minDuration));
            assert.equal(dur.max, String(STAR_BONUS_2X_DEFAULTS.maxDuration));
            assert.equal(dur.value, String(STAR_BONUS_2X_DEFAULTS.duration));
        });
    });

    describe('10. Deep Dataset Freezing & Runtime Immutability Hardening', () => {
        test('Trader datasets (traders.js) are deeply frozen across arrays and offer objects', () => {
            assert.ok(Object.isFrozen(raidMedalTraderData), 'raidMedalTraderData array must be frozen');
            for (const offer of raidMedalTraderData) {
                assert.ok(Object.isFrozen(offer), 'raidMedalTraderData offer must be frozen');
            }

            assert.ok(Object.isFrozen(gemTraderData), 'gemTraderData array must be frozen');
            for (const offer of gemTraderData) {
                assert.ok(Object.isFrozen(offer), 'gemTraderData offer must be frozen');
            }

            assert.ok(Object.isFrozen(eventTraderData), 'eventTraderData array must be frozen');
            for (const offer of eventTraderData) {
                assert.ok(Object.isFrozen(offer), 'eventTraderData offer must be frozen');
            }

            assert.throws(() => {
                raidMedalTraderData[0].cost = 0;
            }, TypeError);
        });

        test('Shop offer dataset (shopOffers.js) is deeply frozen across all Town Hall tiers', () => {
            assert.ok(Object.isFrozen(shopOfferData), 'shopOfferData root must be frozen');
            for (const thKey of Object.keys(shopOfferData)) {
                const thRecord = shopOfferData[thKey];
                assert.ok(Object.isFrozen(thRecord), `shopOfferData[${thKey}] must be frozen`);
                for (const prop of Object.keys(thRecord)) {
                    if (typeof thRecord[prop] === 'object' && thRecord[prop] !== null) {
                        assert.ok(Object.isFrozen(thRecord[prop]), `shopOfferData[${thKey}].${prop} must be frozen`);
                    }
                }
            }

            assert.throws(() => {
                // @ts-ignore
                shopOfferData['16'].shiny_large.shiny = 99999;
            }, TypeError);
        });

        test('Event pass dataset (eventPass.js) is deeply frozen across tiers', () => {
            assert.ok(Object.isFrozen(eventPassData), 'eventPassData root must be frozen');
            assert.ok(Object.isFrozen(eventPassData.free), 'eventPassData.free must be frozen');
            assert.ok(Object.isFrozen(eventPassData.event), 'eventPassData.event must be frozen');

            assert.throws(() => {
                eventPassData.event.starry = 999;
            }, TypeError);
        });

        test('Star bonus datasets (starBonus.js) are deeply frozen across rewards and TH floors', () => {
            assert.ok(Object.isFrozen(starBonusData), 'starBonusData array must be frozen');
            for (const entry of starBonusData) {
                assert.ok(Object.isFrozen(entry), 'starBonusData league entry must be frozen');
            }

            assert.ok(Object.isFrozen(townHallLeagueFloors), 'townHallLeagueFloors must be frozen');

            assert.throws(() => {
                starBonusData[0].shiny = 100000;
            }, TypeError);

            assert.throws(() => {
                // @ts-ignore
                townHallLeagueFloors[18] = 0;
            }, TypeError);
        });

        test('Supercell events dataset (supercellEvents.js) is deeply frozen across rewards and event schedules', () => {
            assert.ok(Object.isFrozen(supercellEventsData), 'supercellEventsData root must be frozen');
            assert.ok(Object.isFrozen(supercellEventsData.rewards), 'supercellEventsData.rewards must be frozen');
            for (const year of Object.keys(supercellEventsData.rewards)) {
                assert.ok(Object.isFrozen(supercellEventsData.rewards[year]), `supercellEventsData.rewards[${year}] must be frozen`);
                for (const eventKey of Object.keys(supercellEventsData.rewards[year])) {
                    assert.ok(Object.isFrozen(supercellEventsData.rewards[year][eventKey]), `supercellEventsData.rewards[${year}][${eventKey}] must be frozen`);
                }
            }

            assert.ok(Object.isFrozen(supercellEventsData.events), 'supercellEventsData.events must be frozen');
            for (const year of Object.keys(supercellEventsData.events)) {
                assert.ok(Object.isFrozen(supercellEventsData.events[year]), `supercellEventsData.events[${year}] array must be frozen`);
                for (const ev of supercellEventsData.events[year]) {
                    assert.ok(Object.isFrozen(ev), 'event schedule item must be frozen');
                }
            }

            assert.throws(() => {
                supercellEventsData.rewards[2025].monthlyQualifiers.shiny = 0;
            }, TypeError);
        });

        test('Pricing datasets (pricingData.js) are deeply frozen across currency and tier registries', () => {
            assert.ok(Object.isFrozen(currencyData), 'currencyData root must be frozen');
            for (const code of Object.keys(currencyData)) {
                assert.ok(Object.isFrozen(currencyData[code]), `currencyData[${code}] must be frozen`);
            }

            assert.ok(Object.isFrozen(priceTierRegistry), 'priceTierRegistry root must be frozen');
            for (const tier of Object.keys(priceTierRegistry)) {
                const record = priceTierRegistry[tier];
                assert.ok(Object.isFrozen(record), `priceTierRegistry[${tier}] must be frozen`);
                if (record.i18nArgs) {
                    assert.ok(Object.isFrozen(record.i18nArgs), `priceTierRegistry[${tier}].i18nArgs must be frozen`);
                }
            }

            assert.throws(() => {
                // @ts-ignore
                priceTierRegistry.tier1.USD = 0;
            }, TypeError);
        });

        test('League tiers dataset (leagueTiers.js) is deeply frozen across items, icons, and pagination', () => {
            assert.ok(Object.isFrozen(leagueTiers), 'leagueTiers root must be frozen');
            assert.ok(Object.isFrozen(leagueTiers.items), 'leagueTiers.items array must be frozen');
            for (const tier of leagueTiers.items) {
                assert.ok(Object.isFrozen(tier), `leagueTiers item ${tier.name} must be frozen`);
                assert.ok(Object.isFrozen(tier.iconUrls), `leagueTiers item ${tier.name} iconUrls must be frozen`);
            }
            assert.ok(Object.isFrozen(leagueTiers.paging), 'leagueTiers.paging must be frozen');
            assert.ok(Object.isFrozen(leagueTiers.paging.cursors), 'leagueTiers.paging.cursors must be frozen');

            assert.throws(() => {
                leagueTiers.items[0].name = 'Hacked';
            }, TypeError);
        });

        test('Hero dataset (heroData.js) is deeply frozen across hero records, equipment arrays, and equipment items', () => {
            assert.ok(Object.isFrozen(heroData), 'heroData root must be frozen');
            for (const heroKey of Object.keys(heroData)) {
                const hero = heroData[heroKey];
                assert.ok(Object.isFrozen(hero), `heroData[${heroKey}] must be frozen`);
                assert.ok(Object.isFrozen(hero.equipment), `heroData[${heroKey}].equipment array must be frozen`);
                for (const eq of hero.equipment) {
                    assert.ok(Object.isFrozen(eq), `equipment ${eq.key} on ${heroKey} must be frozen`);
                }
            }

            assert.throws(() => {
                heroData.barbarianKing.equipment[0].name = 'Hack';
            }, TypeError);
        });

        test('War ores and domain constants are deeply frozen', () => {
            assert.ok(Object.isFrozen(warOreTownHallValues), 'warOreTownHallValues root must be frozen');
            assert.ok(Object.isFrozen(warOreTownHallValues.shiny), 'warOreTownHallValues.shiny must be frozen');
            assert.ok(Object.isFrozen(warOreTownHallValues.glowy), 'warOreTownHallValues.glowy must be frozen');
            assert.ok(Object.isFrozen(warOreTownHallValues.starry), 'warOreTownHallValues.starry must be frozen');

            assert.ok(Object.isFrozen(WAR_ORE_MAX_LIMITS), 'WAR_ORE_MAX_LIMITS must be frozen');
            assert.ok(Object.isFrozen(CLAN_WAR_DEFAULTS), 'CLAN_WAR_DEFAULTS must be frozen');
            assert.ok(Object.isFrozen(CWL_DEFAULTS), 'CWL_DEFAULTS must be frozen');

            assert.throws(() => {
                warOreTownHallValues.shiny[16] = 9999;
            }, TypeError);
        });
    });
});
