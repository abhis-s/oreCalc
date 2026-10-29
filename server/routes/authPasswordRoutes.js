const express = require('express');
const { AUTH_CONSTANTS } = require('../constants.js');
const { db } = require('../services/firebase.js');
const { hashPassword, verifyPassword } = require('../services/authService.js');
const { requireAuth } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/password/set', requireAuth, async (req, res) => {
    const authUser = /** @type {any} */ (req).authUser;
    const { newPassword } = req.body || {};

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < AUTH_CONSTANTS.MIN_PASSWORD_LENGTH || newPassword.length > AUTH_CONSTANTS.MAX_PASSWORD_LENGTH) {
        return res.status(400).json({ reason: 'invalidPassword', message: 'Password must be between 6 and 72 characters.' });
    }

    try {
        const cleanUsername = authUser.username.toLowerCase();
        const accountRef = db.collection('accounts').doc(cleanUsername);
        const doc = await accountRef.get();
        if (!doc.exists) {
            return res.status(404).json({ reason: 'accountNotFound', message: 'Account not found.' });
        }

        const account = doc.data();
        if (account?.passwordHash) {
            return res.status(400).json({
                reason: 'passwordAlreadySet',
                message: 'A password is already set for this account.'
            });
        }

        const passwordHash = await hashPassword(newPassword);
        await accountRef.update({ passwordHash });
        res.status(200).json({ success: true, message: 'Password configured successfully.' });
    } catch (err) {
        console.error('[Auth] Set password error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to set password.' });
    }
});

router.post('/password/change', requireAuth, async (req, res) => {
    const authUser = /** @type {any} */ (req).authUser;
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || typeof currentPassword !== 'string' || !newPassword || typeof newPassword !== 'string') {
        return res.status(400).json({ reason: 'badRequest', message: 'Current password and new password are required.' });
    }

    if (newPassword.length < AUTH_CONSTANTS.MIN_PASSWORD_LENGTH || newPassword.length > AUTH_CONSTANTS.MAX_PASSWORD_LENGTH) {
        return res.status(400).json({ reason: 'invalidPassword', message: 'Password must be between 6 and 72 characters.' });
    }

    if (currentPassword === newPassword) {
        return res.status(400).json({ reason: 'samePassword', message: 'New password must be different from current password.' });
    }

    try {
        const cleanUsername = authUser.username.toLowerCase();
        const accountRef = db.collection('accounts').doc(cleanUsername);
        const doc = await accountRef.get();
        if (!doc.exists) {
            return res.status(404).json({ reason: 'accountNotFound', message: 'Account not found.' });
        }

        const account = doc.data();
        if (!account?.passwordHash) {
            return res.status(400).json({
                reason: 'noPasswordSet',
                message: 'This account does not have a password configured.'
            });
        }

        const isMatch = await verifyPassword(currentPassword, account.passwordHash);
        if (!isMatch) {
            return res.status(401).json({
                reason: 'invalidCurrentPassword',
                message: 'Current password is incorrect.'
            });
        }

        const passwordHash = await hashPassword(newPassword);
        await accountRef.update({ passwordHash });
        res.status(200).json({ success: true, message: 'Password updated successfully.' });
    } catch (err) {
        console.error('[Auth] Change password error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to change password.' });
    }
});

router.post('/password/remove', requireAuth, async (req, res) => {
    const authUser = /** @type {any} */ (req).authUser;
    const { currentPassword } = req.body || {};

    try {
        const cleanUsername = authUser.username.toLowerCase();
        const accountRef = db.collection('accounts').doc(cleanUsername);
        const doc = await accountRef.get();
        if (!doc.exists) {
            return res.status(404).json({ reason: 'accountNotFound', message: 'Account not found.' });
        }

        const account = doc.data() || {};
        if (!account.passwordHash) {
            return res.status(400).json({ reason: 'noPasswordSet', message: 'Account does not have a password configured.' });
        }

        const passkeys = account.passkeys || [];
        if (passkeys.length === 0) {
            return res.status(400).json({
                reason: 'passkeyRequired',
                message: 'You must have at least one registered passkey before removing your password.'
            });
        }

        if (currentPassword) {
            const isMatch = await verifyPassword(currentPassword, account.passwordHash);
            if (!isMatch) {
                return res.status(401).json({ reason: 'invalidCurrentPassword', message: 'Current password is incorrect.' });
            }
        }

        await accountRef.update({ passwordHash: null });
        res.status(200).json({ success: true, message: 'Password removed successfully.' });
    } catch (err) {
        console.error('[Auth] Remove password error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to remove password.' });
    }
});

module.exports = router;
