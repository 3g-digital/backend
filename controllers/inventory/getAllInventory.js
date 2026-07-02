const Item = require('../../models/inventoryModel');

const getAllInventory = async (req, res) => {
  try {
    // For billing system, managers need to see all items but with their branch stock only
    // This allows them to create bills from available inventory
    let query = {};

    // Fetch all items (admin creates items globally, managers can bill from any item)
    const items = await Item.find(query)
      .populate('branch', 'name location') // Populate branch details
      .populate('stock.branch', 'name location') // Populate stock branch details
      .sort('-createdAt');

    // Determine which branch to filter by
    let filterBranchId = null;

    // For managers, use their branch
    if (req.userRole === 'manager' && req.userBranch) {
      filterBranchId = req.userBranch;
    }
    // For admins, use the branch query parameter (from customer's branch)
    else if (req.user && req.user.role === 'admin' && req.query.branch) {
      filterBranchId = req.query.branch;
    }

    // Filter stock based on branch
    let filteredItems = items;
    if (filterBranchId) {
      filteredItems = items.map(item => {
        // Filter stock to only show specified branch stock
        const branchStock = item.stock.filter(stockItem =>
          stockItem.branch && stockItem.branch._id.toString() === filterBranchId.toString()
        );

        return {
          ...item.toObject(),
          stock: branchStock
        };
      });
    }
    
    res.json({
      success: true,
      items: filteredItems
    });
  } catch (err) {
    console.error('Error fetching inventory items:', err);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};

module.exports = getAllInventory;