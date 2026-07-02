const Lead = require('../../models/leadModel');
const Customer = require('../../models/customerModel');

const convertToExistingCustomer = async (req, res) => {
  try {
    const { projectType, installationDate, installedBy, remarks, isExistingCustomer } = req.body;

    // Validate required fields
    if (!projectType) {
      return res.status(400).json({
        success: false,
        message: 'Project type is required'
      });
    }

    if (!installationDate) {
      return res.status(400).json({
        success: false,
        message: 'Installation date is required'
      });
    }

    if (!installedBy) {
      return res.status(400).json({
        success: false,
        message: 'Installed by is required'
      });
    }

    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    // Check if user has access to this lead
    if (req.user.role !== 'admin' && lead.branch.toString() !== req.user.branch.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to convert this lead'
      });
    }

    // Check if already converted
    if (lead.isConverted) {
      return res.status(400).json({
        success: false,
        message: 'Lead already converted'
      });
    }

    // Generate project ID
    const projectId = `PRJ-${Date.now().toString().slice(-6)}`;

    // Create new customer from lead data (existing customer with completed service)
    const customer = await Customer.create({
      name: lead.name,
      phoneNumber: lead.phoneNumber,
      firmName: lead.firmName,
      whatsappNumber: lead.whatsappNumber,
      address: lead.address,
      branch: lead.branch,
      convertedFromLead: true,
      leadId: lead._id,
      customerStatus: 'Existing',  // Mark as existing customer
      projects: [{
        projectId,
        projectType,
        projectCategory: 'New Installation', // Use allowed enum value
        status: 'completed', // Automatically completed
        installedBy,
        completionDate: new Date(installationDate),
        initialRemark: remarks || `Existing customer service: ${projectType}`,
        createdAt: new Date(),
        completedAt: new Date(installationDate)
      }],
      // No workOrders created for existing customers
      createdBy: req.user.id,
      updatedBy: req.user.id
    });

    // Update lead as converted
    await Lead.findByIdAndUpdate(req.params.id, {
      isConverted: true,
      convertedToCustomer: customer._id,
      convertedType: 'existing_customer',
      convertedAt: Date.now(),
      updatedBy: req.user.id,
      updatedAt: Date.now()
    });

    res.status(200).json({
      success: true,
      message: 'Lead successfully converted to existing customer',
      data: customer
    });
  } catch (err) {
    console.error('Error converting lead to existing customer:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while converting lead to existing customer'
    });
  }
};

module.exports = convertToExistingCustomer;