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

const dealerSchema = new mongoose.Schema({
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
dealerSchema.index({ name: 'text', phoneNumber: 'text', firmName: 'text' });

// Performance optimization indexes
dealerSchema.index({ branch: 1, createdAt: -1 }); // For filtering by branch and sorting
dealerSchema.index({ createdBy: 1 }); // For populate optimization
dealerSchema.index({ 'remarks.createdBy': 1 }); // For nested populate optimization

const dealerModel = mongoose.model('Dealer', dealerSchema);

module.exports = dealerModel;