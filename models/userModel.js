const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
  },
  lastName: {
    type: String,
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
  },
  password: {
    type: String,
    required: true
  },
  phone: String,
  role: {
    type: String,
    enum: ['admin', 'manager', 'technician'],
    required: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },
  location: String,
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  activeManagerStatus: {
    type: String,
    enum: ['active', 'pending', 'transferring', 'transferred'],
    default: function() {
      return this.role === 'manager' ? 'active' : undefined;
    }
  },
  profileImage: {
    type: String,
    default: null
  },
  profileImagePublicId: {
    type: String,
    default: null
  },
  fcmTokens: [
    {
      token: String,
      deviceType: String,
      platform: String,
      createdAt: {
        type: Date,
        default: Date.now
      },
      lastUsedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  },
});

// Performance optimization indexes
UserSchema.index({ role: 1, branch: 1 }); // For filtering users by role and branch
UserSchema.index({ role: 1, status: 1 }); // For filtering by role and status
UserSchema.index({ branch: 1 }); // For branch-based queries

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
 
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});
// Method to check password
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};
const userModel = mongoose.model('User', UserSchema);
module.exports = userModel;
