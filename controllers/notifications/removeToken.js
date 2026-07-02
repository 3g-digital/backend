const User = require('../../models/userModel');

const removeToken = async (req, res) => {
  try {
    const { token } = req.body;

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

    const initialLength = user.fcmTokens?.length || 0;

    user.fcmTokens = (user.fcmTokens || []).filter(
      (entry) => entry.token !== token
    );

    if (user.fcmTokens.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: 'Token not found for user',
      });
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Notification token removed',
    });
  } catch (error) {
    console.error('Error removing token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove notification token',
    });
  }
};

module.exports = removeToken;
