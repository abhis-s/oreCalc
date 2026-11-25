const { AUTH_CONSTANTS, getRandomAvatar } = require('../constants.js');
const { redeemSupporterCodeAtomic } = require('./supporterCodeService.js');

/**
 * Checks whether an avatar is locked for a specific account.
 *
 * @param {{ userId?: string, username?: string, passkeys?: Array<any>, isSupporter?: boolean, [key: string]: any }} account - Firestore account record.
 * @param {string} avatar - Avatar identifier.
 * @param {any} [db] - Firestore database instance.
 * @returns {Promise<boolean>} True if the user is authorized to equip the avatar.
 */
async function isAvatarUnlockedForUser(account, avatar, db) {
    if (!account || !avatar) return false;

    // Non-bonus avatars are free for all authenticated accounts
    if (!AUTH_CONSTANTS.BONUS_AVATARS.includes(avatar)) {
        return true;
    }

    if (avatar === 'bk_ranked_bonus') {
        if (!db || !account.userId) return false;
        try {
            const playersSnap = await db
                .collection('userStates')
                .doc(account.userId)
                .collection('players')
                .get();
            if (playersSnap.empty) return false;
            return playersSnap.docs.some((doc) => {
                const th = Number(doc.data()?.playerProfile?.townHallLevel) || 0;
                return th >= 15;
            });
        } catch (err) {
            console.error('[AvatarLock] Failed to evaluate TH milestone for user:', err);
            return false;
        }
    }

    if (avatar === 'aq_ranked_bonus') {
        return Array.isArray(account.passkeys) && account.passkeys.length > 0;
    }

    if (avatar === 'dd_ranked_bonus') {
        return Boolean(account.isSupporter);
    }

    return false;
}

/**
 * Verifies and redeems a supporter activation code atomically against Firestore.
 *
 * @param {{ userId?: string, username?: string, passkeys?: Array<any>, isSupporter?: boolean, [key: string]: any }} account - Current account data.
 * @param {string} rawCode - Supporter code entered by the user.
 * @param {any} db - Firestore database instance.
 * @param {Record<string, string | undefined>} [env=process.env] - Environment configuration.
 * @returns {Promise<{
 *     success: boolean,
 *     newlyActivated?: boolean,
 *     source?: string,
 *     note?: string,
 *     bmcEventId?: string | null,
 *     codeHash?: string,
 *     reason?: string,
 *     message?: string
 * }>}
 */
async function verifyAndRedeemSupporterCode(account, rawCode, db, env = process.env) {
    return redeemSupporterCodeAtomic({ db, account, rawCode, env });
}

/**
 * Reconciles a user's currently equipped avatar against milestone eligibility.
 * If a bonus avatar's unlock milestone is no longer satisfied, falls back to a classic avatar
 * and persists the change to Firestore.
 *
 * @param {{ userId?: string, username?: string, avatar?: string, passkeys?: Array<any>, isSupporter?: boolean, [key: string]: any }} account - Firestore account record.
 * @param {any} [accountRef] - Firestore document reference for the account.
 * @param {any} [db] - Firestore database instance.
 * @returns {Promise<{ avatar: string, revoked: boolean }>}
 */
async function reconcileEquippedAvatar(account, accountRef, db) {
    const currentAvatar = account?.avatar || 'archer';
    if (!AUTH_CONSTANTS.BONUS_AVATARS.includes(currentAvatar)) {
        return { avatar: currentAvatar, revoked: false };
    }

    const stillUnlocked = await isAvatarUnlockedForUser(account, currentAvatar, db);
    if (stillUnlocked) {
        return { avatar: currentAvatar, revoked: false };
    }

    const fallbackAvatar = getRandomAvatar();
    if (accountRef && typeof accountRef.update === 'function') {
        try {
            await accountRef.update({ avatar: fallbackAvatar });
        } catch (err) {
            console.error('[AvatarLock] Failed to persist revoked avatar fallback:', err);
        }
    }
    return { avatar: fallbackAvatar, revoked: true };
}

module.exports = {
    isAvatarUnlockedForUser,
    reconcileEquippedAvatar,
    verifyAndRedeemSupporterCode
};
