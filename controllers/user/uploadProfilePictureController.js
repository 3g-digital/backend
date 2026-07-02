const userModel = require('../../models/userModel');
const { uploadProfilePicture, deleteProfilePicture } = require('../../config/cloudinary');

const uploadProfilePictureController = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        error: true,
        message: 'User not authenticated'
      });
    }

    // Check if file is provided
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: true,
        message: 'No image file provided'
      });
    }

    // Get user from database
    const user = await userModel.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: true,
        message: 'User not found'
      });
    }

    // Delete old profile picture from Cloudinary if exists
    if (user.profileImagePublicId) {
      try {
        await deleteProfilePicture(user.profileImagePublicId);
      } catch (error) {
        console.error('Error deleting old profile picture:', error);
        // Continue with upload even if deletion fails
      }
    }

    // Upload new profile picture to Cloudinary
    const uploadResult = await uploadProfilePicture(req.file.buffer);

    // Update user profile with new image URL and public ID
    const updatedUser = await userModel.findByIdAndUpdate(
      req.userId,
      {
        profileImage: uploadResult.url,
        profileImagePublicId: uploadResult.publicId
      },
      { new: true }
    ).select('-password'); // Exclude password from response

    return res.status(200).json({
      success: true,
      error: false,
      message: 'Profile picture updated successfully',
      data: {
        profileImage: updatedUser.profileImage,
        user: {
          _id: updatedUser._id,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          username: updatedUser.username,
          email: updatedUser.email,
          role: updatedUser.role,
          profileImage: updatedUser.profileImage
        }
      }
    });

  } catch (error) {
    console.error('Error uploading profile picture:', error);
    return res.status(500).json({
      success: false,
      error: true,
      message: 'Internal server error. Please try again later.',
      details: error.message
    });
  }
};

// Controller to delete profile picture
const deleteProfilePictureController = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        error: true,
        message: 'User not authenticated'
      });
    }

    // Get user from database
    const user = await userModel.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: true,
        message: 'User not found'
      });
    }

    // Delete profile picture from Cloudinary if exists
    if (user.profileImagePublicId) {
      try {
        await deleteProfilePicture(user.profileImagePublicId);
      } catch (error) {
        console.error('Error deleting profile picture from Cloudinary:', error);
      }
    }

    // Update user profile to remove image
    const updatedUser = await userModel.findByIdAndUpdate(
      req.userId,
      {
        profileImage: null,
        profileImagePublicId: null
      },
      { new: true }
    ).select('-password');

    return res.status(200).json({
      success: true,
      error: false,
      message: 'Profile picture deleted successfully',
      data: {
        user: {
          _id: updatedUser._id,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          username: updatedUser.username,
          email: updatedUser.email,
          role: updatedUser.role,
          profileImage: updatedUser.profileImage
        }
      }
    });

  } catch (error) {
    console.error('Error deleting profile picture:', error);
    return res.status(500).json({
      success: false,
      error: true,
      message: 'Internal server error. Please try again later.',
      details: error.message
    });
  }
};

module.exports = {
  uploadProfilePictureController,
  deleteProfilePictureController
};