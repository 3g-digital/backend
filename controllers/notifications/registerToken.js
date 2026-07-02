const User = require('../../models/userModel');

const registerToken = async (req, res) => {
  try {
    const { token, deviceType, platform } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required',
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.fcmTokens = user.fcmTokens || [];

    const existingIndex = user.fcmTokens.findIndex(
      (entry) => entry.token === token
    );

    if (existingIndex > -1) {
      user.fcmTokens[existingIndex].lastUsedAt = new Date();
      user.fcmTokens[existingIndex].deviceType = deviceType || user.fcmTokens[existingIndex].deviceType;
      user.fcmTokens[existingIndex].platform = platform || user.fcmTokens[existingIndex].platform;
    } else {
      user.fcmTokens.push({
        token,
        deviceType,
        platform,
        lastUsedAt: new Date(),
      });
    }

    if (user.fcmTokens.length > 5) {
      user.fcmTokens = user.fcmTokens.slice(-5);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Notification token registered',
    });
  } catch (error) {
    console.error('Error registering token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register notification token',
    });
  }
};

module.exports = registerToken;
