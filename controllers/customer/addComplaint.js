const Customer = require('../../models/customerModel');
const generateOrderId = require('../../helpers/generateOrderId');

const addComplaint = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { existingProjectId, complaintRemark } = req.body;
    
    console.log('Received complaint request:', { customerId, existingProjectId, complaintRemark });

    // Validate required fields
    if (!existingProjectId || !complaintRemark) {
      return res.status(400).json({
        success: false,
        message: 'Existing project ID and complaint remark are required'
      });
    }

    // Find the customer
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if user has permission (admin can access all, manager only their branch)
    if (req.user.role !== 'admin' && customer.branch.toString() !== req.user.branch.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to add complaint for this customer'
      });
    }

    // Find the existing project
    const existingProject = customer.projects.find(p => p.projectId === existingProjectId);
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        message: 'Existing project not found'
      });
    }

    // Check if project is eligible for complaints
    // Either project is completed OR has completed workOrders
    const hasCompletedWorkOrder = customer.workOrders && 
      customer.workOrders.find(wo => 
        wo.projectId === existingProject.projectId && wo.status === 'completed'
      );
    
    if (existingProject.status !== 'completed' && !hasCompletedWorkOrder) {
      return res.status(400).json({
        success: false,
        message: 'Can only create complaints for completed projects or projects with completed work orders'
      });
    }

    // Generate order ID
    const orderId = await generateOrderId();
    
    // Validate orderId generation
    if (!orderId) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate order ID'
      });
    }

    // Create repair work order
    const repairWorkOrder = {
      orderId,
      projectId: existingProject.projectId,
      projectType: existingProject.projectType,
      projectCategory: 'Repair',
      status: 'pending',
      initialRemark: complaintRemark,
      createdBy: req.userId,
      createdByRole: req.user.role,
      createdByName: `${req.user.firstName} ${req.user.lastName}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('Creating repair work order:', repairWorkOrder);

    // Add the repair work order to customer
    customer.workOrders.push(repairWorkOrder);
    await customer.save();

    console.log('Complaint work order created successfully');

    res.status(201).json({
      success: true,
      message: 'Complaint registered successfully',
      data: {
        customer,
        workOrder: repairWorkOrder,
        relatedProject: existingProject
      }
    });
  } catch (err) {
    console.error('Error adding complaint:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while adding complaint'
    });
  }
};

module.exports = addComplaint;