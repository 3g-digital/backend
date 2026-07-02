const Customer = require('../../models/customerModel');
const generateOrderId = require('../../helpers/generateOrderId');
// const { sendTemplate, toE164 } = require('../../helpers/whatsapp')

const createCustomer = async (req, res) => {
  try {
    const { projectType, initialRemark, isExistingCustomer, completionDate, installedBy, installedByEngineer, engineerMobileNo, customerStatus } = req.body;

    // Check if project type is provided (not required for Billing customers)
    if (!projectType && customerStatus !== 'Billing') {
      return res.status(400).json({
        success: false,
        message: 'Project type is required'
      });
    }

    // Phone number uniqueness validation removed - Multiple customers can have same phone number
    // const existingCustomer = await Customer.findOne({
    //   phoneNumber: req.body.phoneNumber
    // });

    // if (existingCustomer) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'A customer with this phone number already exists'
    //   });
    // }

    // Set branch based on user role
    let branch = req.body.branch;
    if (req.user.role !== 'admin') {
      branch = req.user.branch;
    }

    // Prepare customer data
    const customerData = {
      ...req.body,
      branch,
      createdBy: req.user.id,
      updatedBy: req.user.id
    };

    // Set customer status if provided
    if (req.body.customerStatus) {
      customerData.customerStatus = req.body.customerStatus;
    }

    // Handle Billing customers (no projects, no work orders)
    if (customerStatus === 'Billing') {
      customerData.projects = [];
      customerData.workOrders = [];

      // Create billing customer
      const customer = await Customer.create(customerData);

      return res.status(201).json({
        success: true,
        data: customer
      });
    }

    // Generate project ID for non-billing customers
    const projectId = `PRJ-${Date.now().toString().slice(-6)}`;
    customerData.projectType = projectType;

    if (isExistingCustomer) {
      // For existing customers, create completed project without work order
      // Fix: Create local date to avoid timezone conversion
      const installationDate = new Date(completionDate + 'T12:00:00.000Z'); // Add noon time in UTC to avoid timezone issues
      const projectCreationDate = new Date(completionDate + 'T12:00:00.000Z'); // Same date for createdAt

      customerData.projects = [{
        projectId,
        projectType,
        projectCategory: 'New Installation',
        initialRemark,
        installedBy,
        installedByEngineer: installedByEngineer || '',
        engineerMobileNo: engineerMobileNo || '',
        completionDate: installationDate,
        status: 'completed',
        createdAt: projectCreationDate
      }];
      customerData.workOrders = []; // No work order for existing customers
    } else {
      // For new customers, create project and work order as before
      const orderId = await generateOrderId();
      
      customerData.projects = [{
        projectId,
        projectType,
        projectCategory: 'New Installation',
        initialRemark,
        createdAt: new Date()
      }];
      customerData.workOrders = [{
        orderId,
        projectId,
        projectType,
        projectCategory: 'New Installation',
        status: 'pending',
        initialRemark,
        createdAt: new Date()
      }];
    }
    
    // Create new customer
    const customer = await Customer.create(customerData);

     // === SEND WHATSAPP TEMPLATE (fire-and-forget) ===
    // (async () => {
    //   try {
    //     const to = toE164(customer.phoneNumber);
    //     if (!to) return;

    //     const customerName =
    //       customer.name ||
    //       customer.fullName ||
    //       req.body.name ||
    //       req.body.customerName ||
    //       'Customer';

    //     await sendTemplate({
    //       to,
    //       name: 'customer_welcome',
    //       params: [
    //         customerName,                      // {{customer_name}}
    //         process.env.BRAND_NAME || '3G Digital',     // {{brand_name}}
    //         projectId,                         // {{project_id}}
    //       ]
    //     });
    //   } catch (e) {
    //     // WhatsApp fail hone par bhi customer creation success rahe
    //     console.error('WhatsApp template send failed:', e.message, e.meta || '');
    //   }
    // })();
    // ===============================================
   
    res.status(201).json({
      success: true,
      data: customer
    });
  } catch (err) {
    console.error('Error creating customer:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while creating customer'
    });
  }
};

module.exports = createCustomer;