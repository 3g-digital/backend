const mongoose = require('mongoose');
const Item = require('../../models/inventoryModel');
const TechnicianInventory = require('../../models/technicianInventoryModel');

const getCurrentStockStatus = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { branch: branchQuery } = req.query;

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: 'Item ID is required'
      });
    }

    // Only managers and admins should access this endpoint
    if (!['manager', 'admin'].includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only managers or admins can view current stock.'
      });
    }

    let item = await Item.findOne({ id: itemId }).populate('stock.branch', 'name');

    if (!item && mongoose.Types.ObjectId.isValid(itemId)) {
      item = await Item.findById(itemId).populate('stock.branch', 'name');
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Determine branch scope
    let branchScope = null;

    if (req.userRole === 'manager') {
      branchScope = req.userBranch;
    } else if (req.userRole === 'admin' && branchQuery) {
      branchScope = branchQuery;
    }

    if (branchScope) {
      branchScope = branchScope.toString();
    }

    const normalizeId = (value) => {
      if (!value) return null;
      if (typeof value === 'string') return value;
      if (value instanceof mongoose.Types.ObjectId) return value.toString();
      if (value._id) return value._id.toString();
      if (typeof value.toString === 'function') return value.toString();
      return null;
    };

    // Build available stock (remaining in branch inventory)
    let availableStockEntries = item.stock || [];
    if (branchScope) {
      availableStockEntries = availableStockEntries.filter(entry => {
        const entryBranchId = normalizeId(entry.branch);
        return entryBranchId && entryBranchId === branchScope.toString();
      });
    }

    const available = {
      serialized: [],
      generic: []
    };

    if (item.type === 'serialized-product') {
      available.serialized = availableStockEntries.map(entry => ({
        serialNumber: entry.serialNumber,
        date: entry.date,
        remark: entry.remark,
        branchId: normalizeId(entry.branch),
        branchName: entry.branch?.name || null
      }));
    } else if (item.type === 'generic-product') {
      available.generic = availableStockEntries
        .filter(entry => entry.quantity > 0)
        .map(entry => ({
          quantity: entry.quantity,
          date: entry.date,
          remark: entry.remark,
          branchId: normalizeId(entry.branch),
          branchName: entry.branch?.name || null
        }));
    }

    // Build assigned stock (inventory currently with technicians)
    const technicianQuery = { item: item._id };
    if (branchScope) {
      technicianQuery.branch = branchScope;
    }

    const technicianInventories = await TechnicianInventory.find(technicianQuery)
      .populate('technician', 'firstName lastName username')
      .populate('branch', 'name');

    const assigned = technicianInventories
      .map(techInv => {
        const serializedItems = (techInv.serializedItems || [])
          .filter(serialItem => serialItem.status === 'active')
          .map(serialItem => ({
            serialNumber: serialItem.serialNumber,
            assignedAt: serialItem.assignedAt,
            assignedBy: serialItem.assignedBy
          }));

        const genericQuantity = techInv.genericQuantity || 0;

        return {
          technicianId: techInv.technician?._id,
          technicianName: techInv.technician
            ? `${techInv.technician.firstName} ${techInv.technician.lastName}`
            : 'Unknown Technician',
          username: techInv.technician?.username || '',
          branchName: techInv.branch?.name || '',
          serializedItems,
          genericQuantity
        };
      })
      .filter(entry =>
        item.type === 'serialized-product'
          ? entry.serializedItems.length > 0
          : entry.genericQuantity > 0
      );

    res.json({
      success: true,
      data: {
        item: {
          id: item.id,
          name: item.name,
          type: item.type,
          unit: item.unit
        },
        available,
        assigned
      }
    });
  } catch (err) {
    console.error('Error fetching current stock status:', err);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};

module.exports = getCurrentStockStatus;
