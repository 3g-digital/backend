const mongoose = require('mongoose');

const remarkSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['positive', 'neutral', 'negative'],
    default: 'neutral'
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

const leadSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  firmName:{
     type: String,
  },
  // email: {
  //   type: String,
  //   match: /^\S+@\S+\.\S+$/,
  //   sparse: true
  // },
  whatsappNumber: {
    type: String
  },
  address: {
    type: String
  },
  // age: {
  //   type: Number
  // },
  projectType: {
    type: String,
    enum: [
      'CCTV Camera',
      'Attendance System',
      'Safe and Locks',
      'Lift & Elevator Solutions',
      'Home/Office Automation',
      'IT & Networking Services',
      'Software & Website Development',
      'Custom'
    ]
  },
  remarks: [remarkSchema],
  status: {
    type: String,
    enum: ['positive', 'neutral', 'negative'],
    default: 'neutral'
  },
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
  isConverted: {
    type: Boolean,
    default: false
  },
  convertedToCustomer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  convertedToDealer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dealer'
  },
  convertedToDistributor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Distributor'
  },
  convertedType: {
    type: String,
    enum: ['customer', 'dealer', 'distributor']
  },
  convertedAt: {
    type: Date
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
leadSchema.index({ name: 'text', phoneNumber: 'text', email: 'text' });

// Performance optimization indexes
leadSchema.index({ branch: 1, isConverted: 1, createdAt: -1 }); // For filtering leads by branch and conversion status
leadSchema.index({ createdBy: 1 }); // For populate optimization

const leadModel = mongoose.model('Lead', leadSchema);

module.exports = leadModel;