// controllers/technician/returnInventoryToManager.js
const mongoose = require('mongoose');
const TechnicianInventory = require('../../models/technicianInventoryModel');
const Item = require('../../models/inventoryModel');
const ReturnedInventory = require('../../models/returnedInventoryModel');

const returnInventoryToManager = async (req, res) => {
  try {
    // Only technicians can return inventory
    if (req.userRole !== 'technician') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Only technicians can return inventory.'
      });
    }

    // Support both single item and batch return (array of items)
    const items = req.body.items || [req.body];

    console.log("Return request received for", items.length, "item(s)");

    // Array to collect all items being returned for this batch
    const returnedItemsData = [];
    const processedInventories = new Map(); // Track which inventories we've modified

    // Process each item in the return request
    for (const itemData of items) {
      const { type, itemId, serialNumber, quantity } = itemData;

      console.log("Processing item:", { type, itemId, serialNumber, quantity });

      // Find the item by its custom string ID
      let item = await Item.findOne({ id: itemId });

      if (!item) {
        const itemById = await Item.findById(itemId);
        if (itemById) {
          item = itemById;
        } else {
          console.log("Item not found with ID:", itemId);
          return res.status(404).json({
            success: false,
            message: `Item not found in inventory: ${itemId}`
          });
        }
      }

      console.log("Found item:", item.name, "with MongoDB _id:", item._id);

      // Find the technician's inventory
      const techInventory = await TechnicianInventory.findOne({
        technician: req.userId,
        item: item._id
      });

      if (!techInventory) {
        console.log("Technician inventory not found for item:", item._id);
        return res.status(404).json({
          success: false,
          message: `Item not found in your inventory: ${item.name}`
        });
      }

      // Handle the return based on item type
      if (type === 'serialized-product') {
        // Find the serial number in technician's inventory
        const serialItemIndex = techInventory.serializedItems.findIndex(
          si => si.serialNumber === serialNumber && si.status === 'active'
        );

        if (serialItemIndex === -1) {
          return res.status(400).json({
            success: false,
            message: `Serial number not found in your inventory or already used: ${serialNumber}`
          });
        }

        // Update item status to "returned"
        techInventory.serializedItems[serialItemIndex].status = 'returned';

        // Add to batch return data
        returnedItemsData.push({
          item: item._id,
          quantity: 1,
          serialNumber: serialNumber,
          type: type
        });

      } else {
        // For generic products
        if (!quantity || quantity <= 0 || quantity > techInventory.genericQuantity) {
          return res.status(400).json({
            success: false,
            message: `Invalid quantity for ${item.name}. You have ${techInventory.genericQuantity} ${item.unit}(s).`
          });
        }

        // Reduce from technician's inventory
        techInventory.genericQuantity -= quantity;

        // Add to batch return data
        returnedItemsData.push({
          item: item._id,
          quantity: quantity,
          serialNumber: null,
          type: type
        });
      }

      // Update last modified info
      techInventory.lastUpdated = new Date();
      techInventory.lastUpdatedBy = req.userId;

      // Save changes to technician inventory
      await techInventory.save();
      processedInventories.set(item._id.toString(), techInventory);
    }

    // Create ONE return entry with ALL items
    const returnEntry = await createBatchReturnedInventory(
      req.userId,
      req.userBranch,
      returnedItemsData
    );

    console.log("Batch return successful. Created entry:", returnEntry._id);
    res.json({
      success: true,
      message: 'Inventory returned successfully. Manager approval pending.',
      data: {
        returnId: returnEntry._id,
        itemCount: returnedItemsData.length,
        items: returnedItemsData.map(item => ({
          itemId: item.item,
          type: item.type,
          quantity: item.quantity,
          serialNumber: item.serialNumber
        }))
      }
    });
  } catch (err) {
    console.error('Error returning inventory:', err);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};

// Helper function to create a batch returned inventory entry
// This creates ONE entry with multiple items - for same-session returns
const createBatchReturnedInventory = async (technicianId, branchId, itemsData) => {
  try {
    // Create a single return entry with all items
    const returnEntry = new ReturnedInventory({
      technician: technicianId,
      branch: branchId,
      items: itemsData,
      returnedAt: new Date() // Single timestamp for the entire batch
    });

    await returnEntry.save();
    console.log('New batch return entry created:', returnEntry._id, 'with', itemsData.length, 'items');
    return returnEntry;
  } catch (err) {
    console.error('Error creating batch returned inventory:', err);
    throw err;
  }
};

module.exports = returnInventoryToManager;