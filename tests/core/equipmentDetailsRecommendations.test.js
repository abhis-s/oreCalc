import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../../js/core/state.js';
import { translate } from '../../js/i18n/translator.js';
import { renderRecommendationBadge, renderStrategyBanner } from '../../js/components/equipment/equipmentDetailsStrategyDisplay.js';
import {
    findValidEquipmentIndex,
    getEquipLevel,
    getFlatEquipmentsList,
    getModalSessionState,
    resetModalSessionState,
    setModalSessionState
} from '../../js/components/equipment/equipmentDetailsModalData.js';

class MockElement {
    constructor() {
        this.hidden = true;
        this.style = { display: 'none' };
        this.innerHTML = '';
        this.className = '';
        this.attributes = new Map();
    }

    setAttribute(name, val) {
        this.attributes.set(name, String(val));
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    getAttribute(name) {
        return this.attributes.get(name) || null;
    }
}

describe('Equipment Details Recommendations Display Suite', () => {
    test('renderRecommendationBadge reveals badge with hidden=false and expected class for must-have equipment', () => {
        const badge = new MockElement();
        const mockRec = { recStatus: 'must_have', recommendedLevels: { default: 18 } };

        renderRecommendationBadge(badge, { id: 'spiky_ball' }, 'Spiky Ball', mockRec, 'standard', 16, 27, false);

        assert.equal(badge.hidden, false, 'Badge element must have hidden=false');
        assert.equal(badge.style.display, 'inline-flex');
        assert.ok(badge.className.includes('badge-must-have'), 'Class must include badge-must-have');
        assert.ok(badge.innerHTML.includes(translate('views.equipment.mustHave')), 'Markup must include Must-Have translation');
    });

    test('renderRecommendationBadge reveals badge with hidden=false for recommended equipment', () => {
        const badge = new MockElement();
        const mockRec = { recStatus: 'recommended', recommendedLevels: { default: 18 } };

        renderRecommendationBadge(badge, { id: 'giant_gauntlet' }, 'Giant Gauntlet', mockRec, 'standard', 16, 27, false);

        assert.equal(badge.hidden, false, 'Badge element must have hidden=false');
        assert.equal(badge.style.display, 'inline-flex');
        assert.ok(badge.className.includes('badge-recommended'), 'Class must include badge-recommended');
    });

    test('renderRecommendationBadge reveals badge with hidden=false for niche equipment', () => {
        const badge = new MockElement();
        const mockRec = { recStatus: 'niche', recommendedLevels: { default: 12 } };

        renderRecommendationBadge(badge, { id: 'rage_vial' }, 'Rage Vial', mockRec, 'standard', 16, 18, false);

        assert.equal(badge.hidden, false, 'Badge element must have hidden=false');
        assert.equal(badge.style.display, 'inline-flex');
        assert.ok(badge.className.includes('badge-niche'), 'Class must include badge-niche');
    });

    test('renderRecommendationBadge reveals badge with hidden=false for not recommended equipment', () => {
        const badge = new MockElement();
        const mockRec = { recStatus: 'not_recommended' };

        renderRecommendationBadge(badge, { id: 'barbarian_puppet' }, 'Barbarian Puppet', mockRec, 'standard', 16, 18, false);

        assert.equal(badge.hidden, false, 'Badge element must have hidden=false');
        assert.equal(badge.style.display, 'inline-flex');
        assert.ok(badge.className.includes('badge-not-recommended'), 'Class must include badge-not-recommended');
    });

    test('renderRecommendationBadge conceals badge with hidden=true when no recommendation is available', () => {
        const badge = new MockElement();
        badge.hidden = false;
        badge.style.display = 'inline-flex';

        renderRecommendationBadge(badge, { id: 'unknown_gear' }, 'Unknown Gear', null, 'standard', 16, 18, false);

        assert.equal(badge.hidden, true, 'Badge element must have hidden=true when recommendation is null');
        assert.equal(badge.style.display, 'none');
    });

    test('renderStrategyBanner manages unhide button hidden state correctly when toggling dismiss', () => {
        const container = new MockElement();
        const unhideBtn = new MockElement();
        const mockRec = { recStatus: 'niche' };

        renderStrategyBanner(container, unhideBtn, 'rage_vial', false, false, mockRec, 'standard', 16, 18, false);
        assert.ok(container.innerHTML.length > 0, 'Banner container should contain message markup');
        assert.equal(unhideBtn.hidden, true, 'Unhide button must have hidden=true when banner is active');
        assert.equal(unhideBtn.style.display, 'none');

        renderStrategyBanner(container, unhideBtn, 'rage_vial', false, false, mockRec, 'standard', 16, 18, true);
        assert.equal(container.innerHTML, '', 'Banner container must be empty when dismissed');
        assert.equal(unhideBtn.hidden, false, 'Unhide button must have hidden=false when note is dismissed');
        assert.equal(unhideBtn.style.display, 'inline-flex');
    });

    test('sessionRecommendationHidden initializes and resets to null', () => {
        resetModalSessionState();
        assert.equal(getModalSessionState().recommendationHidden, null, 'recommendationHidden must default to null');

        setModalSessionState({ recommendationHidden: true });
        assert.equal(getModalSessionState().recommendationHidden, true, 'recommendationHidden must accept updates');

        resetModalSessionState();
        assert.equal(getModalSessionState().recommendationHidden, null, 'recommendationHidden must reset to null on close');
    });

    test('getFlatEquipmentsList returns invariant keys, canonical names, and localized displayNames', () => {
        const list = getFlatEquipmentsList();
        assert.ok(Array.isArray(list) && list.length > 0, 'Equipment list must not be empty');

        for (const item of list) {
            assert.ok(typeof item.key === 'string' && item.key.length > 0, 'Each item must have a non-empty key');
            assert.ok(typeof item.name === 'string' && item.name.length > 0, 'Each item must have a non-empty canonical name');
            assert.ok(typeof item.displayName === 'string' && item.displayName.length > 0, 'Each item must have a non-empty displayName');
            assert.ok(typeof item.heroKey === 'string' && item.heroKey.length > 0, 'Each item must have a heroKey');
        }

        const gauntlet = list.find(item => item.key === 'giantGauntlet');
        assert.ok(gauntlet, 'Giant Gauntlet item must be present');
        assert.equal(gauntlet.name, 'Giant Gauntlet');
        assert.equal(gauntlet.heroKey, 'barbarianKing');
    });

    test('findValidEquipmentIndex navigates adjacent equipment items by invariant key', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async (url) => {
                const urlStr = String(url);
                if (urlStr.includes('/js/data/equipment/spiky_ball.json') || urlStr.includes('/js/data/equipment/giant_gauntlet.json')) {
                    return {
                        ok: true,
                        headers: { get: () => 'application/json' },
                        json: async () => ({ id: 'mock', levels: [1] })
                    };
                }
                return {
                    ok: false,
                    headers: { get: () => null }
                };
            };

            const sampleList = [
                { key: 'giantGauntlet', name: 'Giant Gauntlet' },
                { key: 'unavailableGear', name: 'Unavailable Gear' },
                { key: 'spikyBall', name: 'Spiky Ball' }
            ];

            const nextIdx = await findValidEquipmentIndex(sampleList, 0, 'next');
            assert.equal(nextIdx, 2, 'Must skip index 1 and find spikyBall at index 2');

            const prevIdx = await findValidEquipmentIndex(sampleList, 2, 'prev');
            assert.equal(prevIdx, 0, 'Must skip index 1 and find giantGauntlet at index 0');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('getEquipLevel resolves levels by canonical name or camelCase key', () => {
        const prevHeroesState = state.heroes;
        try {
            state.heroes = {
                'Barbarian King': {
                    equipment: {
                        'Giant Gauntlet': { level: 27 },
                        'Spiky Ball': { level: 18 }
                    }
                }
            };

            assert.equal(getEquipLevel('Giant Gauntlet', 'Barbarian King'), 27, 'Direct canonical name match');
            assert.equal(getEquipLevel('giantGauntlet', 'Barbarian King'), 27, 'CamelCase key match with hero specified');
            assert.equal(getEquipLevel('giantGauntlet', null, 'barbarianKing'), 27, 'CamelCase key match with heroKey specified');
            assert.equal(getEquipLevel('spikyBall'), 18, 'CamelCase key match across global heroes fallback');
            assert.equal(getEquipLevel('unknownEquipment'), 1, 'Non-existent equipment falls back to 1');
        } finally {
            state.heroes = prevHeroesState;
        }
    });
});
