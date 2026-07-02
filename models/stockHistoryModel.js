// models/stockHistoryModel.js
// This model stores a permanent log of all stock additions
// It is never modified or deleted - only new entries are added when stock is added
const mongoose = require('mongoose');

const stockHistorySchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  itemType: {
    type: String,
    enum: ['serialized-product', 'generic-product'],
    required: true
  },
  serialNumber: {
    type: String,
    required: function() {
      return this.itemType === 'serialized-product';
    }
  },
  quantity: {
    type: Number,
    required: true,
    default: 1
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  addedDate: {
    type: Date,
    required: true
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  remark: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
stockHistorySchema.index({ item: 1, branch: 1 });
stockHistorySchema.index({ serialNumber: 1 });

const StockHistory = mongoose.model('StockHistory', stockHistorySchema);
module.exports = StockHistory;
