import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));
const deJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/de.json'), 'utf8'));
globalThis.fetch = async (url) => {
    if (String(url).includes('/en.json')) return { ok: true, json: async () => enJson };
    if (String(url).includes('/de.json')) return { ok: true, json: async () => deJson };
    return { ok: false, status: 404 };
};

const { state } = await import('../../js/core/state.js');
const { loadTranslations } = await import('../../js/i18n/translator.js');
const {
    getEquipmentDisplayName,
    getHeroDisplayName,
    getDefenseDisplayName
} = await import('../../js/utils/equipmentMetadata.js');

describe('Equipment Metadata & Entity Display Names Suite', () => {
    before(async () => {
        if (!state.uiSettings) state.uiSettings = {};
        state.uiSettings.language = 'en';
        await loadTranslations('en');
    });

    test('getEquipmentDisplayName resolves known equipment and falls back gracefully', () => {
        assert.strictEqual(getEquipmentDisplayName(''), '');
        assert.strictEqual(getEquipmentDisplayName(null), '');

        // Giant Gauntlet has localized name
        const name1 = getEquipmentDisplayName('giant_gauntlet');
        assert.ok(typeof name1 === 'string' && name1.length > 0);
        assert.ok(!name1.startsWith('entities.'));

        // CamelCase / TitleCase variation
        const name2 = getEquipmentDisplayName('Giant Gauntlet');
        assert.strictEqual(name2, name1);

        // Fallback for unknown equipment key
        const unknown = getEquipmentDisplayName('unknown_custom_ore_gear');
        assert.strictEqual(unknown, 'unknown_custom_ore_gear');
    });

    test('getHeroDisplayName resolves known heroes and defaults properly', () => {
        assert.strictEqual(getHeroDisplayName(''), 'Hero Equipment');
        assert.strictEqual(getHeroDisplayName(null), 'Hero Equipment');

        const bk = getHeroDisplayName('barbarian_king');
        assert.ok(typeof bk === 'string' && bk.length > 0);
        assert.ok(!bk.startsWith('entities.'));

        const camelBk = getHeroDisplayName('barbarianKing');
        assert.strictEqual(camelBk, bk);

        const unknown = getHeroDisplayName('goblin_king');
        assert.strictEqual(unknown, 'goblin_king');
    });

    test('getDefenseDisplayName formats defense titles and handles unknown keys', () => {
        assert.strictEqual(getDefenseDisplayName(''), '');
        assert.strictEqual(getDefenseDisplayName(null), '');

        const ad = getDefenseDisplayName('air_defense');
        assert.ok(typeof ad === 'string' && ad.length > 0);
        assert.ok(!ad.startsWith('entities.'));

        // Unknown defense key title-cases words from snake_case
        const customDef = getDefenseDisplayName('mega_tesla_tower');
        assert.strictEqual(customDef, 'Mega Tesla Tower');
    });

    test('getDefenseDisplayName resolves hero targets in English and German', async () => {
        // In English
        state.uiSettings.language = 'en';
        await loadTranslations('en');
        assert.strictEqual(getDefenseDisplayName('archer_queen'), 'Archer Queen');
        assert.strictEqual(getDefenseDisplayName('barbarian_king'), 'Barbarian King');
        assert.strictEqual(getDefenseDisplayName('grand_warden'), 'Grand Warden');
        assert.strictEqual(getDefenseDisplayName('royal_champion'), 'Royal Champion');
        assert.strictEqual(getDefenseDisplayName('minion_prince'), 'Minion Prince');
        assert.strictEqual(getDefenseDisplayName('dragon_duke'), 'Dragon Duke');

        // In German
        state.uiSettings.language = 'de';
        await loadTranslations('de');
        assert.strictEqual(getDefenseDisplayName('archer_queen'), 'Bogenschützenkönigin');
        assert.strictEqual(getDefenseDisplayName('barbarian_king'), 'Barbarenkönig');
        assert.strictEqual(getDefenseDisplayName('grand_warden'), 'Großer Wächter');
        assert.strictEqual(getDefenseDisplayName('royal_champion'), 'Königliche Gladiatorin');
        assert.strictEqual(getDefenseDisplayName('minion_prince'), 'Lakaienprinz');
        assert.strictEqual(getDefenseDisplayName('dragon_duke'), 'Drachenfürst');

        // Defenses in German
        assert.strictEqual(getDefenseDisplayName('air_defense'), 'Luftabwehr');
        assert.strictEqual(getDefenseDisplayName('firespitter'), 'Feuerspeier');
        assert.strictEqual(getDefenseDisplayName('multi_gear_tower'), 'Multi-Entwicklungs-Turm');
        assert.strictEqual(getDefenseDisplayName('revenge_tower'), 'Vergeltungsturm');
        assert.strictEqual(getDefenseDisplayName('builders_hut'), 'Bauhütte');
        assert.strictEqual(getDefenseDisplayName('cake_a_pult'), 'Tortapult');
        assert.strictEqual(getDefenseDisplayName('dark_elixir_storage'), 'Lager für Dunkles Elixier');
        assert.strictEqual(getDefenseDisplayName('elixir_storage'), 'Elixierlager');
        assert.strictEqual(getDefenseDisplayName('hero_hunter'), 'Heldenjägerin');
        assert.strictEqual(getDefenseDisplayName('logger'), 'Kampfholzfäller');
        assert.strictEqual(getDefenseDisplayName('longshot'), 'Pfeilkopf');
        assert.strictEqual(getDefenseDisplayName('multi_archer_tower'), 'Multi-Bogenschützenturm');
        assert.strictEqual(getDefenseDisplayName('smasher'), 'Drescher');
        assert.strictEqual(getDefenseDisplayName('super_wizard_tower'), 'Supermagier-Turm');

        // Reset back to English
        state.uiSettings.language = 'en';
        await loadTranslations('en');
    });
});
