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

    test('verifies dist/sitemap.xml has clean URLs without /en/ entries', () => {
        const sitemapPath = path.join(distDir, 'sitemap.xml');
        assert.equal(fs.existsSync(sitemapPath), true);

        const content = fs.readFileSync(sitemapPath, 'utf8');
        assert.ok(content.includes('<loc>https://orecalc.tech/</loc>'));
        assert.ok(content.includes('<loc>https://orecalc.tech/de/</loc>'));
        assert.ok(content.includes('<loc>https://orecalc.tech/tr/</loc>'));
        assert.ok(content.includes('<loc>https://orecalc.tech/zh/</loc>'));
        assert.equal(content.includes('<loc>https://orecalc.tech/en/</loc>'), false);
        assert.equal(content.includes('<loc>https://orecalc.tech/en</loc>'), false);
    });
});
