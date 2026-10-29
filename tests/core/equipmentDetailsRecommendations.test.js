import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { translate } from '../../js/i18n/translator.js';
import { renderRecommendationBadge, renderStrategyBanner } from '../../js/components/equipment/equipmentDetailsStrategyDisplay.js';
import { getModalSessionState, setModalSessionState, resetModalSessionState } from '../../js/components/equipment/equipmentDetailsModalData.js';

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
});
