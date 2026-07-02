// controllers/customer/createWorkOrder.js
const Customer = require('../../models/customerModel');
const generateOrderId = require('../../helpers/generateOrderId');

// Create a new work order for a customer
const createWorkOrder = async (req, res) => {
  try {
    const { customerId, projectType, projectCategory, initialRemark, existingProjectId } = req.body;
    console.log('Received request body:', req.body);

   
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
        message: 'Not authorized to add work order for this customer'
      });
    }
   
    // Generate order ID
    const orderId = await generateOrderId(); // Custom function to generate unique order IDs
    
    // Validate orderId generation
    if (!orderId) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate order ID'
      });
    }
   
    // Default project category to "New Installation" if not provided
    // With this logic
let finalProjectCategory;
if (existingProjectId && projectCategory === 'Repair') {
  finalProjectCategory = 'Repair';
} else {
  finalProjectCategory = projectCategory || 'New Installation';
}

console.log('Setting project category to:', finalProjectCategory);
    
    
    let projectId;
    let newProject = null;
    let finalProjectType = projectType;
    
    // For complaints (Repair), use existing project if provided
    if (finalProjectCategory === 'Repair' && existingProjectId) {
      // Find the existing project
      const existingProject = customer.projects.find(p => p.projectId === existingProjectId);
      
      if (!existingProject) {
        return res.status(404).json({
          success: false,
          message: 'Existing project not found'
        });
      }
      
      projectId = existingProject.projectId;
      finalProjectType = existingProject.projectType;
    } else {
      // For new installations, create a new project
      projectId = `PRJ-${Date.now().toString().slice(-6)}`;
      
      // Add project to customer's projects array
      newProject = {
        projectId,
        projectType: finalProjectType,
        projectCategory: finalProjectCategory,
        initialRemark,
        createdBy: req.userId,
        createdByRole: req.user.role,
        createdByName: `${req.user.firstName} ${req.user.lastName}`,
        createdAt: new Date()
      };
      
      customer.projects.push(newProject);
    }

    // After finalProjectCategory is determined:
console.log('Input data:', {
  customerId,
  projectType,
  projectCategory,
  existingProjectId,
  finalProjectCategory
});
   
    // Create work order
    const workOrder = {
      orderId,
      projectId,
      projectType: finalProjectType,
      projectCategory: finalProjectCategory,
      status: 'pending',
      initialRemark,
      createdBy: req.userId,
      createdByRole: req.user.role,
      createdByName: `${req.user.firstName} ${req.user.lastName}`,
      createdAt: new Date()
    };
    console.log('Work order being created:', workOrder);

    customer.workOrders.push(workOrder);
    await customer.save();
    console.log('Saved work order:', customer.workOrders[customer.workOrders.length - 1]);
   
    res.status(201).json({
      success: true,
      data: {
        customer,
        project: newProject || { projectId, projectType: finalProjectType },
        workOrder
      }
    });
  } catch (err) {
    console.error('Error creating work order:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while creating work order'
    });
  }
};

module.exports = createWorkOrder;