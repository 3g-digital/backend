const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from cookies or authorization header
    let token = req.cookies.token;
   
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
   
    if (!token) {
      return res.status(401).json({
        message: 'Not authenticated. Please log in.',
        error: true,
        success: false
      });
    }
   
    // Check if secret key exists
    if (!process.env.TOKEN_SECRET_KEY) {
      console.error('TOKEN_SECRET_KEY not found in environment variables');
      return res.status(500).json({
        message: 'Server configuration error',
        error: true,
        success: false
      });
    }

    console.log('Secret key exists:', !!process.env.TOKEN_SECRET_KEY);

    // Verify token
    const decoded = jwt.verify(token, process.env.TOKEN_SECRET_KEY);
   
    // Find user
    const user = await User.findById(decoded.userId);
   
    if (!user) {
      return res.status(401).json({
        message: 'User not found',
        error: true,
        success: false
      });
    }
   
    // Check if user is active
    if (user.status !== 'active') {
      return res.status(401).json({
        message: 'Your account is inactive',
        error: true,
        success: false
      });
    }
   
    // Set user info on request
    req.userId = user._id;
    req.userRole = user.role;
    req.user = user;
   
    // Important: Add user's branch to the request
    // This will be used to restrict manager actions to their own branch
    if (user.branch) {
      req.userBranch = user.branch;
    }
   
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);

    // Check if it's a JWT error specifically
    if (err.name === 'JsonWebTokenError') {
      console.log('JWT Error - Token invalid or expired. User needs to re-login.');
      return res.status(401).json({
        message: 'Session expired. Please login again.',
        error: true,
        success: false,
        needsRelogin: true
      });
    }

    return res.status(401).json({
      message: 'Authentication failed',
      error: true,
      success: false
    });
  }
};
module.exports = authMiddleware;