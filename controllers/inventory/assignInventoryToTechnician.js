const Item = require('../../models/inventoryModel');
const TechnicianInventory = require('../../models/technicianInventoryModel');
const User = require('../../models/userModel');
const TransferHistory = require('../../models/transferHistoryModel');

const assignInventoryToTechnician = async (req, res) => {
  try {
    // Only managers can assign inventory
    if (req.userRole !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Only managers can assign inventory.'
      });
    }
    
    const { technicianId, type, itemId, serialNumber, quantity } = req.body;
    
    // Check if technician exists and belongs to manager's branch
    const technician = await User.findOne({ 
      _id: technicianId, 
      role: 'technician',
      branch: req.userBranch
    });
    
    if (!technician) {
      return res.status(404).json({
        success: false,
        message: 'Technician not found or not in your branch'
      });
    }
    
    // Find the inventory item
    const item = await Item.findOne({ id: itemId });
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Find or create technician inventory record
    let techInventory = await TechnicianInventory.findOne({
      technician: technicianId,
      item: item._id
    });
    
    if (!techInventory) {
      techInventory = new TechnicianInventory({
        technician: technicianId,
        item: item._id,
        branch: req.userBranch,
        serializedItems: [],
        genericQuantity: 0
      });
    }
    
    // Handle the assignment based on the item type
    if (type === 'serialized-product') {
      if (!serialNumber) {
        return res.status(400).json({
          success: false,
          message: 'Serial number is required for serialized products'
        });
      }
      
      // Check if the serial number exists in manager's branch
      const stockItem = item.stock.find(
        s => s.serialNumber === serialNumber && s.branch.toString() === req.userBranch.toString()
      );
      
      if (!stockItem) {
        return res.status(400).json({
          success: false,
          message: 'Serial number not found in your branch inventory'
        });
      }
      
      // Check if this serial number is already actively assigned to any technician
      const alreadyAssigned = await TechnicianInventory.findOne({
        serializedItems: {
          $elemMatch: {
            serialNumber,
            status: 'active'
          }
        }
      });
      
      if (alreadyAssigned) {
        return res.status(400).json({
          success: false,
          message: 'This serial number is already assigned to a technician'
        });
      }
      
      // Remove from main inventory and add to technician inventory
      item.stock = item.stock.filter(s => !(s.serialNumber === serialNumber && s.branch.toString() === req.userBranch.toString()));
      await item.save();

      // Remove any stale returned entry for the same serial (if it exists)
      techInventory.serializedItems = techInventory.serializedItems.filter(
        serialEntry => !(serialEntry.serialNumber === serialNumber && serialEntry.status === 'returned')
      );

      // Add to technician's serialized items
      techInventory.serializedItems.push({
        serialNumber,
        assignedAt: new Date(),
        assignedBy: req.userId
      });
    } else {
      // For generic products
      if (!quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid quantity required for generic products'
        });
      }
      
      // Calculate total available stock in manager's branch
      const availableStock = item.stock.reduce((total, stockItem) => {
        if (stockItem.branch.toString() === req.userBranch.toString()) {
          return total + stockItem.quantity;
        }
        return total;
      }, 0);
      
      if (availableStock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Only ${availableStock} ${item.unit}(s) available.`
        });
      }
      
      // Reduce inventory from stock entries
      let remainingToReduce = quantity;
      
      for (let i = 0; i < item.stock.length && remainingToReduce > 0; i++) {
        if (item.stock[i].branch.toString() === req.userBranch.toString()) {
          const currentQty = item.stock[i].quantity;
          
          if (currentQty <= remainingToReduce) {
            // Remove entire stock entry
            remainingToReduce -= currentQty;
            item.stock[i].quantity = 0;
          } else {
            // Reduce from this entry
            item.stock[i].quantity -= remainingToReduce;
            remainingToReduce = 0;
          }
        }
      }
      
      // Remove any empty stock entries
      item.stock = item.stock.filter(s => s.quantity > 0);
      await item.save();

      // Update technician's generic quantity
      techInventory.genericQuantity += quantity;
    }

    // Update last modified info
    techInventory.lastUpdated = new Date();
    techInventory.lastUpdatedBy = req.userId;
    
    await techInventory.save();

    // Create transfer history record
    await new TransferHistory({
      fromType: 'branch',
      fromId: req.userBranch,
      toType: 'technician',
      toId: technicianId,
      item: item._id,
      serialNumber: type === 'serialized-product' ? serialNumber : undefined,
      quantity: type === 'serialized-product' ? 1 : quantity,
      transferredBy: req.userId
    }).save();
    
    res.json({
      success: true,
      message: 'Inventory assigned successfully',
      data: {
        technicianId,
        itemId,
        type,
        quantity: type === 'serialized-product' ? 1 : quantity
      }
    });
  } catch (err) {
    console.error('Error assigning inventory:', err);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};

module.exports = assignInventoryToTechnician;
