import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderTownHallBadge } from '../../js/components/common/townHallBadge.js';

describe('Town Hall Badge Component Suite', () => {
    it('renders default markup with level 16 and medium size', () => {
        const html = renderTownHallBadge({ thLevel: 16 });

        assert.match(html, /class="th-badge th-badge--md"/);
        assert.match(html, /src="assets\/th\/th16\.png"/);
        assert.match(html, /alt="Town Hall 16"/);
        assert.match(html, /<span class="th-badge__level">16<\/span>/);
        assert.doesNotMatch(html, /is-silhouette/);
    });

    it('handles numeric string conversion and invalid fallback', () => {
        const fromStr = renderTownHallBadge({ thLevel: '14' });
        assert.match(fromStr, /src="assets\/th\/th14\.png"/);
        assert.match(fromStr, /<span class="th-badge__level">14<\/span>/);

        const fromInvalid = renderTownHallBadge({ thLevel: 'invalid' });
        assert.match(fromInvalid, /src="assets\/th\/th1\.png"/);
        assert.match(fromInvalid, /<span class="th-badge__level">1<\/span>/);
    });

    it('supports all size modifiers (xs, sm, md, lg)', () => {
        const xs = renderTownHallBadge({ thLevel: 15, size: 'xs' });
        assert.match(xs, /class="th-badge th-badge--xs"/);

        const sm = renderTownHallBadge({ thLevel: 15, size: 'sm' });
        assert.match(sm, /class="th-badge th-badge--sm"/);

        const md = renderTownHallBadge({ thLevel: 15, size: 'md' });
        assert.match(md, /class="th-badge th-badge--md"/);

        const lg = renderTownHallBadge({ thLevel: 15, size: 'lg' });
        assert.match(lg, /class="th-badge th-badge--lg"/);
    });

    it('attaches custom className and optional DOM id attribute', () => {
        const withClassAndId = renderTownHallBadge({
            thLevel: 13,
            className: 'account-card-th test-hook',
            id: 'my-th-badge'
        });

        assert.match(withClassAndId, /id="my-th-badge"/);
        assert.match(withClassAndId, /class="th-badge th-badge--md account-card-th test-hook"/);
    });

    it('omits level overlay when showLevel is false', () => {
        const noLevel = renderTownHallBadge({ thLevel: 12, showLevel: false });

        assert.match(noLevel, /src="assets\/th\/th12\.png"/);
        assert.doesNotMatch(noLevel, /class="th-badge__level"/);
    });

    it('renders silhouette class when isSilhouette is true', () => {
        const silhouette = renderTownHallBadge({ thLevel: 16, isSilhouette: true });

        assert.match(silhouette, /class="th-badge__img is-silhouette"/);
    });

    it('allows custom image source and alt text overrides', () => {
        const custom = renderTownHallBadge({
            thLevel: 17,
            imgSrc: 'custom/assets/th_special.png',
            imgAlt: 'Special Town Hall 17'
        });

        assert.match(custom, /src="custom\/assets\/th_special\.png"/);
        assert.match(custom, /alt="Special Town Hall 17"/);
        assert.match(custom, /<span class="th-badge__level">17<\/span>/);
    });
});
