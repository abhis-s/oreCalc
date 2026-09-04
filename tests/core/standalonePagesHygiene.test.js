import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Standalone Pages & Legal Decoupling Invariants', () => {
    const projectRoot = process.cwd();
    const standaloneRoutes = ['privacy', 'terms', 'licenses', 'legal', 'hero-journey'];

    test('workbox-config.js explicitly excludes all standalone legal pages and assets', () => {
        const wbContent = fs.readFileSync(path.join(projectRoot, 'workbox-config.js'), 'utf8');
        for (const route of standaloneRoutes) {
            assert.match(wbContent, new RegExp(`['"]\\*\\*/${route}/\\*\\*['"]`), `workbox-config.js must exclude **/${route}/**`);
        }
        assert.match(wbContent, /['"]\*\*\/js\/heroJourneyApp\.js['"]/, 'workbox-config.js must exclude **/js/heroJourneyApp.js');
    });

    test('service-worker-src.js explicitly bypasses fetch listener for standalone pages', () => {
        const swContent = fs.readFileSync(path.join(projectRoot, 'service-worker-src.js'), 'utf8');
        for (const route of standaloneRoutes) {
            assert.match(swContent, new RegExp(`url\\.pathname\\.includes\\('/${route}'\\)`), `service-worker-src.js must bypass /${route}`);
        }
    });

    test('_headers enforces strict zero-caching directives for all legal routes', () => {
        const headersContent = fs.readFileSync(path.join(projectRoot, '_headers'), 'utf8');
        const requiredRoutes = ['/privacy/*', '/terms/*', '/licenses/*', '/legal/*', '/de/privacy/*', '/de/terms/*'];
        for (const route of requiredRoutes) {
            assert.ok(headersContent.includes(route), `_headers must define rules for ${route}`);
        }
        assert.match(headersContent, /Cache-Control:\s*no-cache,\s*no-store,\s*must-revalidate/);
        assert.match(headersContent, /Pragma:\s*no-cache/);
        assert.match(headersContent, /Expires:\s*0/);
    });

    test('_headers enforces 6-month static asset caching and zero-stale dynamic revalidation', () => {
        const headersContent = fs.readFileSync(path.join(projectRoot, '_headers'), 'utf8');
        assert.match(headersContent, /\/assets\/\*[\s\S]*?Cache-Control:\s*public,\s*max-age=15552000,\s*immutable/, '_headers must set 6-month immutable cache for /assets/*');
        assert.match(headersContent, /\/\*\.html[\s\S]*?Cache-Control:\s*public,\s*max-age=0,\s*must-revalidate/, '_headers must revalidate HTML fresh');
        assert.match(headersContent, /\/service-worker\.js[\s\S]*?Cache-Control:\s*no-cache,\s*no-store,\s*must-revalidate/, '_headers must prevent caching service-worker.js');
    });

    test('modal partials configure lazy about:blank iframes to prevent startup preload leaks', () => {
        const privacyModal = fs.readFileSync(path.join(projectRoot, 'partials/modals/privacy.html'), 'utf8');
        const termsModal = fs.readFileSync(path.join(projectRoot, 'partials/modals/terms.html'), 'utf8');

        assert.match(privacyModal, /<iframe[^>]*src="about:blank"[^>]*loading="lazy"/);
        assert.match(termsModal, /<iframe[^>]*src="about:blank"[^>]*loading="lazy"/);
    });

    test('legal templates declare lightweight safe-area and theme metadata with zero emojis', () => {
        const legalFiles = [
            'legal/privacy-en.html',
            'legal/privacy-de.html',
            'legal/terms-en.html',
            'legal/terms-de.html',
            'legal/licenses.html'
        ];

        for (const relFile of legalFiles) {
            const content = fs.readFileSync(path.join(projectRoot, relFile), 'utf8');
            assert.match(content, /viewport-fit=cover/, `${relFile} must declare viewport-fit=cover`);
            assert.match(content, /<meta name="color-scheme" content="light dark">/, `${relFile} must declare color-scheme`);
            const emojiPattern = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}]/u;
            assert.ok(!emojiPattern.test(content), `${relFile} must contain zero emojis`);
        }
    });

    test('interactive application entry points maintain safe-area boundary without viewport-fit=cover', () => {
        const appPages = [
            'index.html',
            'hero-journey.html'
        ];

        for (const relFile of appPages) {
            const content = fs.readFileSync(path.join(projectRoot, relFile), 'utf8');
            assert.match(content, /<meta name="viewport" content="[^"]*width=device-width[^"]*">/, `${relFile} must declare responsive viewport`);
            assert.match(content, /interactive-widget=resizes-content/, `${relFile} must declare interactive-widget=resizes-content`);
            assert.ok(!content.includes('viewport-fit=cover'), `${relFile} must not declare viewport-fit=cover to prevent iOS status bar clipping`);
        }
    });
});
