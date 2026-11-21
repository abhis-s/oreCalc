import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    escapeHTML,
    sanitizeHTML,
    toCamelCase,
    toKebabCase
} from '../../js/utils/stringUtils.js';
import { sanitizeImageUrl } from '../../js/core/playerStorageSanitizer.js';

describe('String Utilities, Sanitization & Security Hardening Suite', () => {
    describe('1. escapeHTML', () => {
        it('preserves numeric zero and boolean false values without conversion to empty string', () => {
            assert.equal(escapeHTML(0), '0');
            assert.equal(escapeHTML(false), 'false');
            assert.equal(escapeHTML(42), '42');
        });

        it('safely handles null and undefined values by returning empty string', () => {
            assert.equal(escapeHTML(null), '');
            assert.equal(escapeHTML(undefined), '');
            assert.equal(escapeHTML(''), '');
        });

        it('escapes all HTML special characters including backticks', () => {
            const raw = '<script>alert(`XSS & "fun" \'o\'`)</script>';
            const escaped = escapeHTML(raw);
            assert.equal(escaped, '&lt;script&gt;alert(&#96;XSS &amp; &quot;fun&quot; &#39;o&#39;&#96;)&lt;/script&gt;');
        });
    });

    describe('2. toCamelCase and toKebabCase', () => {
        it('correctly converts words, underscores, and dashes to camelCase', () => {
            assert.equal(toCamelCase('Giant Gauntlet'), 'giantGauntlet');
            assert.equal(toCamelCase('barbarian_king'), 'barbarianKing');
            assert.equal(toCamelCase('grand-warden'), 'grandWarden');
            assert.equal(toCamelCase('haste'), 'haste');
        });

        it('preserves already-camelCased and PascalCased strings properly', () => {
            assert.equal(toCamelCase('giantGauntlet'), 'giantGauntlet');
            assert.equal(toCamelCase('barbarianKing'), 'barbarianKing');
            assert.equal(toCamelCase('GiantGauntlet'), 'giantGauntlet');
        });

        it('converts camelCase and space-separated strings to kebab-case', () => {
            assert.equal(toKebabCase('giantGauntlet'), 'giant-gauntlet');
            assert.equal(toKebabCase('Raid Starry'), 'raid-starry');
            assert.equal(toKebabCase('barbarian_king'), 'barbarian-king');
        });
    });

    describe('3. sanitizeHTML & DOM XSS Hardening', () => {
        it('strips dangerous script, style, and iframe tags', () => {
            const malicious = 'Hello <script>alert(1)</script><style>body{color:red}</style><iframe src="x"></iframe>World';
            const cleaned = sanitizeHTML(malicious);
            assert.ok(!cleaned.includes('<script'));
            assert.ok(!cleaned.includes('<style'));
            assert.ok(!cleaned.includes('<iframe'));
            assert.ok(cleaned.includes('Hello'));
            assert.ok(cleaned.includes('World'));
        });

        it('permits safe semantic formatting tags', () => {
            const safe = '<span>Text <strong>bold</strong> <em>italic</em> <code>code</code></span>';
            const cleaned = sanitizeHTML(safe);
            assert.ok(cleaned.includes('<strong>bold</strong>'));
            assert.ok(cleaned.includes('<em>italic</em>'));
        });

        it('rejects protocol-relative and javascript: hrefs on anchor tags', () => {
            const payload = '<a href="//malicious.com/phish">External</a><a href="javascript:alert(1)">Click</a><a href="https://example.com">Legit</a>';
            const cleaned = sanitizeHTML(payload);
            assert.ok(!cleaned.includes('href="//malicious.com'));
            assert.ok(!cleaned.includes('javascript:'));
            assert.ok(cleaned.includes('rel="noopener noreferrer"'));
        });

        it('preserves allowlisted modal link ids and classes while stripping disallowed ids', () => {
            const payload = '<a href="#" id="bug-report-privacy-link" class="theme-link">Privacy</a><a href="#" id="evil-clobber" class="theme-link open-inaccuracies-link">Report</a>';
            const cleaned = sanitizeHTML(payload);
            assert.ok(cleaned.includes('id="bug-report-privacy-link"'));
            assert.ok(cleaned.includes('open-inaccuracies-link'));
            assert.ok(!cleaned.includes('evil-clobber'));
        });
    });

    describe('4. sanitizeImageUrl CDN & Asset Allowlisting', () => {
        it('permits Supercell CDN and local assets URLs', () => {
            const cdnUrl = 'https://api-assets.clashofclans.com/badges/512/badge.png';
            const localAsset = 'assets/equipment/BK_rage_vial.png';
            const rootAsset = '/assets/buildings/town_hall_17.png';

            assert.equal(sanitizeImageUrl(cdnUrl), cdnUrl);
            assert.equal(sanitizeImageUrl(localAsset), localAsset);
            assert.equal(sanitizeImageUrl(rootAsset), rootAsset);
        });

        it('rejects data URIs, javascript schemes, and arbitrary third-party hosts', () => {
            assert.equal(sanitizeImageUrl('data:image/svg+xml;base64,PHN2Zz4='), '');
            assert.equal(sanitizeImageUrl('javascript:alert(1)'), '');
            assert.equal(sanitizeImageUrl('http://attacker.com/evil.png'), '');
            assert.equal(sanitizeImageUrl('https://evil.org/badge.png'), '');
            assert.equal(sanitizeImageUrl(null), '');
            assert.equal(sanitizeImageUrl(''), '');
        });
    });
});
