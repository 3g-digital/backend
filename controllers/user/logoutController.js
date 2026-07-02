const logoutController = async (req, res) => {
    try {
      // Clear the cookie with same options as set during login
      res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'None'
      });

      res.status(200).json({
        message: 'Logout successful',
        error: false,
        success: true
      });
    } catch (err) {
      console.error('Error in logout:', err);
      res.status(500).json({
        message: 'Server error',
        error: true,
        success: false
      });
    }
  };
  
  module.exports = { logoutController };