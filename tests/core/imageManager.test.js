import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getImage } from '../../js/utils/imageManager.js';

describe('Image Manager & Asset Normalization Suite', () => {
    it('normalizes unrooted relative asset paths to root-relative paths', () => {
        const markupTh = getImage('assets/th/th16.png');
        assert.match(markupTh, /src="\/assets\/th\/th16/);
        assert.doesNotMatch(markupTh, /src="assets\/th\/th16/);

        const markupOre = getImage('assets/shiny_ore.png');
        assert.match(markupOre, /src="\/assets\/shiny_ore/);
        assert.doesNotMatch(markupOre, /src="assets\/shiny_ore/);

        const markupClanWar = getImage('assets/resources/clanWar.png');
        assert.match(markupClanWar, /src="\/assets\/resources\/clanWar/);
    });

    it('preserves already root-relative asset paths', () => {
        const markup = getImage('/assets/th/th19.png');
        assert.match(markup, /src="\/assets\/th\/th19/);
    });

    it('preserves external HTTP and HTTPS URLs', () => {
        const externalUrl = 'https://api-assets.clashofclans.com/leaguetiers/125/yyYo5DUFeFBZvmMEQh0ZxvG-1sUOZ_S3kDMB7RllXX0.png';
        const markup = getImage(externalUrl, 'custom-class', 'standard', 'League Icon');

        assert.match(markup, new RegExp(`src="${externalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
        assert.match(markup, /class="custom-class"/);
        assert.match(markup, /alt="League Icon"/);
    });

    it('generates responsive picture markup for subfolder assets', () => {
        const equipMarkup = getImage('assets/equipment/archer_queen/AQ_giant_arrow.png', 'equip-img', 'thumbnail', 'Giant Arrow');

        assert.match(equipMarkup, /<picture class="equip-img">/);
        assert.match(equipMarkup, /type="image\/avif"/);
        assert.match(equipMarkup, /type="image\/webp"/);
        assert.match(equipMarkup, /src="\/assets\/equipment\/archer_queen\/AQ_giant_arrow-100\.webp"/);
    });

    it('escapes special characters in alt text, class names, and attributes', () => {
        const markup = getImage('assets/shiny_ore.png', 'class"onload="alert(1)', 'standard', '<img onerror="alert(1)">');

        assert.doesNotMatch(markup, /onload="alert/);
        assert.doesNotMatch(markup, /<img onerror=/);
        assert.match(markup, /&lt;img onerror=&quot;alert\(1\)&quot;&gt;/);
    });

    it('renders standalone img tags for pre-compiled emote WebPs and runtime blob URLs', () => {
        const emoteMarkup = getImage('assets/avatars/emotes/barbarian_laugh-100-static.webp', 'avatar-img', 'thumbnail', 'Emote');
        assert.doesNotMatch(emoteMarkup, /<picture/);
        assert.match(emoteMarkup, /src="\/assets\/avatars\/emotes\/barbarian_laugh-100-static\.webp"/);

        const blobUrl = 'blob:https://clashcalc.com/12345678-1234-1234-1234-123456789abc';
        const blobMarkup = getImage(blobUrl, 'avatar-img', 'thumbnail', 'Animated Emote');
        assert.doesNotMatch(blobMarkup, /<picture/);
        assert.ok(blobMarkup.includes(`src="${blobUrl}"`));
    });
});
