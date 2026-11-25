import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    shouldDisplayDomainNotice,
    IS_DOMAIN_NOTICE_ACTIVE
} from '../../js/components/common/domainNotice.js';
import { buildClashCalcTargetUrl } from '../../js/utils/clashCalcUrl.js';

test('shouldDisplayDomainNotice is permanently active by default and displays on legacy domains', () => {
    assert.equal(IS_DOMAIN_NOTICE_ACTIVE, true);

    // Active behavior on legacy domains
    assert.equal(shouldDisplayDomainNotice({ hostname: 'orecalc.tech' }), true);
    assert.equal(shouldDisplayDomainNotice({ hostname: 'www.orecalc.tech' }), true);
    assert.equal(shouldDisplayDomainNotice({ hostname: 'beta.orecalc.tech' }), true);
    assert.equal(shouldDisplayDomainNotice({ hostname: 'localhost' }), false);
    assert.equal(shouldDisplayDomainNotice({ hostname: '' }), false);
    assert.equal(shouldDisplayDomainNotice({ hostname: null }), false);

    // Dormant override suppresses unless query flag is present
    assert.equal(shouldDisplayDomainNotice({ hostname: 'orecalc.tech', isActive: false }), false);
    assert.equal(shouldDisplayDomainNotice({ hostname: 'orecalc.tech', isActive: false, search: '?domainNotice=true' }), true);

    // Query overrides allow inspection on localhost
    assert.equal(shouldDisplayDomainNotice({ hostname: 'localhost', search: '?domainNotice=true' }), true);
    assert.equal(shouldDisplayDomainNotice({ hostname: 'localhost', search: '?testDomainNotice=true' }), true);

    // Target clashcalc.com domain remains strictly immune even with query flag
    assert.equal(shouldDisplayDomainNotice({ hostname: 'clashcalc.com', search: '?domainNotice=true' }), false);
    assert.equal(shouldDisplayDomainNotice({ hostname: 'www.clashcalc.com', search: '?testDomainNotice=true' }), false);
});

test('shouldDisplayDomainNotice displays notice strictly on orecalc.tech domains when activated', () => {
    assert.equal(shouldDisplayDomainNotice({ hostname: 'orecalc.tech', isActive: true }), true);
    assert.equal(shouldDisplayDomainNotice({ hostname: 'www.orecalc.tech', isActive: true }), true);
    assert.equal(shouldDisplayDomainNotice({ hostname: 'beta.orecalc.tech', isActive: true }), true);
    assert.equal(shouldDisplayDomainNotice({ hostname: 'orecalc-domain-test.local', isActive: true }), true);

    assert.equal(shouldDisplayDomainNotice({ hostname: 'clashcalc.com', isActive: true }), false);
    assert.equal(shouldDisplayDomainNotice({ hostname: 'www.clashcalc.com', isActive: true }), false);
    assert.equal(shouldDisplayDomainNotice({ hostname: 'beta.clashcalc.com', isActive: true }), false);
    assert.equal(shouldDisplayDomainNotice({ hostname: 'localhost', isActive: true }), false);
    assert.equal(shouldDisplayDomainNotice({ hostname: '', isActive: true }), false);
    assert.equal(shouldDisplayDomainNotice({ hostname: null, isActive: true }), false);
});

test('buildClashCalcTargetUrl correctly routes root and tool paths to clashcalc.com', () => {
    const rootUrl = buildClashCalcTargetUrl({ currentPath: '/' });
    assert.equal(rootUrl, 'https://clashcalc.com/ore-calculator/');

    const indexUrl = buildClashCalcTargetUrl({ currentPath: '/index.html' });
    assert.equal(indexUrl, 'https://clashcalc.com/ore-calculator/');

    const hjUrl = buildClashCalcTargetUrl({ currentPath: '/hero-journey/' });
    assert.equal(hjUrl, 'https://clashcalc.com/hero-journey/');
});

test('buildClashCalcTargetUrl carries over userId and player tag query parameters cleanly', () => {
    const urlWithParams = buildClashCalcTargetUrl({
        currentPath: '/',
        userId: 'usr_abc1234567890',
        activePlayerTag: '#9PP0V2RGY'
    });

    const parsed = new URL(urlWithParams);
    assert.equal(parsed.origin, 'https://clashcalc.com');
    assert.equal(parsed.pathname, '/ore-calculator/');
    assert.equal(parsed.searchParams.get('userId'), 'usr_abc1234567890');
    assert.equal(parsed.searchParams.get('tag'), '#9PP0V2RGY');
});

test('buildClashCalcTargetUrl ignores default tag placeholder and trims whitespace', () => {
    const urlDefaultTag = buildClashCalcTargetUrl({
        currentPath: '/hero-journey/',
        userId: 'usr_xyz9876543210',
        activePlayerTag: 'DEFAULT0'
    });

    const parsed = new URL(urlDefaultTag);
    assert.equal(parsed.pathname, '/hero-journey/');
    assert.equal(parsed.searchParams.get('userId'), 'usr_xyz9876543210');
    assert.equal(parsed.searchParams.has('tag'), false);
});

test('buildClashCalcTargetUrl preserves localized language route prefixes', () => {
    assert.equal(
        buildClashCalcTargetUrl({ currentPath: '/de/' }),
        'https://clashcalc.com/de/ore-calculator/'
    );
    assert.equal(
        buildClashCalcTargetUrl({ currentPath: '/de/ore-calculator/' }),
        'https://clashcalc.com/de/ore-calculator/'
    );
    assert.equal(
        buildClashCalcTargetUrl({ currentPath: '/de/hero-journey/' }),
        'https://clashcalc.com/de/hero-journey/'
    );
    assert.equal(
        buildClashCalcTargetUrl({ currentPath: '/tr/' }),
        'https://clashcalc.com/tr/ore-calculator/'
    );
    assert.equal(
        buildClashCalcTargetUrl({ currentPath: '/zh/hero-journey/' }),
        'https://clashcalc.com/zh/hero-journey/'
    );
});

test('buildClashCalcTargetUrl strips domainNotice and testDomainNotice test flags from target search parameters', () => {
    const targetUrl = buildClashCalcTargetUrl({
        currentPath: '/',
        currentSearch: '?domainNotice=true&testDomainNotice=true&customParam=hello',
        userId: 'usr_abc',
        activePlayerTag: '#9PP0V2RGY'
    });

    const parsed = new URL(targetUrl);
    assert.equal(parsed.searchParams.has('domainNotice'), false);
    assert.equal(parsed.searchParams.has('testDomainNotice'), false);
    assert.equal(parsed.searchParams.get('customParam'), 'hello');
    assert.equal(parsed.searchParams.get('userId'), 'usr_abc');
    assert.equal(parsed.searchParams.get('tag'), '#9PP0V2RGY');
});
