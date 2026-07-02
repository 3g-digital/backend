const Customer = require('../../models/customerModel');

const closeProject = async (req, res) => {
  try {
    const { customerId, orderId } = req.body;
    const userId = req.user._id;

    // Find the customer
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Find the specific work order
    const workOrder = customer.workOrders.find(order => order.orderId === orderId);
    if (!workOrder) {
      return res.status(404).json({
        success: false,
        message: 'Work order not found'
      });
    }

    // Make sure the work order is in transferring status
    if (workOrder.status !== 'transferring') {
      return res.status(400).json({
        success: false,
        message: 'Work order is not in transferring status'
      });
    }

    // Add entry to status history for the work order
    workOrder.statusHistory.push({
      status: 'job-closed',
      remark: `Project closed by manager ${req.user.firstName} ${req.user.lastName}. No further work will be done on this project.`,
      updatedBy: userId,
      updatedAt: new Date()
    });

    // Update the work order status to job-closed
    workOrder.status = 'job-closed';
    workOrder.updatedAt = new Date();

    await customer.save();

    // Format the updated work order for response
    const updatedWorkOrder = {
      ...workOrder.toObject(),
      customerId: customer._id,
      customerName: customer.name,
      customerAddress: customer.address,
      customerPhone: customer.phoneNumber
    };

    res.status(200).json({
      success: true,
      message: 'Project closed successfully',
      data: updatedWorkOrder
    });
  } catch (err) {
    console.error('Error closing project:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while closing project'
    });
  }
};

module.exports = closeProject;
