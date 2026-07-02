const mongoose = require('mongoose');

const returnedItemSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  serialNumber: {
    type: String
  },
  type: {
    type: String,
    enum: ['serialized-product', 'generic-product'],
    required: true
  }
});

const returnedInventorySchema = new mongoose.Schema({
  technician: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  items: [returnedItemSchema],
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected'],
    default: 'pending'
  },
  returnedAt: {
    type: Date,
    default: Date.now
  },
  confirmedAt: {
    type: Date
  },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedAt: {
    type: Date
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectionReason: {
    type: String
  },
  notes: {
    type: String
  }
}, { timestamps: true });

const ReturnedInventory = mongoose.model('ReturnedInventory', returnedInventorySchema);
module.exports = ReturnedInventory;