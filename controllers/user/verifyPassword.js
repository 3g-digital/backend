const User = require('../../models/userModel');
const bcrypt = require('bcryptjs');

/**
 * Verify user's password
 * POST /api/verify-password
 * Body: { password: string }
 */
const verifyPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    // Get the logged-in user
    const user = await User.findById(req.user.id).select('password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      return res.status(200).json({
        success: true,
        message: 'Password verified successfully'
      });
    } else {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password'
      });
    }

  } catch (err) {
    console.error('Error verifying password:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying password'
    });
  }
};

module.exports = verifyPassword;
