const Item = require('../../models/inventoryModel');

// Check if your updateInventory controller is properly updating all fields
const updateInventory = async (req, res) => {
  try {
    // Admin can update all items, Manager and Technician can only update services
    if (req.userRole !== 'admin' && req.userRole !== 'manager' && req.userRole !== 'technician') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Only admin, manager, and technician can update items.'
      });
    }

    const {
      type,
      name,
      unit,
      warranty,
      mrp,
      purchasePrice,
      customerPrice,
      dealerPrice,
      distributorPrice,
      pricing
    } = req.body;

    console.log("Received update request for item:", req.params.id);
    console.log("Request body:", req.body);

    // Find the item
    const item = await Item.findOne({ id: req.params.id });
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // If manager or technician, only allow service updates
    if ((req.userRole === 'manager' || req.userRole === 'technician') && item.type !== 'service') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Managers and technicians can only update services.'
      });
    }

    // Update fields - make sure all fields are properly updated
    if (type) item.type = type;
    if (name) item.name = name;

    // For products
    if (type === 'serialized-product' || type === 'generic-product' ||
        item.type === 'serialized-product' || item.type === 'generic-product') {
      if (unit) item.unit = unit;
      if (warranty) item.warranty = warranty;
      if (mrp !== undefined) item.mrp = mrp; // Use !== undefined to accept 0 values
      if (purchasePrice !== undefined) item.purchasePrice = purchasePrice;
    }

    // Update multi-tier pricing - handle both formats
    // Format 1: Direct fields (customerPrice, dealerPrice, distributorPrice)
    // Format 2: Nested pricing object
    if (pricing) {
      // If pricing object is sent
      item.pricing = {
        customerPrice: pricing.customerPrice !== undefined ? pricing.customerPrice : item.pricing?.customerPrice,
        dealerPrice: pricing.dealerPrice !== undefined ? pricing.dealerPrice : item.pricing?.dealerPrice,
        distributorPrice: pricing.distributorPrice !== undefined ? pricing.distributorPrice : item.pricing?.distributorPrice
      };
    } else if (customerPrice !== undefined || dealerPrice !== undefined || distributorPrice !== undefined) {
      // If individual fields are sent
      if (!item.pricing) {
        item.pricing = {};
      }
      if (customerPrice !== undefined) item.pricing.customerPrice = customerPrice;
      if (dealerPrice !== undefined) item.pricing.dealerPrice = dealerPrice;
      if (distributorPrice !== undefined) item.pricing.distributorPrice = distributorPrice;
    }

    item.updatedAt = new Date();

    await item.save();

    console.log("Item updated successfully:", item);

    res.json({
      success: true,
      item: item  // Return the updated item
    });
  } catch (err) {
    console.error('Error updating inventory item:', err);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};

module.exports = updateInventory;  