const ReturnedInventory = require('../../models/returnedInventoryModel');
const User = require('../../models/userModel');
const Item = require('../../models/inventoryModel');

const getReturnedInventory = async (req, res) => {
  try {
    // Only managers can view returned inventory
    if (req.userRole !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Only managers can view returned inventory.'
      });
    }
    
    // Get all pending returned inventory for manager's branch
    const returnedItems = await ReturnedInventory.find({
      branch: req.userBranch,
      status: 'pending'
    })
    .populate('technician', 'firstName lastName username email')
    .populate({
      path: 'items.item',
      select: 'id name type unit'
    })
    .sort('-returnedAt');
    
    // Format the response
    const formattedData = returnedItems.map(entry => ({
      id: entry._id,
      technician: {
        id: entry.technician._id,
        name: `${entry.technician.firstName} ${entry.technician.lastName}`,
        username: entry.technician.username,
        email: entry.technician.email
      },
      returnedAt: entry.returnedAt,
      itemCount: entry.items.length,
      totalQuantity: entry.items.reduce((sum, item) => sum + item.quantity, 0),
      status: entry.status,
      items: entry.items
        .filter(item => item.item !== null)
        .map(item => ({
          id: item._id,
          itemId: item.item.id,
          name: item.item.name,
          type: item.item.type,
          unit: item.item.unit,
          quantity: item.quantity,
          serialNumber: item.serialNumber || null
        }))
    }));
    
    res.json({
      success: true,
      count: formattedData.length,
      data: formattedData
    });
  } catch (err) {
    console.error('Error fetching returned inventory:', err);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};

module.exports = getReturnedInventory;