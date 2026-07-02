const Customer = require('../../models/customerModel');

const cancelWorkOrder = async (req, res) => {
  try {
    const { customerId, orderId, reason } = req.body;
    const { user } = req;

    if (!customerId || !orderId || !reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Customer, work order and cancellation reason are required'
      });
    }

    if (!user || !['admin', 'manager'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only managers or admins can cancel work orders'
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
        message: 'Not authorized to cancel work orders for this branch'
      });
    }

    const workOrder = customer.workOrders.find(order => order.orderId === orderId);

    if (!workOrder) {
      return res.status(404).json({
        success: false,
        message: 'Work order not found'
      });
    }

    if (workOrder.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Work order is already cancelled'
      });
    }

    if (workOrder.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending work orders can be cancelled'
      });
    }

    const trimmedReason = reason.trim();
    const timestamp = new Date();

    workOrder.status = 'cancelled';
    workOrder.updatedAt = timestamp;
    workOrder.statusHistory = workOrder.statusHistory || [];
    workOrder.statusHistory.unshift({
      status: 'cancelled',
      remark: trimmedReason,
      updatedBy: user._id,
      updatedAt: timestamp
    });

    await customer.save();

    const updatedCustomer = await Customer.findById(customerId)
      .populate('workOrders.technician', 'firstName lastName')
      .populate('workOrders.assignedBy', 'firstName lastName')
      .populate('workOrders.statusHistory.updatedBy', 'firstName lastName');

    const updatedOrder = updatedCustomer.workOrders.find(order => order.orderId === orderId);

    return res.status(200).json({
      success: true,
      message: 'Work order cancelled successfully',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Error cancelling work order:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while cancelling work order'
    });
  }
};

module.exports = cancelWorkOrder;
