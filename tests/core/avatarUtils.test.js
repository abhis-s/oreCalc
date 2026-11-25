import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
    CLASSIC_AVATARS,
    EMOTE_AVATARS,
    ALL_AVATARS,
    BONUS_AVATARS,
    EMOTE_ANIMATION_DURATION_MS,
    isEmoteAvatar,
    isClassicAvatar,
    isBonusAvatar,
    getAvatarSrc,
    getAvatarLockStatus,
    playAvatarAnimationOnce,
    stopAvatarAnimation
} from '../../js/utils/avatarUtils.js';

const require = createRequire(import.meta.url);
const { AUTH_CONSTANTS } = require('../../server/constants.js');

test('avatarUtils - registry structural invariants and client/server parity', () => {
    assert.ok(CLASSIC_AVATARS.length > 0);
    assert.ok(EMOTE_AVATARS.length > 0);
    assert.equal(ALL_AVATARS.length, CLASSIC_AVATARS.length + EMOTE_AVATARS.length);
    assert.equal(new Set(ALL_AVATARS).size, ALL_AVATARS.length);

    // Classic and emote registries must be strictly disjoint
    for (const classic of CLASSIC_AVATARS) {
        assert.equal(isClassicAvatar(classic), true);
        assert.equal(isEmoteAvatar(classic), false);
        assert.equal(isBonusAvatar(classic), false);
    }

    for (const emote of EMOTE_AVATARS) {
        assert.equal(isEmoteAvatar(emote), true);
        assert.equal(isClassicAvatar(emote), false);
    }

    // Bonus avatars must be a subset of emote avatars
    for (const bonus of BONUS_AVATARS) {
        assert.equal(isEmoteAvatar(bonus), true);
        assert.equal(isBonusAvatar(bonus), true);
    }

    // Client and server avatar registries must stay in strict parity
    assert.deepEqual([...ALL_AVATARS].sort(), [...AUTH_CONSTANTS.VALID_AVATARS].sort());
    assert.deepEqual([...BONUS_AVATARS].sort(), [...AUTH_CONSTANTS.BONUS_AVATARS].sort());

    assert.equal(isClassicAvatar('unknown'), false);
    assert.equal(isClassicAvatar(''), false);
    assert.equal(isEmoteAvatar(''), false);
    assert.equal(isBonusAvatar(''), false);
});

test('avatarUtils - getAvatarSrc resolves classic avatars as PNGs', () => {
    assert.equal(getAvatarSrc('archer'), '/assets/avatars/archer.png');
    assert.equal(getAvatarSrc('builder', { animated: true }), '/assets/avatars/builder.png');
    assert.equal(getAvatarSrc('giant', { size: '200' }), '/assets/avatars/giant.png');
    // Fallback for unknown avatar
    assert.equal(getAvatarSrc('nonexistent'), '/assets/avatars/archer.png');
});

test('avatarUtils - getAvatarSrc resolves emotes to static or animated WebP', () => {
    // Default: static 100px WebP
    assert.equal(
        getAvatarSrc('barbarian_laugh'),
        '/assets/avatars/emotes/barbarian_laugh-100-static.webp'
    );

    // Animated 100px WebP
    assert.equal(
        getAvatarSrc('barbarian_laugh', { animated: true }),
        '/assets/avatars/emotes/barbarian_laugh-100.webp'
    );

    // Static 200px WebP
    assert.equal(
        getAvatarSrc('aq_ranked_bonus', { size: '200' }),
        '/assets/avatars/emotes/aq_ranked_bonus-200-static.webp'
    );

    // Animated 200px WebP
    assert.equal(
        getAvatarSrc('aq_ranked_bonus', { animated: true, size: '200' }),
        '/assets/avatars/emotes/aq_ranked_bonus-200.webp'
    );
});

test('avatarUtils - playAvatarAnimationOnce lifecycle and non-cancellation contract', async () => {
    assert.equal(EMOTE_ANIMATION_DURATION_MS, 2417);

    // Rejects classic or invalid avatars
    assert.equal(playAvatarAnimationOnce(null, 'barbarian_laugh'), false);
    assert.equal(playAvatarAnimationOnce({ tagName: 'IMG' }, 'archer'), false);

    let currentSrc = '';
    const classListSet = new Set();
    const fakeImg = {
        tagName: 'IMG',
        isConnected: true,
        classList: {
            add(c) { classListSet.add(c); },
            remove(c) { classListSet.delete(c); },
            contains(c) { return classListSet.has(c); }
        },
        setAttribute(name, val) {
            if (name === 'src') currentSrc = val;
        },
        getAttribute(name) {
            return name === 'src' ? currentSrc : null;
        }
    };

    const origFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = async (url) => {
        fetchCount += 1;
        assert.equal(String(url).includes('?play='), false);
        return {
            ok: true,
            blob: async () => new Blob(['fake-webp'], { type: 'image/webp' })
        };
    };

    try {
        // First trigger on non-bonus emote: should fire, cache Blob without ?play=, set .is-animating, NOT .is-popout
        const fired1 = playAvatarAnimationOnce(fakeImg, 'barbarian_laugh', '100');
        assert.equal(fired1, true);
        await new Promise((r) => setTimeout(r, 10));
        assert.ok(currentSrc.startsWith('blob:') || currentSrc === '/assets/avatars/emotes/barbarian_laugh-100.webp');
        assert.equal(currentSrc.includes('?play='), false);
        assert.ok(fakeImg._avatarAnimTimer);
        assert.ok(fakeImg.classList.contains('is-animating'));
        assert.equal(fakeImg.classList.contains('is-popout'), false);
        assert.equal(fetchCount, 1);

        // Second trigger while active: MUST NOT CANCEL or restart (returns false)
        const initialTimer = fakeImg._avatarAnimTimer;
        const fired2 = playAvatarAnimationOnce(fakeImg, 'barbarian_laugh', '100');
        assert.equal(fired2, false);
        assert.equal(fakeImg._avatarAnimTimer, initialTimer);
        assert.ok(fakeImg.classList.contains('is-animating'));
        assert.equal(fakeImg.classList.contains('is-popout'), false);

        // Manual stop restores static poster and clears timer and classes
        stopAvatarAnimation(fakeImg, 'barbarian_laugh', '100');
        assert.equal(fakeImg._avatarAnimTimer, null);
        assert.equal(currentSrc, '/assets/avatars/emotes/barbarian_laugh-100-static.webp');
        assert.equal(fakeImg.classList.contains('is-animating'), false);
        assert.equal(fakeImg.classList.contains('is-popout'), false);

        // Replaying the same emote reuses cached Blob with zero additional network requests
        const firedAgain = playAvatarAnimationOnce(fakeImg, 'barbarian_laugh', '100');
        assert.equal(firedAgain, true);
        await new Promise((r) => setTimeout(r, 10));
        assert.equal(fetchCount, 1);
        stopAvatarAnimation(fakeImg, 'barbarian_laugh', '100');

        // Trigger on BONUS emote: MUST set BOTH .is-animating AND .is-popout
        const fired3 = playAvatarAnimationOnce(fakeImg, 'dd_ranked_bonus', '100');
        assert.equal(fired3, true);
        await new Promise((r) => setTimeout(r, 10));
        assert.ok(fakeImg.classList.contains('is-animating'));
        assert.ok(fakeImg.classList.contains('is-popout'));
        stopAvatarAnimation(fakeImg, 'dd_ranked_bonus', '100');
        assert.equal(fakeImg.classList.contains('is-animating'), false);
        assert.equal(fakeImg.classList.contains('is-popout'), false);
    } finally {
        globalThis.fetch = origFetch;
    }
});

test('avatarUtils - getAvatarLockStatus evaluates milestone locks correctly', () => {
    // Non-bonus avatars are always unlocked
    assert.equal(getAvatarLockStatus('archer').isLocked, false);
    assert.equal(getAvatarLockStatus('barbarian_laugh').isLocked, false);
    assert.equal(getAvatarLockStatus('unknown').isLocked, false);

    // BK: Requires TH 15+
    const bkNoVillage = getAvatarLockStatus('bk_ranked_bonus', {});
    assert.equal(bkNoVillage.isLocked, true);
    assert.equal(bkNoVillage.milestoneType, 'th');
    assert.equal(bkNoVillage.actionType, 'link_village');
    assert.equal(bkNoVillage.reqLabelKey, 'entities.defenses.townHall');
    assert.equal(bkNoVillage.progressKey, 'auth.unlockRequirement.bkProgressNone');

    const bkTh14 = getAvatarLockStatus('bk_ranked_bonus', { playerProfile: { townHallLevel: 14 } });
    assert.equal(bkTh14.isLocked, true);
    assert.equal(bkTh14.progressParams.current, 14);
    assert.equal(bkTh14.progressParams.required, 15);

    const bkTh15 = getAvatarLockStatus('bk_ranked_bonus', { playerProfile: { townHallLevel: 15 } });
    assert.equal(bkTh15.isLocked, false);

    const bkTh17 = getAvatarLockStatus('bk_ranked_bonus', { playerProfile: { townHallLevel: 17 } });
    assert.equal(bkTh17.isLocked, false);

    // AQ: Requires >= 1 passkey
    const aqNoPasskeys = getAvatarLockStatus('aq_ranked_bonus', { passkeys: [] });
    assert.equal(aqNoPasskeys.isLocked, true);
    assert.equal(aqNoPasskeys.milestoneType, 'passkey');
    assert.equal(aqNoPasskeys.actionType, 'add_passkey');
    assert.equal(aqNoPasskeys.reqLabelKey, 'auth.passkeys');
    assert.equal(aqNoPasskeys.progressParams.count, 0);

    const aqWithPasskey = getAvatarLockStatus('aq_ranked_bonus', { passkeys: [{ credentialID: 'cred1' }] });
    assert.equal(aqWithPasskey.isLocked, false);

    // DD: Requires isSupporter === true
    const ddNotSupporter = getAvatarLockStatus('dd_ranked_bonus', { user: { isSupporter: false } });
    assert.equal(ddNotSupporter.isLocked, true);
    assert.equal(ddNotSupporter.milestoneType, 'supporter');
    assert.equal(ddNotSupporter.actionType, 'supporter');
    assert.equal(ddNotSupporter.reqLabelKey, 'auth.unlockRequirement.ddLabel');

    const ddSupporter = getAvatarLockStatus('dd_ranked_bonus', { user: { isSupporter: true } });
    assert.equal(ddSupporter.isLocked, false);
});
