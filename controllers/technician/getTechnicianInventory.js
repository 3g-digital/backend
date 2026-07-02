const TechnicianInventory = require('../../models/technicianInventoryModel');
const Item = require('../../models/inventoryModel');

const getTechnicianInventory = async (req, res) => {
  try {
    // Determine the technician ID to fetch inventory for
    let technicianId = req.userId;

    // If technicianId is provided in query params, validate manager access
    if (req.query.technicianId) {
      // Only managers can view other technicians' inventory
      if (req.userRole !== 'manager') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only managers can view other technicians inventory.'
        });
      }

      // Validate that the technician belongs to the manager's branch
      const User = require('../../models/userModel');
      const technician = await User.findOne({
        _id: req.query.technicianId,
        branch: req.userBranch
      });

      if (!technician) {
        return res.status(404).json({
          success: false,
          message: 'Technician not found or does not belong to your branch.'
        });
      }

      technicianId = req.query.technicianId;
    } else {
      // Only technicians can access their own inventory without technicianId param
      if (req.userRole !== 'technician') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only technicians can view their inventory.'
        });
      }
    }

    // Step 1: Find all inventory assigned to this technician
    const technicianInventory = await TechnicianInventory.find({
      technician: technicianId
    }).populate('item');
   
    // Step 2: Format the inventory items (serialized and generic products)
    const formattedInventory = technicianInventory
      .filter(inventory => inventory.item !== null)
      .map(inventory => {
        const item = inventory.item;
        
        return {
          id: inventory._id, // Fixed the syntax error
          itemId: item.id || item._id.toString(),
          itemName: item.name,
          type: item.type,
          unit: item.unit,
          salePrice: item.pricing?.customerPrice || item.salePrice || 0, // Use customer price for technician billing
          serializedItems: inventory.serializedItems,
          genericQuantity: inventory.genericQuantity,
          lastUpdated: inventory.updatedAt || inventory.createdAt
        };
      });
    
    // Step 3: Fetch all service items (these don't need to be assigned)
    const serviceItems = await Item.find({ type: 'service' });
    
    // Step 4: Format service items
    const formattedServices = serviceItems.map(service => {
      return {
        id: service._id,
        itemId: service.id || service._id.toString(),
        itemName: service.name,
        type: service.type,
        salePrice: service.pricing?.customerPrice || service.salePrice || 0, // Use customer price for technician billing
        // Services don't have these properties but adding them for consistency
        unit: 'N/A',
        serializedItems: [],
        genericQuantity: 0,
        lastUpdated: service.updatedAt || service.createdAt
      };
    });
    
    // Step 5: Combine both arrays
    const combinedInventory = [...formattedInventory, ...formattedServices];
   
    res.status(200).json({
      success: true,
      count: combinedInventory.length,
      data: combinedInventory
    });
  } catch (err) {
    console.error('Error fetching technician inventory:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching inventory'
    });
  }
};

module.exports = getTechnicianInventory;