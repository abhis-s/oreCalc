import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { renderProfileStatsHtml } from '../../js/components/common/profileStatsRenderer.js';

describe('Profile Stats Renderer Suite', () => {
    test('renders standardized overall progress container with data attributes', () => {
        const html = renderProfileStatsHtml({
            overall: {
                label: 'Overall Progress',
                labelKey: 'views.home.profile.overallProgress',
                icon: 'assets/ore_icon.png',
                alt: 'Ore',
                percentage: 65,
                percentageText: '65%'
            }
        });

        assert.ok(html.includes('home-profile-stats-container'));
        assert.ok(html.includes('home-profile-overall-progress'));
        assert.ok(html.includes('data-ore="overall"'));
        assert.ok(html.includes('data-ore-value="overall"'));
        assert.ok(html.includes('data-bar-width="65%"'));
        assert.ok(html.includes('Overall Progress'));
        assert.ok(html.includes('data-i18n="views.home.profile.overallProgress"'));
        assert.ok(html.includes('src="assets/ore_icon.png"'));
        assert.ok(!html.includes('fully-maxed'));
        assert.ok(!html.includes('maxed-fill'));
    });

    test('renders individual ore progress rows with storage overlay and custom subtext', () => {
        const html = renderProfileStatsHtml({
            overall: {
                label: 'Overall',
                percentage: 50,
                gradient: 'linear-gradient(90deg, red, blue)'
            },
            ores: [
                {
                    type: 'shiny',
                    label: 'Shiny Ore',
                    labelKey: 'entities.ores.shiny',
                    icon: 'assets/shiny_ore.png',
                    percentage: 40,
                    storagePct: 75,
                    subtextHtml: '<span class="test-sub">12 days left</span>'
                },
                {
                    type: 'glowy',
                    label: 'Glowy Ore',
                    icon: 'assets/glowy_ore.png',
                    percentage: 80,
                    storagePct: 0
                }
            ],
            footerHtml: '<div class="sync-notice">Sync Notice</div>'
        });

        assert.ok(html.includes('home-profile-stats-row'));
        assert.ok(html.includes('background: linear-gradient(90deg, red, blue)'));
        assert.ok(html.includes('data-ore="shiny"'));
        assert.ok(html.includes('data-ore-value="shiny"'));
        assert.ok(html.includes('progress-bar-storage'));
        assert.ok(html.includes('width: 75%'));
        assert.ok(html.includes('shiny-fill'));
        assert.ok(html.includes('data-bar-width="40%"'));
        assert.ok(html.includes('12 days left'));
        assert.ok(html.includes('glowy-fill'));
        assert.ok(html.includes('data-bar-width="80%"'));
        assert.ok(html.includes('<div class="sync-notice">Sync Notice</div>'));
    });

    test('handles maxed progress state by hiding ore rows and applying fully-maxed styling', () => {
        const html = renderProfileStatsHtml({
            overall: {
                label: 'Overall Progress',
                percentage: 100,
                isMaxed: true
            },
            ores: [
                {
                    type: 'shiny',
                    label: 'Shiny Ore',
                    icon: 'assets/shiny_ore.png',
                    percentage: 100
                }
            ]
        });

        assert.ok(html.includes('home-profile-overall-progress fully-maxed'));
        assert.ok(html.includes('maxed-fill'));
        assert.ok(!html.includes('home-profile-stats-row'));
        assert.ok(!html.includes('data-ore="shiny"'));
    });

    test('escapes labels and alt attributes to prevent XSS injection', () => {
        const html = renderProfileStatsHtml({
            overall: {
                label: '<script>alert("hack")</script>',
                icon: 'assets/ore.png',
                percentage: 10
            },
            ores: [
                {
                    type: 'shiny',
                    label: '<b>Bold</b>',
                    alt: '" onclick="evil()',
                    icon: 'assets/shiny.png',
                    percentage: 20
                }
            ]
        });

        assert.ok(!html.includes('<script>alert("hack")</script>'));
        assert.ok(html.includes('&lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt;'));
        assert.ok(!html.includes('<b>Bold</b>'));
        assert.ok(html.includes('&lt;b&gt;Bold&lt;/b&gt;'));
        assert.ok(!html.includes('" onclick="evil()'));
        assert.ok(html.includes('&quot; onclick=&quot;evil()'));
    });
});
