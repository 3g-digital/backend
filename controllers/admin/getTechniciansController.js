const User = require('../../models/userModel');

// Get all technicians
const getTechniciansController = async (req, res) => {
  try {
    // Check if user is admin or manager
    if (req.userRole !== 'admin' && req.userRole !== 'manager') {
      return res.status(403).json({
        message: 'Permission denied',
        error: true,
        success: false
      });
    }

    // If manager, only return technicians from their branch
    let query = { role: 'technician' };
    if (req.userRole === 'manager') {
      query.branch = req.user.branch;
    }

    const technicians = await User.find(query)
      .select('-password')
      .populate('branch', 'name location')
      .sort('-createdAt');
    
    res.status(200).json({
      message: 'Technicians fetched successfully',
      error: false,
      success: true,
      data: technicians
    });
  } catch (err) {
    console.error('Error in getTechnicians:', err);
    res.status(500).json({
      message: err.message || 'Server error',
      error: true,
      success: false
    });
  }
};

module.exports = getTechniciansController;