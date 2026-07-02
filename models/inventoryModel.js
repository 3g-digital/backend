// models/inventoryModel.js
const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  serialNumber: {
    type: String,
    required: function() {
      // Required only for serialized products
      return this.parent().type === 'serialized-product';
    }
  },
  quantity: {
    type: Number,
    required: true,
    default: 1
  },
  date: {
    type: Date,
    default: Date.now
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true // Branch is required for stock entries
  },
  remark: {
    type: String,
    default: ''
  }
});

const itemSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    required: true,
    enum: ['serialized-product', 'generic-product', 'service']
  },
  name: {
    type: String,
    required: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },
  unit: {
    type: String,
    required: function() {
      return this.type === 'serialized-product' || this.type === 'generic-product';
    }
  },
  warranty: {
    type: String,
    required: function() {
      return this.type === 'serialized-product' || this.type === 'generic-product';
    }
  },
  mrp: {
    type: Number,
    required: function() {
      return this.type === 'serialized-product' || this.type === 'generic-product';
    }
  },
  purchasePrice: {
    type: Number,
    required: function() {
      return this.type === 'serialized-product' || this.type === 'generic-product';
    }
  },
  pricing: {
    customerPrice: {
      type: Number,
      required: true
    },
    dealerPrice: {
      type: Number,
      required: true
    },
    distributorPrice: {
      type: Number,
      required: true
    }
  },
  // Keep old salePrice for backward compatibility
  salePrice: {
    type: Number,
    required: function() {
      // Only required if pricing object is not provided
      return !this.pricing || (!this.pricing.customerPrice && !this.pricing.dealerPrice && !this.pricing.distributorPrice);
    }
  },
  stock: [stockSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Add this after defining the model
itemSchema.index({ 'stock.serialNumber': 1 }, { 
  unique: true, 
  partialFilterExpression: { 'stock.serialNumber': { $type: 'string' } }
});

const inventoryModel = mongoose.model('Item', itemSchema);
module.exports = inventoryModel;