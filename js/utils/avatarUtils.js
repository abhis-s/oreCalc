/**
 * avatarUtils.js
 * Centralized registry and helper functions for classic and animated emote avatars.
 */

export const CLASSIC_AVATARS = Object.freeze([
    'archer',
    'builder',
    'giant',
    'goblin',
    'golem',
    'hogRider',
    'hog',
    'skeleton'
]);

export const EMOTE_AVATARS = Object.freeze([
    'barbarian_thumbs_up',
    'barbarian_angry',
    'barbarian_sad',
    'barbarian_laugh',
    'barbarian_confused',
    'skeleton_league',
    'barbarian_league',
    'archer_league',
    'wizard_league',
    'bk_ranked_bonus',
    'valkyrie_league',
    'witch_league',
    'golem_league',
    'pekka_league',
    'aq_ranked_bonus',
    'titan_league',
    'dragon_league',
    'electro_dragon_league',
    'super_dragon_league',
    'dd_ranked_bonus'
]);

export const ALL_AVATARS = Object.freeze([
    ...CLASSIC_AVATARS,
    ...EMOTE_AVATARS
]);

export const BONUS_AVATARS = Object.freeze([
    'bk_ranked_bonus',
    'aq_ranked_bonus',
    'dd_ranked_bonus'
]);

const EMOTE_SET = new Set(EMOTE_AVATARS);
const CLASSIC_SET = new Set(CLASSIC_AVATARS);
const BONUS_SET = new Set(BONUS_AVATARS);

/**
 * Checks whether an avatar identifier is an animated emote.
 *
 * @param {string} avatar - Avatar identifier.
 * @returns {boolean} True if avatar is an emote.
 */
export function isEmoteAvatar(avatar) {
    if (!avatar || typeof avatar !== 'string') return false;
    return EMOTE_SET.has(avatar);
}

/**
 * Checks whether an avatar identifier is a ranked bonus emote eligible for the popout effect.
 *
 * @param {string} avatar - Avatar identifier.
 * @returns {boolean} True if avatar is a bonus emote.
 */
export function isBonusAvatar(avatar) {
    if (!avatar || typeof avatar !== 'string') return false;
    return BONUS_SET.has(avatar);
}

/**
 * Checks whether an avatar identifier is a classic static avatar.
 *
 * @param {string} avatar - Avatar identifier.
 * @returns {boolean} True if avatar is a classic avatar.
 */
export function isClassicAvatar(avatar) {
    if (!avatar || typeof avatar !== 'string') return false;
    return CLASSIC_SET.has(avatar);
}

/**
 * Evaluates whether an avatar is locked based on user progress and milestones.
 *
 * @param {string} avatar - Avatar identifier.
 * @param {{
 *     user?: { isSupporter?: boolean } | null,
 *     playerProfile?: { townHallLevel?: number | string } | null,
 *     passkeys?: Array<any> | null,
 *     townHallLevel?: number,
 *     passkeysCount?: number,
 *     isSupporter?: boolean
 * }} [context={}] - Current user and village milestone context.
 * @returns {{
 *     isLocked: boolean,
 *     milestoneType: 'th' | 'passkey' | 'supporter' | null,
 *     titleKey: string,
 *     descriptionKey: string,
 *     reqLabelKey: string,
 *     progressKey: string,
 *     progressParams: Record<string, any>,
 *     actionType: 'link_village' | 'add_passkey' | 'supporter' | null
 * }}
 */
export function getAvatarLockStatus(avatar, context = {}) {
    if (!isBonusAvatar(avatar)) {
        return {
            isLocked: false,
            milestoneType: null,
            titleKey: '',
            descriptionKey: '',
            reqLabelKey: '',
            progressKey: '',
            progressParams: {},
            actionType: null
        };
    }

    if (avatar === 'bk_ranked_bonus') {
        const rawTh = context?.townHallLevel !== undefined ? context.townHallLevel : context?.playerProfile?.townHallLevel;
        const th = Math.max(0, Number(rawTh) || 0);
        const isLocked = th < 15;
        return {
            isLocked,
            milestoneType: 'th',
            titleKey: 'auth.avatars.bkRankedBonus',
            descriptionKey: 'auth.unlockRequirement.bkDescription',
            reqLabelKey: 'entities.defenses.townHall',
            progressKey: th > 0 ? 'auth.unlockRequirement.bkProgress' : 'auth.unlockRequirement.bkProgressNone',
            progressParams: th > 0 ? { current: th, required: 15 } : {},
            actionType: 'link_village'
        };
    }

    if (avatar === 'aq_ranked_bonus') {
        const count = context?.passkeysCount !== undefined
            ? context.passkeysCount
            : (Array.isArray(context?.passkeys) ? context.passkeys.length : 0);
        const isLocked = count < 1;
        return {
            isLocked,
            milestoneType: 'passkey',
            titleKey: 'auth.avatars.aqRankedBonus',
            descriptionKey: 'auth.unlockRequirement.aqDescription',
            reqLabelKey: 'auth.passkeys',
            progressKey: 'auth.unlockRequirement.aqProgress',
            progressParams: { count },
            actionType: 'add_passkey'
        };
    }

    if (avatar === 'dd_ranked_bonus') {
        const isSupporter = context?.isSupporter !== undefined
            ? Boolean(context.isSupporter)
            : Boolean(context?.user?.isSupporter);
        const isLocked = !isSupporter;
        return {
            isLocked,
            milestoneType: 'supporter',
            titleKey: 'auth.avatars.ddRankedBonus',
            descriptionKey: 'auth.unlockRequirement.ddDescription',
            reqLabelKey: 'auth.unlockRequirement.ddLabel',
            progressKey: 'auth.unlockRequirement.ddProgress',
            progressParams: { statusKey: isSupporter ? 'auth.supporter.statusActive' : 'auth.supporter.statusInactive' },
            actionType: 'supporter'
        };
    }

    return {
        isLocked: false,
        milestoneType: null,
        titleKey: '',
        descriptionKey: '',
        reqLabelKey: '',
        progressKey: '',
        progressParams: {},
        actionType: null
    };
}

/**
 * Resolves the image source URL for a given avatar.
 *
 * @param {string} avatar - Avatar identifier ('archer', 'barbarian_laugh', etc.).
 * @param {object} [options]
 * @param {boolean} [options.animated=false] - Whether to serve the animated WebP or static poster (emotes only).
 * @param {string|number} [options.size='100'] - Target dimension ('100' or '200').
 * @returns {string} Relative URL to the avatar asset.
 */
export function getAvatarSrc(avatar, { animated = false, size = '100' } = {}) {
    const safeAvatar = avatar && ALL_AVATARS.includes(avatar) ? avatar : 'archer';
    const dim = String(size) === '200' ? '200' : '100';

    if (isClassicAvatar(safeAvatar)) {
        return `/assets/avatars/${safeAvatar}.png`;
    }

    const variant = animated ? '' : '-static';
    return `/assets/avatars/emotes/${safeAvatar}-${dim}${variant}.webp`;
}

export const EMOTE_ANIMATION_DURATION_MS = 2417;

/** @type {Map<string, Promise<Blob | null>>} */
const emoteBlobCache = new Map();

/**
 * Fetches and caches an animated emote WebP as a Blob so repeated playback never re-downloads over the network.
 *
 * @param {string} animSrc - Canonical URL of the animated WebP asset.
 * @returns {Promise<Blob | null>}
 */
function fetchEmoteBlob(animSrc) {
    const cached = emoteBlobCache.get(animSrc);
    if (cached) return cached;

    const promise = fetch(animSrc)
        .then((res) => {
            if (!res.ok) {
                emoteBlobCache.delete(animSrc);
                return null;
            }
            return res.blob();
        })
        .catch(() => {
            emoteBlobCache.delete(animSrc);
            return null;
        });

    emoteBlobCache.set(animSrc, promise);
    return promise;
}

/**
 * Revokes any active Blob object URL tracked on an avatar host/image pair.
 *
 * @param {any} hostEl
 * @param {any} imgEl
 */
function revokeTrackedBlobUrl(hostEl, imgEl) {
    const blobUrl = hostEl?._avatarBlobUrl || imgEl?._avatarBlobUrl;
    if (blobUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        try {
            URL.revokeObjectURL(blobUrl);
        } catch {
            // Ignore revocation errors on already-released URLs
        }
    }
    if (hostEl) hostEl._avatarBlobUrl = null;
    if (imgEl) imgEl._avatarBlobUrl = null;
}

/**
 * Applies a source URL to an avatar host or inner image element.
 *
 * @param {HTMLElement} imgEl
 * @param {string} srcUrl
 */
function applyAvatarImageSrc(imgEl, srcUrl) {
    const innerImg = imgEl.querySelector?.('img');
    if (innerImg) {
        innerImg.src = srcUrl;
    } else {
        imgEl.setAttribute('src', srcUrl);
    }
}

/**
 * Fires one full animation cycle for an emote avatar on hover or click.
 * If an animation is already in progress on this element, does not cancel or restart it.
 *
 * @param {HTMLElement|null} targetEl - Element or container holding the avatar image.
 * @param {string} avatar - Avatar identifier.
 * @param {'100'|'200'} [size='100'] - Target size tier.
 * @returns {boolean} True if animation was fired, false if already playing or not an emote.
 */
export function playAvatarAnimationOnce(targetEl, avatar, size = '100') {
    if (!targetEl || !isEmoteAvatar(avatar)) return false;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
        return false;
    }

    const hostEl = /** @type {any} */ (targetEl);
    const imgEl = /** @type {any} */ (targetEl.tagName === 'IMG'
        ? targetEl
        : (targetEl.querySelector?.('clashcalc-assets-image, orecalc-assets-image, img') || targetEl));

    if (hostEl._avatarAnimTimer || imgEl._avatarAnimTimer || hostEl._avatarAnimPending || imgEl._avatarAnimPending) {
        return false;
    }

    const animSrc = getAvatarSrc(avatar, { animated: true, size });
    const staticSrc = getAvatarSrc(avatar, { animated: false, size });

    const btnContainer = typeof targetEl.closest === 'function'
        ? targetEl.closest('.avatar-option-btn, .account-profile-avatar-btn, .account-user-profile-avatar, .header-account-btn')
        : null;

    const isPopout = isBonusAvatar(avatar);
    const playToken = (hostEl._avatarPlayToken || 0) + 1;
    hostEl._avatarPlayToken = playToken;
    imgEl._avatarPlayToken = playToken;

    const setAnimationClasses = (active) => {
        const method = active ? 'add' : 'remove';
        btnContainer?.classList?.[method]('is-animating');
        targetEl.classList?.[method]('is-animating');
        if (imgEl !== targetEl) {
            imgEl.classList?.[method]('is-animating');
        }
        if (isPopout || !active) {
            btnContainer?.classList?.[method]('is-popout');
            targetEl.classList?.[method]('is-popout');
            if (imgEl !== targetEl) {
                imgEl.classList?.[method]('is-popout');
            }
        }
    };

    const scheduleRestore = () => {
        const timer = setTimeout(() => {
            hostEl._avatarAnimTimer = null;
            imgEl._avatarAnimTimer = null;
            hostEl._avatarAnimPending = false;
            imgEl._avatarAnimPending = false;
            setAnimationClasses(false);
            if (imgEl.isConnected) {
                applyAvatarImageSrc(imgEl, staticSrc);
            }
            revokeTrackedBlobUrl(hostEl, imgEl);
        }, EMOTE_ANIMATION_DURATION_MS);

        hostEl._avatarAnimTimer = timer;
        imgEl._avatarAnimTimer = timer;
    };

    const canUseBlobPlayback = typeof fetch === 'function' &&
        typeof URL !== 'undefined' &&
        typeof URL.createObjectURL === 'function';

    if (!canUseBlobPlayback) {
        setAnimationClasses(true);
        applyAvatarImageSrc(imgEl, animSrc);
        scheduleRestore();
        return true;
    }

    hostEl._avatarAnimPending = true;
    imgEl._avatarAnimPending = true;

    fetchEmoteBlob(animSrc).then(async (blob) => {
        if (hostEl._avatarPlayToken !== playToken || imgEl._avatarPlayToken !== playToken || !imgEl.isConnected) {
            hostEl._avatarAnimPending = false;
            imgEl._avatarAnimPending = false;
            return;
        }

        const playUrl = blob ? URL.createObjectURL(blob) : animSrc;
        if (blob) {
            hostEl._avatarBlobUrl = playUrl;
            imgEl._avatarBlobUrl = playUrl;
        }

        applyAvatarImageSrc(imgEl, playUrl);

        const activeImg = imgEl.tagName === 'IMG' ? imgEl : imgEl.querySelector?.('img');
        if (activeImg && typeof activeImg.decode === 'function') {
            try {
                await activeImg.decode();
            } catch {
                // Ignore decode rejections if image is swapped mid-flight
            }
        }

        if (hostEl._avatarPlayToken !== playToken || imgEl._avatarPlayToken !== playToken || !imgEl.isConnected) {
            hostEl._avatarAnimPending = false;
            imgEl._avatarAnimPending = false;
            revokeTrackedBlobUrl(hostEl, imgEl);
            return;
        }

        hostEl._avatarAnimPending = false;
        imgEl._avatarAnimPending = false;
        setAnimationClasses(true);
        scheduleRestore();
    });

    return true;
}

/**
 * Immediately cancels an active avatar animation and restores the static poster.
 *
 * @param {HTMLElement|null} targetEl - Element or container holding the avatar image.
 * @param {string} avatar - Avatar identifier.
 * @param {'100'|'200'} [size='100'] - Target size tier.
 */
export function stopAvatarAnimation(targetEl, avatar, size = '100') {
    if (!targetEl) return;
    const hostEl = /** @type {any} */ (targetEl);
    const imgEl = /** @type {any} */ (targetEl.tagName === 'IMG'
        ? targetEl
        : (targetEl.querySelector?.('clashcalc-assets-image, orecalc-assets-image, img') || targetEl));

    hostEl._avatarPlayToken = (hostEl._avatarPlayToken || 0) + 1;
    imgEl._avatarPlayToken = hostEl._avatarPlayToken;
    hostEl._avatarAnimPending = false;
    imgEl._avatarAnimPending = false;

    if (hostEl._avatarAnimTimer) {
        clearTimeout(hostEl._avatarAnimTimer);
        hostEl._avatarAnimTimer = null;
    }
    if (imgEl._avatarAnimTimer) {
        clearTimeout(imgEl._avatarAnimTimer);
        imgEl._avatarAnimTimer = null;
    }

    const btnContainer = typeof targetEl.closest === 'function'
        ? targetEl.closest('.avatar-option-btn, .account-profile-avatar-btn, .account-user-profile-avatar, .header-account-btn')
        : null;

    btnContainer?.classList?.remove('is-animating');
    btnContainer?.classList?.remove('is-popout');
    targetEl.classList?.remove('is-animating');
    targetEl.classList?.remove('is-popout');
    if (imgEl !== targetEl) {
        imgEl.classList?.remove('is-animating');
        imgEl.classList?.remove('is-popout');
    }

    const staticSrc = getAvatarSrc(avatar, { animated: false, size });
    imgEl.setAttribute('src', staticSrc);
    const innerImg = imgEl.querySelector?.('img');
    if (innerImg) {
        innerImg.src = staticSrc;
    }
    revokeTrackedBlobUrl(hostEl, imgEl);
}

/**
 * Syncs visibility, color state, and accessible tooltip/ARIA metadata on a supporter status badge icon.
 *
 * @param {HTMLElement|null} iconEl - Target supporter badge icon element.
 * @param {'supporter' | 'standard' | 'hidden'} mode - Active display mode.
 * @param {string} [labelText=''] - Localized tooltip and accessible label string.
 */
export function syncSupporterIconState(iconEl, mode, labelText = '') {
    if (!iconEl) return;

    if (mode === 'hidden') {
        iconEl.classList?.remove('is-supporter');
        iconEl.classList?.add('is-hidden');
        iconEl.setAttribute('hidden', '');
        return;
    }

    const isSupporter = mode === 'supporter';
    const i18nKey = isSupporter ? 'auth.supporter.statusActive' : 'auth.supporter.statusInactive';

    iconEl.classList?.remove('is-hidden');
    iconEl.removeAttribute('hidden');
    if (isSupporter) {
        iconEl.classList?.add('is-supporter');
    } else {
        iconEl.classList?.remove('is-supporter');
    }

    if (labelText) {
        iconEl.setAttribute('title', labelText);
        iconEl.setAttribute('aria-label', labelText);
    }
    iconEl.setAttribute('data-i18n-title', i18nKey);
    iconEl.setAttribute('data-i18n-aria-label', i18nKey);
}
