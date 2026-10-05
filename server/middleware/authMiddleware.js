const { verifyToken } = require('../services/authService.js');
const { db } = require('../services/firebase.js');

/**
 * Extracts and decodes Bearer JWT token if present.
 * Does not reject requests if token is missing or invalid.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function extractAuthUser(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        try {
            const decoded = verifyToken(token);
            /** @type {any} */ (req).authUser = {
                username: decoded.sub,
                userId: decoded.userId
            };
        } catch (_) {
            /** @type {any} */ (req).authUser = null;
        }
    } else {
        /** @type {any} */ (req).authUser = null;
    }
    next();
}

/**
 * Enforces that request contains a valid authenticated user session.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requireAuth(req, res, next) {
    const authUser = /** @type {any} */ (req).authUser;
    if (!authUser || !authUser.userId) {
        return res.status(401).json({
            reason: 'unauthenticated',
            message: 'Authentication is required for this action.'
        });
    }
    next();
}

/**
 * Enforces that user is authorized to modify target userId.
 * If target document in userStates has authRequired === true,
 * requires req.authUser.userId === targetUserId.
 *
 * @param {string} targetUserId
 * @param {any} authUser
 * @param {any} [existingData]
 * @returns {Promise<boolean>} Whether write is authorized.
 */
async function isAuthorizedForUser(targetUserId, authUser, existingData = null) {
    if (!targetUserId) return false;

    let authRequired = existingData?.authRequired;
    if (authRequired === undefined) {
        try {
            const doc = await db.collection('userStates').doc(targetUserId).get();
            if (doc.exists) {
                authRequired = doc.data()?.authRequired === true;
            } else {
                authRequired = false;
            }
        } catch (_) {
            authRequired = false;
        }
    }

    if (authRequired) {
        return Boolean(authUser && authUser.userId === targetUserId);
    }

    return true;
}

module.exports = {
    extractAuthUser,
    requireAuth,
    isAuthorizedForUser
};
