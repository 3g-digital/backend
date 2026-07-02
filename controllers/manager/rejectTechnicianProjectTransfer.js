const Customer = require('../../models/customerModel');
const User = require('../../models/userModel');
const sendNotification = require('../../helpers/push/sendNotification');

const rejectTechnicianProjectTransfer = async (req, res) => {
  try {
    const { customerId, orderId, rejectReason } = req.body;
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
      status: 'transfer-rejected',
      remark: rejectReason,
      updatedBy: userId,
      updatedAt: new Date()
    });

    // Update the work order status back to in-progress (reject means technician continues work)
    workOrder.status = 'in-progress';
    workOrder.updatedAt = new Date();

    await customer.save();

    if (workOrder.technician) {
      try {
        const technician = await User.findById(workOrder.technician).select('fcmTokens');
        const tokens = technician?.fcmTokens?.map((entry) => entry.token).filter(Boolean) || [];

        if (tokens.length) {
          const baseCustomerName = customer.name || 'Customer';
          const customerDisplayName = customer.firmName
            ? `${customer.firmName} (${baseCustomerName})`
            : baseCustomerName;
          const cleanReason = (rejectReason || '').replace(/\s+/g, ' ').trim();
          const truncatedReason = cleanReason.length > 120 ? `${cleanReason.slice(0, 117)}...` : cleanReason;
          const notificationTitle = 'Project Transfer Request Rejected';
          const notificationBody = `${customerDisplayName} • Status: Transfer Rejected - Continue Work${truncatedReason ? ` • Reason: ${truncatedReason}` : ''}`;

          await sendNotification({
            tokens,
            notification: {
              title: notificationTitle,
              body: notificationBody,
            },
            data: {
              title: notificationTitle,
              body: notificationBody,
              customerName: baseCustomerName,
              customerFirm: customer.firmName || '',
              status: 'rejected',
              reason: truncatedReason,
              url: '/technician-dashboard',
              icon: '/logo192.png',
            },
          });
        }
      } catch (notificationError) {
        console.error('Failed to notify technician about transfer rejection:', notificationError);
      }
    }

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
      message: 'Transfer request rejected successfully',
      data: updatedWorkOrder
    });
  } catch (err) {
    console.error('Error rejecting transfer:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while rejecting transfer'
    });
  }
};

module.exports = rejectTechnicianProjectTransfer;
