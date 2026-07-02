const Customer = require('../../models/customerModel');
const BillModel = require('../../models/billModel');
const TechnicianInventory = require('../../models/technicianInventoryModel');
const { generateResponse } = require('../../helpers/responseGenerator');
const User = require('../../models/userModel');
const sendNotification = require('../../helpers/push/sendNotification');

const rejectBill = async (req, res) => {
  try {
    const { userId, role, firstName, lastName } = req.user;
    const { billId, rejectionReason } = req.body;

    if (role !== 'admin' && role !== 'manager') {
      return res.status(403).json(generateResponse(false, 'Access denied. Only managers can reject bills.'));
    }

    if (!billId || !rejectionReason || rejectionReason.trim().length < 5) {
      return res.status(400).json(generateResponse(false, 'Bill ID and a valid rejection reason (min 5 characters) are required.'));
    }

    // Find the bill
    const bill = await BillModel.findById(billId);
    if (!bill) {
      return res.status(404).json(generateResponse(false, 'Bill not found'));
    }

    if (bill.status === 'rejected') {
      return res.status(400).json(generateResponse(false, 'Bill is already rejected'));
    }

    // Update bill status and rejection info
    bill.status = 'rejected';
    bill.rejectionReason = rejectionReason;
    bill.isReverted = true;
    await bill.save();

    // Find the customer and work order related to this bill
    const customer = await Customer.findById(bill.customer);
    if (!customer) {
      return res.status(404).json(generateResponse(false, 'Customer not found'));
    }

    const workOrder = customer.workOrders.find(order => order.orderId === bill.orderId);
    if (!workOrder) {
      return res.status(404).json(generateResponse(false, 'Work order not found'));
    }

    // Update work order status to rejected
    workOrder.status = 'rejected';

    // Add rejection entry to status history
    workOrder.statusHistory.unshift({
      status: 'rejected',
      remark: rejectionReason,
      updatedBy: userId,
      updatedAt: new Date()
    });

    // Revert inventory items back to technician's stock
    const technicianId = workOrder.technician;
    if (technicianId) {
      for (const billItem of bill.items) {
        if (billItem.type === 'generic-product') {
          let invItem = await TechnicianInventory.findOne({ technician: technicianId, item: billItem.itemId });
          if (invItem) {
            invItem.genericQuantity = (invItem.genericQuantity || 0) + billItem.quantity;
            invItem.lastUpdated = new Date();
            invItem.lastUpdatedBy = userId;
            await invItem.save();
          } else {
            invItem = new TechnicianInventory({
              technician: technicianId,
              item: billItem.itemId,
              genericQuantity: billItem.quantity,
              lastUpdated: new Date(),
              lastUpdatedBy: userId
            });
            await invItem.save();
          }
        } else if (billItem.type === 'serialized-product') {
          let invItem = await TechnicianInventory.findOne({ technician: technicianId, item: billItem.itemId });
          if (invItem) {
            const serializedItem = invItem.serializedItems.find(si => si.serialNumber === billItem.serialNumber);
            if (serializedItem) {
              serializedItem.status = 'active';
              serializedItem.usedInWorkOrder = null;
              serializedItem.usedAt = null;
            } else {
              invItem.serializedItems.push({
                serialNumber: billItem.serialNumber,
                status: 'active',
                usedInWorkOrder: null,
                usedAt: null,
                assignedAt: new Date(),
                assignedBy: userId
              });
            }
            invItem.lastUpdated = new Date();
            invItem.lastUpdatedBy = userId;
            await invItem.save();
          } else {
            invItem = new TechnicianInventory({
              technician: technicianId,
              item: billItem.itemId,
              serializedItems: [{
                serialNumber: billItem.serialNumber,
                status: 'active',
                usedInWorkOrder: null,
                usedAt: null,
                assignedAt: new Date(),
                assignedBy: userId
              }],
              lastUpdated: new Date(),
              lastUpdatedBy: userId
            });
            await invItem.save();
          }
        }
      }
    }

    await customer.save();

    if (technicianId) {
      try {
        const technician = await User.findById(technicianId).select('fcmTokens');
        const tokens = technician?.fcmTokens?.map((entry) => entry.token).filter(Boolean) || [];

        if (tokens.length) {
          const baseCustomerName = customer.name || 'Customer';
          const customerDisplayName = customer.firmName
            ? `${customer.firmName} (${baseCustomerName})`
            : baseCustomerName;
          const reasonLine = rejectionReason.replace(/\s+/g, ' ').trim();
          const truncatedReason = reasonLine.length > 120 ? `${reasonLine.slice(0, 117)}...` : reasonLine;

          const notificationTitle = 'Bill Rejected';
          const notificationBody = `${customerDisplayName} • Status: Rejected • Reason: ${truncatedReason}`;

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
        console.error('Failed to notify technician about bill rejection:', notificationError);
      }
    }

    const updatedCustomer = await Customer.findById(customer._id)
      .populate({
        path: 'workOrders.technician',
        select: 'firstName lastName'
      })
      .populate({
        path: 'workOrders.assignedBy',
        select: 'firstName lastName'
      })
      .populate({
        path: 'workOrders.statusHistory.updatedBy',
        select: 'firstName lastName'
      });

    const updatedWorkOrder = updatedCustomer.workOrders.find(order => order.orderId === bill.orderId);

    return res.json(generateResponse(true, 'Bill rejected and inventory reverted successfully', {
      customerId: customer._id,
      customerName: customer.name,
      orderId: updatedWorkOrder.orderId,
      projectId: updatedWorkOrder.projectId,
      projectType: updatedWorkOrder.projectType,
      status: updatedWorkOrder.status,
      technician: updatedWorkOrder.technician,
      statusHistory: updatedWorkOrder.statusHistory,
      billingInfo: updatedWorkOrder.bills.map(billItem => {
        if (billItem._id.toString() === bill._id.toString()) {
          return {
            ...billItem,
            status: bill.status
          };
        }
        return billItem;
      }),
      createdAt: updatedWorkOrder.createdAt,
      updatedAt: updatedWorkOrder.updatedAt,
      rejectedBy: { firstName, lastName: lastName || '' },
      rejectedAt: new Date()
    }));
  } catch (error) {
    console.error('Error rejecting bill:', error);
    return res.status(500).json(generateResponse(false, 'Server error while rejecting bill'));
  }
};

module.exports = rejectBill;