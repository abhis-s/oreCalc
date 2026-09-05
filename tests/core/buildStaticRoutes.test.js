import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');

describe('Static Build Routes Verification Suite', () => {
    test('confirms dist/en/ directory and dist/en/index.html do not exist', () => {
        const enDir = path.join(distDir, 'en');
        const enIndex = path.join(distDir, 'en', 'index.html');
        assert.equal(fs.existsSync(enDir), false);
        assert.equal(fs.existsSync(enIndex), false);
    });

    test('verifies root dist/index.html is canonical English entry point', () => {
        const rootIndex = path.join(distDir, 'index.html');
        assert.equal(fs.existsSync(rootIndex), true);

        const content = fs.readFileSync(rootIndex, 'utf8');
        assert.ok(content.includes('<html lang="en">'));
        assert.ok(content.includes('<link rel="canonical" href="https://orecalc.tech/">'));
        assert.ok(content.includes('<link rel="alternate" hreflang="en" href="https://orecalc.tech/" />'));
        assert.ok(content.includes('<link rel="alternate" hreflang="x-default" href="https://orecalc.tech/" />'));
        assert.ok(content.includes('<link rel="alternate" hreflang="de" href="https://orecalc.tech/de/" />'));
        assert.ok(content.includes('<link rel="alternate" hreflang="tr" href="https://orecalc.tech/tr/" />'));
        assert.ok(content.includes('<link rel="alternate" hreflang="zh" href="https://orecalc.tech/zh/" />'));
    });

    test('verifies non-English localized index.html routes exist with correct canonical URLs', () => {
        const languages = [
            { code: 'de', canonical: 'https://orecalc.tech/de/' },
            { code: 'tr', canonical: 'https://orecalc.tech/tr/' },
            { code: 'zh', canonical: 'https://orecalc.tech/zh/' }
        ];

        for (const { code, canonical } of languages) {
            const indexPath = path.join(distDir, code, 'index.html');
            assert.equal(fs.existsSync(indexPath), true, `dist/${code}/index.html must exist`);

            const content = fs.readFileSync(indexPath, 'utf8');
            assert.ok(content.includes(`<html lang="${code}">`), `dist/${code}/index.html should have lang="${code}"`);
            assert.ok(content.includes(`<link rel="canonical" href="${canonical}">`), `Canonical URL must match ${canonical}`);
        }
    });

    test('verifies dist/sitemap.xml has clean URLs without /en/ or legal page entries', () => {
        const sitemapPath = path.join(distDir, 'sitemap.xml');
        assert.equal(fs.existsSync(sitemapPath), true);

        const content = fs.readFileSync(sitemapPath, 'utf8');
        assert.ok(content.includes('<loc>https://orecalc.tech/</loc>'));
        assert.ok(content.includes('<loc>https://orecalc.tech/de/</loc>'));
        assert.ok(content.includes('<loc>https://orecalc.tech/tr/</loc>'));
        assert.ok(content.includes('<loc>https://orecalc.tech/zh/</loc>'));
        assert.equal(content.includes('<loc>https://orecalc.tech/en/</loc>'), false);
        assert.equal(content.includes('<loc>https://orecalc.tech/en</loc>'), false);
        assert.equal(content.includes('<loc>https://orecalc.tech/privacy/</loc>'), false);
        assert.equal(content.includes('<loc>https://orecalc.tech/terms/</loc>'), false);
        assert.equal(content.includes('<loc>https://orecalc.tech/licenses/</loc>'), false);
    });

    test('verifies standalone hero-journey routes exist across all supported locales', () => {
        const hjRoutes = [
            { path: path.join(distDir, 'hero-journey', 'index.html'), lang: 'en', canonical: 'https://orecalc.tech/hero-journey/' },
            { path: path.join(distDir, 'de', 'hero-journey', 'index.html'), lang: 'de', canonical: 'https://orecalc.tech/de/hero-journey/' },
            { path: path.join(distDir, 'tr', 'hero-journey', 'index.html'), lang: 'tr', canonical: 'https://orecalc.tech/tr/hero-journey/' },
            { path: path.join(distDir, 'zh', 'hero-journey', 'index.html'), lang: 'zh', canonical: 'https://orecalc.tech/zh/hero-journey/' }
        ];

        for (const { path: routePath, lang, canonical } of hjRoutes) {
            assert.equal(fs.existsSync(routePath), true, `${routePath} must exist in dist`);
            const content = fs.readFileSync(routePath, 'utf8');
            assert.ok(content.includes(`<html lang="${lang}">`), `Should declare lang="${lang}"`);
            assert.ok(content.includes(`<link rel="canonical" href="${canonical}">`), `Canonical must be ${canonical}`);
        }
    });

    test('verifies dist/sitemap.xml contains all canonical hero-journey tool routes', () => {
        const sitemapPath = path.join(distDir, 'sitemap.xml');
        const content = fs.readFileSync(sitemapPath, 'utf8');

        assert.ok(content.includes('<loc>https://orecalc.tech/hero-journey/</loc>'));
        assert.ok(content.includes('<loc>https://orecalc.tech/de/hero-journey/</loc>'));
        assert.ok(content.includes('<loc>https://orecalc.tech/tr/hero-journey/</loc>'));
        assert.ok(content.includes('<loc>https://orecalc.tech/zh/hero-journey/</loc>'));
    });

    test('verifies standalone ore-calculator routes exist across all supported locales', () => {
        const oreRoutes = [
            { path: path.join(distDir, 'ore-calculator', 'index.html'), lang: 'en', canonical: 'https://orecalc.tech/ore-calculator/' },
            { path: path.join(distDir, 'de', 'ore-calculator', 'index.html'), lang: 'de', canonical: 'https://orecalc.tech/de/ore-calculator/' },
            { path: path.join(distDir, 'tr', 'ore-calculator', 'index.html'), lang: 'tr', canonical: 'https://orecalc.tech/tr/ore-calculator/' },
            { path: path.join(distDir, 'zh', 'ore-calculator', 'index.html'), lang: 'zh', canonical: 'https://orecalc.tech/zh/ore-calculator/' }
        ];

        for (const { path: routePath, lang, canonical } of oreRoutes) {
            assert.equal(fs.existsSync(routePath), true, `${routePath} must exist in dist`);
            const content = fs.readFileSync(routePath, 'utf8');
            assert.ok(content.includes(`<html lang="${lang}">`), `Should declare lang="${lang}"`);
            assert.ok(content.includes(`<link rel="canonical" href="${canonical}">`), `Canonical must be ${canonical}`);
        }
    });

    test('verifies dist/sitemap.xml contains all canonical ore-calculator tool routes', () => {
        const sitemapPath = path.join(distDir, 'sitemap.xml');
        const content = fs.readFileSync(sitemapPath, 'utf8');

        assert.ok(content.includes('<loc>https://orecalc.tech/ore-calculator/</loc>'));
        assert.ok(content.includes('<loc>https://orecalc.tech/de/ore-calculator/</loc>'));
        assert.ok(content.includes('<loc>https://orecalc.tech/tr/ore-calculator/</loc>'));
        assert.ok(content.includes('<loc>https://orecalc.tech/zh/ore-calculator/</loc>'));
    });

    test('verifies dist/_redirects exists and configures 301 redirects for legacy routes', () => {
        const redirectsPath = path.join(distDir, '_redirects');
        assert.equal(fs.existsSync(redirectsPath), true);

        const content = fs.readFileSync(redirectsPath, 'utf8');
        assert.ok(content.includes('/en/*    /:splat    301') || content.includes('/en/*'));
        assert.ok(content.includes('/en      /          301') || content.includes('/en /'));
        assert.ok(content.includes('/ore-calculator   /ore-calculator/        301'));
    });

    test('verifies legal routes and static legal stylesheet/script assets exist with noindex meta in dist', () => {
        assert.equal(fs.existsSync(path.join(distDir, 'legal', 'legal.css')), true);
        assert.equal(fs.existsSync(path.join(distDir, 'legal', 'legal.js')), true);

        const privacyHtml = fs.readFileSync(path.join(distDir, 'privacy', 'index.html'), 'utf8');
        const termsHtml = fs.readFileSync(path.join(distDir, 'terms', 'index.html'), 'utf8');
        const licensesHtml = fs.readFileSync(path.join(distDir, 'licenses', 'index.html'), 'utf8');

        assert.ok(privacyHtml.includes('<meta name="robots" content="noindex, follow">'));
        assert.ok(termsHtml.includes('<meta name="robots" content="noindex, follow">'));
        assert.ok(licensesHtml.includes('<meta name="robots" content="noindex, follow">'));
    });

    test('verifies dist/404.html exists with noindex meta and standalone error template', () => {
        const errorHtmlPath = path.join(distDir, '404.html');
        assert.equal(fs.existsSync(errorHtmlPath), true);

        const errorHtml = fs.readFileSync(errorHtmlPath, 'utf8');
        assert.ok(errorHtml.includes('<meta name="robots" content="noindex, follow">'));
        assert.ok(errorHtml.includes('<div class="error-code">404</div>'));
        assert.ok(errorHtml.includes('Page Not Found'));
    });
});
