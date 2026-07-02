const Customer = require('../../models/customerModel');

const addManagerInstruction = async (req, res) => {
  try {
    const { customerId, orderId, instruction } = req.body;
    const { user } = req;

    if (!customerId || !orderId || !instruction || !instruction.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Customer, work order and instruction are required'
      });
    }

    if (!user || !['admin', 'manager'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only managers or admins can send instructions'
      });
    }

    const customer = await Customer.findById(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    if (
      user.role !== 'admin' &&
      customer.branch &&
      customer.branch.toString() !== user.branch?.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update work orders for this branch'
      });
    }

    const workOrder = customer.workOrders.find(order => order.orderId === orderId);

    if (!workOrder) {
      return res.status(404).json({
        success: false,
        message: 'Work order not found'
      });
    }

    if (['completed', 'cancelled', 'job-closed'].includes(workOrder.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add instructions to a closed or cancelled work order'
      });
    }

    const trimmedInstruction = instruction.trim();
    const timestamp = new Date();

    workOrder.statusHistory = workOrder.statusHistory || [];
    workOrder.statusHistory.push({
      status: 'instruction',
      remark: trimmedInstruction,
      updatedBy: user._id,
      updatedAt: timestamp
    });

    workOrder.updatedAt = timestamp;

    await customer.save();

    const updatedCustomer = await Customer.findById(customerId)
      .populate('workOrders.technician', 'firstName lastName')
      .populate('workOrders.assignedBy', 'firstName lastName')
      .populate('workOrders.statusHistory.updatedBy', 'firstName lastName');

    const updatedOrder = updatedCustomer.workOrders.find(order => order.orderId === orderId);

    return res.status(200).json({
      success: true,
      message: 'Instruction added successfully',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Error adding manager instruction:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while adding instruction'
    });
  }
};

module.exports = addManagerInstruction;
