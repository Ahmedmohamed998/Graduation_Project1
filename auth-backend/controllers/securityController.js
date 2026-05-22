const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/User');
const TwoFactorAuth = require('../models/TwoFactorAuth');
const Device = require('../models/Device');

// Change Password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.userId;

        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                error: 'New password must be at least 6 characters long'
            });
        }

        // Get user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.json({
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
};

// Setup 2FA
exports.setup2FA = async (req, res) => {
    try {
        const userId = req.userId;

        // Check if 2FA already exists
        let twoFactor = await TwoFactorAuth.findOne({ userId });

        if (twoFactor && twoFactor.enabled) {
            return res.status(400).json({
                error: '2FA is already enabled. Disable it first to set up again.'
            });
        }

        // Generate secret
        const secret = speakeasy.generateSecret({
            name: `BudgetApp (${req.user?.email || userId})`,
            length: 32
        });

        // Generate backup codes
        const backupCodes = [];
        for (let i = 0; i < 10; i++) {
            const code = Math.random().toString(36).substring(2, 10).toUpperCase();
            backupCodes.push({ code, used: false });
        }

        // Save or update 2FA record (but not enabled yet)
        if (twoFactor) {
            twoFactor.secret = secret.base32;
            twoFactor.backupCodes = backupCodes;
            twoFactor.enabled = false;
        } else {
            twoFactor = new TwoFactorAuth({
                userId,
                secret: secret.base32,
                backupCodes,
                enabled: false
            });
        }
        await twoFactor.save();

        // Generate QR code
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

        res.json({
            message: '2FA setup initiated. Scan QR code and verify to enable.',
            qrCode: qrCodeUrl,
            secret: secret.base32,
            backupCodes: backupCodes.map(c => c.code)
        });
    } catch (error) {
        console.error('Setup 2FA error:', error);
        res.status(500).json({ error: 'Failed to setup 2FA' });
    }
};

// Verify and Enable 2FA
exports.verify2FA = async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.userId;

        if (!token) {
            return res.status(400).json({ error: 'Verification token is required' });
        }

        // Get 2FA record
        const twoFactor = await TwoFactorAuth.findOne({ userId });
        if (!twoFactor) {
            return res.status(404).json({ error: '2FA not set up. Please setup first.' });
        }

        // Verify token
        const verified = speakeasy.totp.verify({
            secret: twoFactor.secret,
            encoding: 'base32',
            token,
            window: 2
        });

        if (!verified) {
            return res.status(401).json({ error: 'Invalid verification code' });
        }

        // Enable 2FA
        twoFactor.enabled = true;
        twoFactor.verifiedAt = new Date();
        await twoFactor.save();

        res.json({
            message: '2FA enabled successfully',
            backupCodes: twoFactor.backupCodes.map(c => c.code)
        });
    } catch (error) {
        console.error('Verify 2FA error:', error);
        res.status(500).json({ error: 'Failed to verify 2FA' });
    }
};

// Disable 2FA
exports.disable2FA = async (req, res) => {
    try {
        const { password, token } = req.body;
        const userId = req.userId;

        // Validate input
        if (!password) {
            return res.status(400).json({ error: 'Password is required to disable 2FA' });
        }

        // Get user and verify password
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        // Get 2FA record
        const twoFactor = await TwoFactorAuth.findOne({ userId });
        if (!twoFactor || !twoFactor.enabled) {
            return res.status(400).json({ error: '2FA is not enabled' });
        }

        // If token provided, verify it
        if (token) {
            const verified = speakeasy.totp.verify({
                secret: twoFactor.secret,
                encoding: 'base32',
                token,
                window: 2
            });

            if (!verified) {
                return res.status(401).json({ error: 'Invalid 2FA code' });
            }
        }

        // Disable 2FA
        await TwoFactorAuth.deleteOne({ userId });

        res.json({
            message: '2FA disabled successfully'
        });
    } catch (error) {
        console.error('Disable 2FA error:', error);
        res.status(500).json({ error: 'Failed to disable 2FA' });
    }
};

// Get 2FA Status
exports.get2FAStatus = async (req, res) => {
    try {
        const userId = req.userId;

        const twoFactor = await TwoFactorAuth.findOne({ userId });

        res.json({
            enabled: twoFactor ? twoFactor.enabled : false,
            method: twoFactor ? twoFactor.method : null,
            verifiedAt: twoFactor ? twoFactor.verifiedAt : null
        });
    } catch (error) {
        console.error('Get 2FA status error:', error);
        res.status(500).json({ error: 'Failed to get 2FA status' });
    }
};

// List Devices
exports.listDevices = async (req, res) => {
    try {
        const userId = req.userId;

        const devices = await Device.find({ userId })
            .sort({ lastActive: -1 })
            .select('-__v');

        res.json({
            devices,
            total: devices.length
        });
    } catch (error) {
        console.error('List devices error:', error);
        res.status(500).json({ error: 'Failed to list devices' });
    }
};

// Remove Device
exports.removeDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const userId = req.userId;

        const device = await Device.findOne({ deviceId, userId });
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        await Device.deleteOne({ deviceId, userId });

        res.json({
            message: 'Device removed successfully'
        });
    } catch (error) {
        console.error('Remove device error:', error);
        res.status(500).json({ error: 'Failed to remove device' });
    }
};

// Trust Device
exports.trustDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const userId = req.userId;

        const device = await Device.findOne({ deviceId, userId });
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        device.isTrusted = true;
        await device.save();

        res.json({
            message: 'Device trusted successfully',
            device
        });
    } catch (error) {
        console.error('Trust device error:', error);
        res.status(500).json({ error: 'Failed to trust device' });
    }
};
