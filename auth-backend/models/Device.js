const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    deviceId: {
        type: String,
        required: true,
        unique: true
    },
    deviceName: {
        type: String,
        required: true
    },
    deviceType: {
        type: String,
        enum: ['mobile', 'tablet', 'desktop', 'other'],
        default: 'other'
    },
    platform: {
        type: String, // iOS, Android, Windows, Mac, Linux, etc.
        default: 'unknown'
    },
    browser: {
        type: String,
        default: 'unknown'
    },
    ipAddress: {
        type: String,
        required: true
    },
    location: {
        city: String,
        country: String,
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    isTrusted: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for performance
deviceSchema.index({ userId: 1, lastActive: -1 });
// Note: deviceId index is created automatically via unique:true on the field definition

// Method to update last active time
deviceSchema.methods.updateActivity = async function () {
    this.lastActive = new Date();
    return await this.save();
};

module.exports = mongoose.model('Device', deviceSchema);
