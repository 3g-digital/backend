const ReturnedInventory = require('../../models/returnedInventoryModel');

const getTechnicianReturnRequests = async (req, res) => {
  try {
    // Only technicians can view their return requests
    if (req.userRole !== 'technician') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Only technicians can view return requests.'
      });
    }

    // Get all return requests for this technician (all statuses)
    const returnRequests = await ReturnedInventory.find({
      technician: req.userId
    })
    .populate({
      path: 'items.item',
      select: 'id name type unit'
    })
    .populate('rejectedBy', 'firstName lastName username')
    .populate('confirmedBy', 'firstName lastName username')
    .sort('-returnedAt');

    // Format the response
    const formattedData = returnRequests.map(request => ({
      id: request._id,
      status: request.status,
      returnedAt: request.returnedAt,
      confirmedAt: request.confirmedAt,
      rejectedAt: request.rejectedAt,
      rejectionReason: request.rejectionReason,
      itemCount: request.items.length,
      totalQuantity: request.items.reduce((sum, item) => sum + item.quantity, 0),
      confirmedBy: request.confirmedBy ? {
        id: request.confirmedBy._id,
        name: `${request.confirmedBy.firstName} ${request.confirmedBy.lastName}`,
        username: request.confirmedBy.username
      } : null,
      rejectedBy: request.rejectedBy ? {
        id: request.rejectedBy._id,
        name: `${request.rejectedBy.firstName} ${request.rejectedBy.lastName}`,
        username: request.rejectedBy.username
      } : null,
      items: request.items
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
    console.error('Error fetching technician return requests:', err);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};

module.exports = getTechnicianReturnRequests;