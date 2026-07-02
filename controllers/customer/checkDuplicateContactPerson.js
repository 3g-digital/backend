const Customer = require('../../models/customerModel');

/**
 * Check if a contact person phone number already exists
 * GET /api/check-duplicate-contact-person?phone=<phoneNumber>
 */
const checkDuplicateContactPerson = async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Find customer with this contact person phone
    const existingCustomer = await Customer.findOne({
      contactPersonPhone: phone
    }).select('name firmName phoneNumber contactPersonName contactPersonPhone');

    if (existingCustomer) {
      return res.status(200).json({
        success: true,
        exists: true,
        customer: {
          name: existingCustomer.name,
          firmName: existingCustomer.firmName,
          phoneNumber: existingCustomer.phoneNumber,
          contactPersonName: existingCustomer.contactPersonName,
          contactPersonPhone: existingCustomer.contactPersonPhone
        }
      });
    }

    return res.status(200).json({
      success: true,
      exists: false
    });

  } catch (err) {
    console.error('Error checking duplicate contact person:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while checking duplicate contact person'
    });
  }
};

module.exports = checkDuplicateContactPerson;
