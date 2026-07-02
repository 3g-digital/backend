const Item = require('../../models/inventoryModel');
const StockHistory = require('../../models/stockHistoryModel');

const getStockHistory = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { branch } = req.query; // Optional branch filter

    // Find the item
    const item = await Item.findOne({ id: itemId });
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Build query based on user role
    const query = { item: item._id };

    // If manager, only show their branch history
    if (req.userRole === 'manager') {
      query.branch = req.userBranch;
    }
    // If admin and branch filter is provided
    else if (req.userRole === 'admin' && branch) {
      query.branch = branch;
    }

    // Fetch stock addition history with populated references
    const history = await StockHistory.find(query)
      .populate('branch', 'name location')
      .populate('addedBy', 'firstName lastName')
      .sort({ addedDate: -1 }); // Most recent first

    // Calculate current total stock from item.stock
    let totalCurrentStock = 0;
    if (item.type === 'serialized-product') {
      totalCurrentStock = item.stock ? item.stock.filter(s => {
        if (req.userRole === 'manager') {
          return s.branch.toString() === req.userBranch.toString();
        }
        return branch ? s.branch.toString() === branch : true;
      }).length : 0;
    } else if (item.type === 'generic-product') {
      totalCurrentStock = item.stock ? item.stock
        .filter(s => {
          if (req.userRole === 'manager') {
            return s.branch.toString() === req.userBranch.toString();
          }
          return branch ? s.branch.toString() === branch : true;
        })
        .reduce((sum, s) => sum + s.quantity, 0) : 0;
    }

    res.json({
      success: true,
      item: {
        id: item.id,
        name: item.name,
        type: item.type,
        unit: item.unit
      },
      totalCurrentStock,
      history: history.map(h => ({
        id: h._id,
        serialNumber: h.serialNumber,
        quantity: h.quantity,
        addedDate: h.addedDate,
        addedBy: h.addedBy,
        remark: h.remark,
        branch: h.branch
      }))
    });
  } catch (err) {
    console.error('Error fetching stock history:', err);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};

module.exports = getStockHistory;
