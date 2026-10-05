import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { renderProfileHeaderHtml, getLeagueI18nKey } from '../../js/components/common/profileHeaderRenderer.js';
import { translate } from '../../js/i18n/translator.js';

describe('Profile Header Renderer Suite', () => {
    describe('getLeagueI18nKey', () => {
        test('resolves unranked key for null or missing league data', () => {
            assert.strictEqual(getLeagueI18nKey(null), 'entities.leagues.unranked');
            assert.strictEqual(getLeagueI18nKey({}), 'entities.leagues.unranked');
        });

        test('resolves canonical keys for standard league tiers', () => {
            assert.strictEqual(getLeagueI18nKey({ name: 'Unranked' }), 'entities.leagues.unranked');
            assert.strictEqual(getLeagueI18nKey({ name: 'Skeleton 1' }), 'entities.leagues.skeleton_1');
            assert.strictEqual(getLeagueI18nKey({ name: 'Archer 7' }), 'entities.leagues.archer_7');
            assert.strictEqual(getLeagueI18nKey({ name: 'Legend I' }), 'entities.leagues.legendI');
            assert.strictEqual(getLeagueI18nKey({ name: 'Legend II' }), 'entities.leagues.legendII');
        });
    });

    describe('renderProfileHeaderHtml', () => {
        test('renders guest profile with localized unranked league and no clan', () => {
            const html = renderProfileHeaderHtml({
                profile: null,
                isGuest: true,
                thLevel: 18,
                actionsRowHtml: '<button id="test-btn">Test</button>',
                headerExtraClasses: 'custom-header-class'
            });

            assert.ok(html.includes('home-profile-header'));
            assert.ok(html.includes('custom-header-class'));
            assert.ok(html.includes('is-guest'));
            assert.ok(html.includes('is-silhouette'));
            assert.ok(html.includes('data-i18n="views.home.profile.noProfileTitle"'));
            assert.ok(html.includes('data-i18n="views.guidedSetup.guestProfileTag"'));
            assert.ok(html.includes('data-i18n="views.guidedSetup.noClan"'));
            assert.ok(html.includes('class="league-name-mini" data-i18n="entities.leagues.unranked"'));
            assert.ok(html.includes('<button id="test-btn">Test</button>'));
        });

        test('renders connected player with clan, role, and league containing data-i18n markers', () => {
            const player = {
                name: 'Chief',
                tag: '#8PJYGUJC',
                townHallLevel: 17,
                trophies: 5200,
                role: 'leader',
                clan: {
                    name: 'Test Clan',
                    badgeUrls: { small: 'https://example.com/badge.png' }
                },
                leagueTier: {
                    id: 105000036,
                    name: 'Legend I',
                    iconUrls: { small: 'https://example.com/legend.png' }
                }
            };

            const html = renderProfileHeaderHtml({
                profile: player,
                isGuest: false,
                thLevel: 17,
                tag: player.tag,
                trophies: 5200,
                actionsRowHtml: '<span class="action-test">Action</span>'
            });

            assert.ok(html.includes('Chief'));
            assert.ok(html.includes('#8PJYGUJC'));
            assert.ok(html.includes('Test Clan'));
            // Role must have data-i18n attribute
            assert.ok(html.includes('class="clan-role-mini" data-i18n="player.roles.leader"'));
            assert.ok(html.includes(translate('player.roles.leader')));
            // League must have data-i18n attribute
            assert.ok(html.includes('class="league-name-mini" data-i18n="entities.leagues.legendI"'));
            assert.ok(html.includes(translate('entities.leagues.legendI')));
            // Trophies counter
            assert.ok(html.includes('data-target-trophies="5200"'));
            // Actions row
            assert.ok(html.includes('<span class="action-test">Action</span>'));
        });

        test('renders connected player without clan showing noClan fallback', () => {
            const player = {
                name: 'Chief',
                tag: '#TESTTAG1',
                townHallLevel: 15,
                trophies: 3400,
                clan: null,
                leagueTier: null
            };

            const html = renderProfileHeaderHtml({
                profile: player,
                isGuest: false,
                thLevel: 15
            });

            assert.ok(html.includes('Chief'));
            assert.ok(html.includes('data-i18n="views.guidedSetup.noClan"'));
            assert.ok(html.includes('class="league-name-mini" data-i18n="entities.leagues.unranked"'));
        });

        test('escapes player name and tag against XSS injection', () => {
            const player = {
                name: '<script>alert(1)</script>',
                tag: '#<script>',
                townHallLevel: 16,
                clan: {
                    name: '<b>BadClan</b>',
                    badgeUrls: { small: '' }
                }
            };

            const html = renderProfileHeaderHtml({
                profile: player,
                isGuest: false,
                thLevel: 16
            });

            assert.ok(!html.includes('<script>alert(1)</script>'));
            assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
            assert.ok(html.includes('&lt;b&gt;BadClan&lt;/b&gt;'));
        });
    });
});
