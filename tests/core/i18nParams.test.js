import { test } from 'node:test';
import assert from 'node:assert/strict';
import { I18N_DYNAMIC_PARAMS, getDynamicTranslationArgs } from '../../js/i18n/i18nParams.js';

test('I18N_DYNAMIC_PARAMS registers expected parameter resolvers', () => {
    assert.ok(typeof I18N_DYNAMIC_PARAMS['app.supercellDisclaimer'] === 'function');
    assert.ok(typeof I18N_DYNAMIC_PARAMS['views.settings.bugReportInfo'] === 'function');
    assert.ok(typeof I18N_DYNAMIC_PARAMS['views.settings.bugReportPrivacyInfo'] === 'function');
});

test('getDynamicTranslationArgs resolves supercellDisclaimer for various languages', () => {
    const enArgs = getDynamicTranslationArgs('app.supercellDisclaimer', 'en');
    assert.equal(enArgs.url, 'https://supercell.com/en/fan-content-policy/');
    assert.equal(enArgs.displayUrl, 'supercell.com/en/fan-content-policy/');

    const deArgs = getDynamicTranslationArgs('app.supercellDisclaimer', 'de');
    assert.equal(deArgs.url, 'https://supercell.com/en/fan-content-policy/de/');
    assert.equal(deArgs.displayUrl, 'supercell.com/en/fan-content-policy/de/');

    const trArgs = getDynamicTranslationArgs('app.supercellDisclaimer', 'tr');
    assert.equal(trArgs.url, 'https://supercell.com/en/fan-content-policy/tr/');
    assert.equal(trArgs.displayUrl, 'supercell.com/en/fan-content-policy/tr/');

    const zhArgs = getDynamicTranslationArgs('app.supercellDisclaimer', 'zh');
    assert.equal(zhArgs.url, 'https://supercell.com/en/fan-content-policy/cn/');
    assert.equal(zhArgs.displayUrl, 'supercell.com/en/fan-content-policy/cn/');
});

test('getDynamicTranslationArgs resolves bugReportInfo with GitHub Issues link', () => {
    const args = getDynamicTranslationArgs('views.settings.bugReportInfo', 'en');
    assert.ok(args.link);
    assert.ok(args.link.includes('https://github.com/abhis-s/oreCalc/issues'));
    assert.ok(args.link.includes('GitHub Issues'));
    assert.ok(args.link.includes('class="theme-link"'));
});

test('getDynamicTranslationArgs resolves bugReportPrivacyInfo using getTranslation callback', () => {
    const mockGetTranslation = (key) => {
        if (key === 'views.settings.privacyPolicyText') return 'Datenschutzerklärung';
        return '';
    };
    const args = getDynamicTranslationArgs('views.settings.bugReportPrivacyInfo', 'de', mockGetTranslation);
    assert.ok(args.link);
    assert.ok(args.link.includes('id="bug-report-privacy-link"'));
    assert.ok(args.link.includes('Datenschutzerklärung'));
    assert.ok(args.link.includes('class="theme-link"'));
});

test('getDynamicTranslationArgs falls back to default Privacy Policy when getTranslation returns empty', () => {
    const args = getDynamicTranslationArgs('views.settings.bugReportPrivacyInfo', 'en', () => '');
    assert.ok(args.link.includes('Privacy Policy'));
});

test('getDynamicTranslationArgs returns empty object for unparameterized or unknown keys', () => {
    assert.deepEqual(getDynamicTranslationArgs('unknown.key.name', 'en'), {});
    assert.deepEqual(getDynamicTranslationArgs('nav.home', 'en'), {});
});
