const mongoose = require('mongoose');

const remarkSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const distributorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  firmName: {
    type: String
  },
  whatsappNumber: {
    type: String
  },
  address: {
    type: String
  },
  remarks: [remarkSchema],
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Create index for search optimization
distributorSchema.index({ name: 'text', phoneNumber: 'text', firmName: 'text' });

// Performance optimization indexes
distributorSchema.index({ branch: 1, createdAt: -1 }); // For filtering by branch and sorting
distributorSchema.index({ createdBy: 1 }); // For populate optimization
distributorSchema.index({ 'remarks.createdBy': 1 }); // For nested populate optimization

const distributorModel = mongoose.model('Distributor', distributorSchema);

module.exports = distributorModel;