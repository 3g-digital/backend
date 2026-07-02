const Item = require('../../models/inventoryModel');
const TechnicianInventory = require('../../models/technicianInventoryModel');
const Bill = require('../../models/billModel');
const SalesBill = require('../../models/salesBillModel');

const checkSerialNumber = async (req, res) => {
    try {
      const { serialNumber } = req.params;

      // We need to check if the user is a manager and filter by branch
      let query = { 'stock.serialNumber': serialNumber };

      // If the user is a manager, add branch filter
      if (req.userRole === 'manager' && req.userBranch) {
        // Find items where serial number exists AND is in manager's branch
        query = {
          'stock': {
            $elemMatch: {
              'serialNumber': serialNumber,
              'branch': req.userBranch // Only check in manager's branch
            }
          }
        };
      }

      // Check if serial number exists in inventory stock with the appropriate query
      const existingItem = await Item.findOne(query);

      if (existingItem) {
        return res.json({
          exists: true,
          item: {
            id: existingItem.id,
            name: existingItem.name
          }
        });
      }

      // If manager and not found in their branch, we can check if it exists elsewhere
      if (req.userRole === 'manager' && req.userBranch) {
        const anyBranchItem = await Item.findOne({
          'stock.serialNumber': serialNumber
        });

        if (anyBranchItem) {
          return res.json({
            exists: false,
            message: 'Serial number exists but not in your branch'
          });
        }
      }

      // Check if serial number is assigned to any technician
      const technicianAssignment = await TechnicianInventory.findOne({
        'serializedItems.serialNumber': serialNumber,
        'serializedItems.status': 'active'
      }).populate('technician', 'firstName lastName username');

      if (technicianAssignment) {
        const techName = technicianAssignment.technician
          ? `${technicianAssignment.technician.firstName} ${technicianAssignment.technician.lastName}`
          : 'Unknown Technician';

        return res.json({
          exists: true,
          assignedToTechnician: true,
          technicianName: techName,
          username: technicianAssignment.technician?.username,
          message: `Serial number is currently assigned to technician: ${techName}`
        });
      }

      // Check if serial number is used in any work order bill (customer bills)
      const usedInBill = await Bill.findOne({
        'items.serialNumber': serialNumber,
        status: { $ne: 'rejected' } // Exclude rejected bills
      }).populate('customer', 'name');

      if (usedInBill) {
        const customerName = usedInBill.customer?.name || 'Unknown Customer';

        return res.json({
          exists: true,
          usedInBill: true,
          customerName: customerName,
          billNumber: usedInBill.billNumber,
          message: `Serial number has already been used in a bill for customer: ${customerName}`
        });
      }

      // Check if serial number is used in any sales bill (dealer/distributor bills)
      const usedInSalesBill = await SalesBill.findOne({
        'items.serialNumber': serialNumber
      });

      if (usedInSalesBill) {
        const entityName = usedInSalesBill.customerName || 'Unknown';
        const entityType = usedInSalesBill.customerType || 'entity';

        return res.json({
          exists: true,
          usedInBill: true,
          entityName: entityName,
          entityType: entityType,
          billNumber: usedInSalesBill.billNumber,
          message: `Serial number has already been used in a bill for ${entityType}: ${entityName}`
        });
      }

      res.json({
        exists: false,
        message: 'Serial number is available'
      });
    } catch (err) {
      console.error('Error checking serial number:', err);
      res.status(500).json({
        success: false,
        message: 'Server error. Please try again later.'
      });
    }
};
module.exports = checkSerialNumber;