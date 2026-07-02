const Customer = require('../../models/customerModel');
const User = require('../../models/userModel'); 
const { generateResponse } = require('../../helpers/responseGenerator');

const getWorkOrderDetails = async (req, res) => {
  try {
    const { customerId, orderId } = req.params;
   
    // Find customer and fully populate work order
    const customer = await Customer.findById(customerId)
      .populate({
        path: 'workOrders.technician',
        model: 'User',
        select: 'firstName lastName'
      })
      .populate({
        path: 'workOrders.assignedBy',
        model: 'User',
        select: 'firstName lastName'
      })
      .populate({
        path: 'workOrders.statusHistory.updatedBy',
        model: 'User',
        select: 'firstName lastName'
      })
      .populate({
        path: 'workOrders.bills',
        model: 'Bill',
        populate: {
          path: 'items'
        }
      });
    if (!customer) {
      return res.status(404).json(generateResponse(false, 'Customer not found'));
    }
   
    const workOrder = customer.workOrders.find(order => order.orderId === orderId);
    if (!workOrder) {
      return res.status(404).json(generateResponse(false, 'Work order not found'));
    }
   
    // Add customer info to work order
    const workOrderWithCustomerInfo = {
      ...workOrder.toObject(),
      customerId: customer._id,
      customerName: customer.name,
      customerPhone: customer.phoneNumber,
      customerEmail: customer.email,
      customerAddress: customer.address,
      customerFirmName: customer.firmName,
      branchName: customer.branch ? customer.branch.name : null
    };
   
     // Add project information
     const project = customer.projects.find(p => p.projectId === workOrder.projectId);
if (project) {
  // Set project category from work order if missing in project
  const category = project.projectCategory || workOrder.projectCategory || 'New Installation';
  workOrderWithCustomerInfo.projectCategory = category;
  workOrderWithCustomerInfo.projectCreatedAt = project.createdAt;
  
  // Add original technician info regardless of category for repair work orders
  if (project.completedBy && workOrder.projectCategory === 'Repair') {
    workOrderWithCustomerInfo.originalTechnician = await User.findById(project.completedBy)
      .select('firstName lastName phone');
    console.log("Added original technician to response:", workOrderWithCustomerInfo.originalTechnician);
  }
}
     
    res.status(200).json(generateResponse(true, 'Work order details retrieved successfully', workOrderWithCustomerInfo));
  } catch (err) {
    console.error('Error fetching work order details:', err);
    res.status(500).json(generateResponse(false, 'Server error while fetching work order details'));
  }
};
module.exports = getWorkOrderDetails;