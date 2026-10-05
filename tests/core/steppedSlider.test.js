import test from 'node:test';
import assert from 'node:assert/strict';
import {
    renderSteppedSliderHtml,
    renderSliderTicksHtml
} from '../../js/components/common/steppedSlider.js';

test('renderSliderTicksHtml - Edge cases and count verification', () => {
    assert.equal(renderSliderTicksHtml(1, 1), '', 'Must return empty string when max equals min');
    assert.equal(renderSliderTicksHtml(5, 2), '', 'Must return empty string when max is less than min');
    assert.equal(renderSliderTicksHtml(1, 0), '', 'Must return empty string when max is 0');

    const fiveTicks = renderSliderTicksHtml(1, 5);
    const tickMatches = fiveTicks.match(/class="calc-slider-tick"/g) || [];
    assert.equal(tickMatches.length, 5, 'Must generate exactly 5 tick marks for range 1 to 5');
    assert.ok(fiveTicks.includes('aria-hidden="true"'), 'Tick marks must declare aria-hidden');

    const sixteenTicks = renderSliderTicksHtml(1, 16);
    const sixteenMatches = sixteenTicks.match(/class="calc-slider-tick"/g) || [];
    assert.equal(sixteenMatches.length, 16, 'Must generate exactly 16 tick marks for range 1 to 16');

    // Wide range safety guard (e.g. 0 to 2000)
    const wideTicks = renderSliderTicksHtml(0, 100);
    assert.equal(wideTicks, '', 'Must suppress ticks when step count exceeds 35');
});

test('renderSteppedSliderHtml - Renders container, input, and ticks accurately', () => {
    const html = renderSteppedSliderHtml({
        min: 1,
        max: 5,
        value: 3,
        id: 'test-slider',
        className: 'test-slider-class',
        wrapClassName: 'test-wrap-class',
        dataAttributes: {
            defenseKey: 'monolith',
            action: 'level-change'
        },
        ariaLabel: 'Monolith Level',
        withTicks: true
    });

    assert.ok(html.includes('class="calc-stepped-slider test-wrap-class"'), 'Must render container with custom wrap class');
    assert.ok(html.includes('id="test-slider"'), 'Must render input with specified ID');
    assert.ok(html.includes('class="calc-slider test-slider-class"'), 'Must render input with calc-slider and custom classes');
    assert.ok(html.includes('min="1"'), 'Must render min attribute');
    assert.ok(html.includes('max="5"'), 'Must render max attribute');
    assert.ok(html.includes('value="3"'), 'Must render value attribute');
    assert.ok(html.includes('data-defense-key="monolith"'), 'Must format data attributes accurately');
    assert.ok(html.includes('data-action="level-change"'), 'Must format camelCase data attributes to kebab-case');
    assert.ok(html.includes('aria-label="Monolith Level"'), 'Must include aria-label');
    assert.ok(html.includes('class="calc-slider-ticks"'), 'Must render ticks container');

    const ticks = html.match(/class="calc-slider-tick"/g) || [];
    assert.equal(ticks.length, 5, 'Must contain 5 tick spans');
});

test('renderSteppedSliderHtml - Value clamping and disabled state', () => {
    const clampedUnder = renderSteppedSliderHtml({ min: 5, max: 10, value: 2 });
    assert.ok(clampedUnder.includes('value="5"'), 'Must clamp value up to min');

    const clampedOver = renderSteppedSliderHtml({ min: 1, max: 10, value: 15 });
    assert.ok(clampedOver.includes('value="10"'), 'Must clamp value down to max');

    const disabledHtml = renderSteppedSliderHtml({ min: 1, max: 5, value: 1, disabled: true });
    assert.ok(disabledHtml.includes('disabled'), 'Must apply disabled attribute when disabled is true');

    const withoutTicksHtml = renderSteppedSliderHtml({ min: 1, max: 5, value: 1, withTicks: false });
    assert.ok(!withoutTicksHtml.includes('calc-slider-ticks'), 'Must not render ticks when withTicks is false');
});

test('renderSliderTicksHtml and renderSteppedSliderHtml - maxAllowed disables steps beyond limit', () => {
    // 1. renderSliderTicksHtml with maxAllowed = 10 on range 1 to 16
    const ticksHtml = renderSliderTicksHtml(1, 16, 10);
    const allTicks = ticksHtml.match(/class="calc-slider-tick/g) || [];
    const disabledTicks = ticksHtml.match(/class="calc-slider-tick is-disabled"/g) || [];

    assert.equal(allTicks.length, 16, 'Must render all 16 ticks across full size range');
    assert.equal(disabledTicks.length, 6, 'Must mark steps 11 through 16 with is-disabled');

    // 2. renderSteppedSliderHtml with maxAllowed = 10 on range 1 to 16
    const sliderHtml = renderSteppedSliderHtml({
        min: 1,
        max: 16,
        value: 12,
        maxAllowed: 10,
        id: 'full-size-slider',
        withTicks: true
    });

    assert.ok(sliderHtml.includes('min="1"'), 'Must maintain full size min=1');
    assert.ok(sliderHtml.includes('max="16"'), 'Must maintain full size max=16');
    assert.ok(sliderHtml.includes('value="10"'), 'Must clamp value down to maxAllowed (10)');
    assert.ok(sliderHtml.includes('data-max-allowed="10"'), 'Must declare data-max-allowed="10" attribute');
    assert.ok(sliderHtml.includes('has-disabled-steps'), 'Must declare has-disabled-steps modifier on wrapper');
    assert.ok(sliderHtml.includes('calc-slider-locked-track'), 'Must render locked track segment element');
    assert.ok(sliderHtml.includes('--slider-locked-ratio: 0.6000'), 'Must calculate locked track ratio at 0.6000');
    assert.ok(sliderHtml.includes('--slider-locked-start: 60.00%'), 'Must calculate locked track start percentage at 60%');
});

test('renderSliderTicksHtml and renderSteppedSliderHtml - Supports custom discrete tickValues', () => {
    // Barbarian King discrete levels (1, 5, 10, ..., 110: 23 ticks)
    const heroLevels = [1];
    for (let lvl = 5; lvl <= 110; lvl += 5) heroLevels.push(lvl);
    assert.equal(heroLevels.length, 23);

    // TH14 limit = 80
    const ticksHtml = renderSliderTicksHtml(1, 110, 80, heroLevels);
    const allTicks = ticksHtml.match(/class="calc-slider-tick/g) || [];
    const disabledTicks = ticksHtml.match(/class="calc-slider-tick is-disabled"/g) || [];

    assert.equal(allTicks.length, 23, 'Must render 23 tick marks for discrete hero levels');
    // Steps beyond 80: 85, 90, 95, 100, 105, 110 -> 6 disabled ticks
    assert.equal(disabledTicks.length, 6, 'Must mark steps beyond limit as is-disabled');

    const sliderHtml = renderSteppedSliderHtml({
        min: 1,
        max: 110,
        value: 75,
        maxAllowed: 80,
        tickValues: heroLevels,
        withTicks: true
    });
    assert.ok(sliderHtml.includes('calc-slider-ticks'), 'Must render ticks container');
    assert.equal((sliderHtml.match(/\bcalc-slider-tick\b/g) || []).length, 23, 'Must render 23 ticks in slider component');
});
