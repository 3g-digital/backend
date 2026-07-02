const Customer = require('../../models/customerModel');
const User = require('../../models/userModel');
const sendNotification = require('../../helpers/push/sendNotification');
const generateOrderId = require('../../helpers/generateOrderId');

const acceptTechnicianProjectTransfer = async (req, res) => {
  try {
    const { customerId, orderId, remark } = req.body;
   
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
   
    // Add entry to status history for the EXISTING work order
    workOrder.statusHistory.push({
      status: 'transferred',
      remark: remark,
      updatedBy: req.user._id,
      updatedAt: new Date()
    });
   
    // Update the work order status to transferred
    workOrder.status = 'transferred';
    workOrder.updatedAt = new Date();
    
    // Create a NEW work order with the same project details but a new ID
    const newOrderId = await generateOrderId();
    
    const newWorkOrder = {
      orderId: newOrderId,
      projectId: workOrder.projectId,
      projectType: workOrder.projectType,
      projectCategory: workOrder.projectCategory || 'New Installation',
      status: 'pending', // Set as pending to be assigned again
      initialRemark: workOrder.initialRemark,
      instructions: workOrder.instructions,
      statusHistory: [{
        status: 'pending',
        remark: `Created after transfer of order ${orderId}. Transfer reason: ${remark}`,
        updatedBy: req.user._id,
        updatedAt: new Date()
      }],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Add the new work order to the customer
    customer.workOrders.push(newWorkOrder);
    
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
          const notificationTitle = 'Project Transfer Request Approved';
          const notificationBody = `${customerDisplayName} • Status: Approved`;

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
              status: 'approved',
              url: '/technician-dashboard',
              icon: '/logo192.png',
            },
          });
        }
      } catch (notificationError) {
        console.error('Failed to notify technician about transfer approval:', notificationError);
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
      message: 'Transfer request accepted and new work order created',
      data: updatedWorkOrder,
      newOrderId: newOrderId
    });
  } catch (err) {
    console.error('Error accepting transfer:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while accepting transfer'
    });
  }
};

module.exports = acceptTechnicianProjectTransfer;
