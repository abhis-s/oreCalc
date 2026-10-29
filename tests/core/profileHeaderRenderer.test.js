import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { renderProfileHeaderHtml, renderConnectProfileButtonHtml, getLeagueI18nKey } from '../../js/components/common/profileHeaderRenderer.js';
import { translate } from '../../js/i18n/translator.js';
import { renderState, resetRenderState, applyProgressDelta } from '../../js/components/home/homeProfileAnimations.js';
import { resetHjRenderState } from '../../js/components/heroJourney/heroJourneyPlayerRenderer.js';
import { renderHomeProfile } from '../../js/components/home/homeProfileRenderer.js';

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

        test('renders mandatory connect profile button for guest users', () => {
            const htmlGuest = renderProfileHeaderHtml({
                profile: null,
                isGuest: true
            });
            assert.ok(htmlGuest.includes('unconnected-connect-btn'));
            assert.ok(htmlGuest.includes('name="plus"'));
            assert.ok(htmlGuest.includes(translate('views.home.profile.connectBtn')));

            const htmlDefaultTag = renderProfileHeaderHtml({
                profile: { tag: 'DEFAULT0', name: 'Guest' },
                isGuest: false
            });
            assert.ok(htmlDefaultTag.includes('unconnected-connect-btn'));
            assert.ok(htmlDefaultTag.includes('name="plus"'));
        });

        test('renders maxEquipment badge with placeholders for guest and live counts for connected player', () => {
            const guestHtml = renderProfileHeaderHtml({
                profile: null,
                isGuest: true,
                maxEquipment: true
            });
            assert.ok(guestHtml.includes('player-maxed-equip-mini'));
            assert.ok(guestHtml.includes('--/--'));

            const connectedHtml = renderProfileHeaderHtml({
                profile: { tag: '#ABC', name: 'Chief' },
                isGuest: false,
                maxEquipment: { current: 15, total: 32, prev: 14 }
            });
            assert.ok(connectedHtml.includes('player-maxed-equip-mini'));
            assert.ok(connectedHtml.includes('data-target-maxed="15"'));
            assert.ok(connectedHtml.includes('data-prev-maxed="14"'));
            assert.ok(connectedHtml.includes('data-total-equip="32"'));
            assert.ok(connectedHtml.includes('14/32'));
        });

        test('renders plannerBridge button with localized label and correct href', () => {
            const html = renderProfileHeaderHtml({
                profile: null,
                isGuest: true,
                plannerBridge: { url: '/ore-calculator/?tag=%23ABC' }
            });
            assert.ok(html.includes('hj-planner-bridge-btn'));
            assert.ok(html.includes('href="/ore-calculator/?tag=%23ABC"'));
            assert.ok(html.includes('name="planner-filled"'));
            assert.ok(html.includes(translate('views.heroJourney.page.backToEquipmentPlanner')));
        });

        test('dynamically renders collapse chevron button based on hasCollapsibleStats', () => {
            const player = { tag: '#123', name: 'Chief' };

            const expandedHtml = renderProfileHeaderHtml({
                profile: player,
                isGuest: false,
                hasCollapsibleStats: true,
                isCollapsed: false
            });
            assert.ok(expandedHtml.includes('profile-collapse-toggle-btn'));
            assert.ok(expandedHtml.includes('name="chevron-up"'));
            assert.ok(expandedHtml.includes('aria-expanded="true"'));

            const collapsedHtml = renderProfileHeaderHtml({
                profile: player,
                isGuest: false,
                hasCollapsibleStats: true,
                isCollapsed: true
            });
            assert.ok(collapsedHtml.includes('profile-collapse-toggle-btn'));
            assert.ok(collapsedHtml.includes('name="chevron-down"'));
            assert.ok(collapsedHtml.includes('aria-expanded="false"'));

            const noStatsHtml = renderProfileHeaderHtml({
                profile: player,
                isGuest: false,
                hasCollapsibleStats: false
            });
            assert.ok(!noStatsHtml.includes('profile-collapse-toggle-btn'));

            const guestHtml = renderProfileHeaderHtml({
                profile: null,
                isGuest: true,
                hasCollapsibleStats: true
            });
            assert.ok(!guestHtml.includes('profile-collapse-toggle-btn'));
        });
    });

    describe('renderConnectProfileButtonHtml', () => {
        test('renders button with canonical plus icon and custom id and classes', () => {
            const html = renderConnectProfileButtonHtml({
                id: 'custom-connect-id',
                extraClass: 'my-custom-class'
            });
            assert.ok(html.includes('id="custom-connect-id"'));
            assert.ok(html.includes('my-custom-class'));
            assert.ok(html.includes('name="plus"'));
            assert.ok(html.includes('unconnected-connect-btn'));
        });
    });

    describe('Profile Render State & Incremental Delta Invariants', () => {
        test('resetRenderState resets all cached snapshot fields', () => {
            renderState.renderedTag = '#TESTTAG';
            renderState.renderedLang = 'de';
            renderState.renderedTH = 16;
            renderState.renderedClan = 'Test Clan';
            renderState.renderedLeague = 105000036;
            renderState.lastProgress = { overall: 75 };
            renderState.isAnimating = true;

            resetRenderState();

            assert.strictEqual(renderState.renderedTag, null);
            assert.strictEqual(renderState.renderedLang, null);
            assert.strictEqual(renderState.renderedTH, null);
            assert.strictEqual(renderState.renderedClan, null);
            assert.strictEqual(renderState.renderedLeague, null);
            assert.strictEqual(renderState.lastProgress, null);
            assert.strictEqual(renderState.isAnimating, false);
        });

        test('resetHjRenderState clears Hero Journey cached progress', () => {
            assert.doesNotThrow(() => resetHjRenderState());
        });

        test('applyProgressDelta returns false if container lacks home-profile-header', () => {
            const dummyContainer = {
                querySelector: () => null,
                classList: { toggle: () => {} }
            };
            const result = applyProgressDelta(
                /** @type {any} */ (dummyContainer),
                { overall: 50 },
                { overall: 60 },
                {},
                /** @type {any} */ ({})
            );
            assert.strictEqual(result, false);

            assert.strictEqual(applyProgressDelta(null, { overall: 50 }, { overall: 60 }, {}, /** @type {any} */ ({})), false);
        });

        test('renderHomeProfile rebuilds full innerHTML when cardContainer is unpopulated even if renderedTag matches', () => {
            const originalDocument = global.document;
            const originalRaf = global.requestAnimationFrame;
            global.requestAnimationFrame = (cb) => cb();
            let innerHtmlAssigned = '';
            const mockCard = {
                removeAttribute: () => {},
                hidden: false,
                style: {},
                classList: {
                    add: () => {},
                    remove: () => {},
                    toggle: () => {}
                },
                querySelector: () => null,
                querySelectorAll: () => [],
                get innerHTML() {
                    return innerHtmlAssigned;
                },
                set innerHTML(val) {
                    innerHtmlAssigned = val;
                }
            };

            global.document = /** @type {any} */ ({
                getElementById: (id) => (id === 'orecalc-home-player-card' ? mockCard : null)
            });

            try {
                renderState.renderedTag = '#PLAYER1';
                renderState.renderedLang = 'en';
                renderState.renderedTH = 16;
                renderState.renderedClan = 'Clan Alpha';
                renderState.renderedLeague = 105000000;
                renderState.lastProgress = { overall: 50, shiny: 50, glowy: 50, starry: 50 };

                const mockAppState = {
                    playerProfile: {
                        tag: '#PLAYER1',
                        name: 'Chief One',
                        townHallLevel: 16,
                        clan: { name: 'Clan Alpha' },
                        leagueTier: { id: 105000000 }
                    },
                    uiSettings: { language: 'en' },
                    heroes: {}
                };

                renderHomeProfile(/** @type {any} */ (mockAppState));

                assert.ok(innerHtmlAssigned.length > 0, 'Card container innerHTML should be populated');
                assert.ok(innerHtmlAssigned.includes('home-profile-header'), 'Card innerHTML must contain home-profile-header');
            } finally {
                global.document = originalDocument;
                global.requestAnimationFrame = originalRaf;
                resetRenderState();
            }
        });
    });
});
