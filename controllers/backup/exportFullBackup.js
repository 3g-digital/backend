const User = require('../../models/userModel');
const Branch = require('../../models/branchModel');
const Item = require('../../models/inventoryModel');
const Customer = require('../../models/customerModel');
const Lead = require('../../models/leadModel');
const Dealer = require('../../models/dealerModel');
const Distributor = require('../../models/distributorModel');
const SalesBill = require('../../models/salesBillModel');
const Bill = require('../../models/billModel');
const BankAccount = require('../../models/bankAccountModel');
const TransferHistory = require('../../models/transferHistoryModel');
const WarrantyReplacement = require('../../models/warrantyReplacementModel');
const ReturnedInventory = require('../../models/returnedInventoryModel');
const StockHistory = require('../../models/stockHistoryModel');
const TechnicianInventory = require('../../models/technicianInventoryModel');
const TransactionHistory = require('../../models/transactionHistoryModel');
const OwnershipTransfer = require('../../models/ownershipTransferModel');
const XLSX = require('xlsx');

const exportFullBackup = async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators can export full backup.'
      });
    }

    console.log(`Full backup initiated by admin user ${req.userId}`);

    // Fetch all data from all collections in parallel
    const [
      branches,
      users,
      inventory,
      customers,
      leads,
      dealers,
      distributors,
      salesBills,
      bills,
      bankAccounts,
      transferHistory,
      warrantyReplacements,
      returnedInventory,
      stockHistory,
      technicianInventory,
      transactionHistory,
      ownershipTransfers
    ] = await Promise.all([
      Branch.find({}).lean(),
      User.find({}).select('-__v').lean(),
      Item.find({}).lean(),
      Customer.find({}).lean(),
      Lead.find({}).lean(),
      Dealer.find({}).lean(),
      Distributor.find({}).lean(),
      SalesBill.find({}).lean(),
      Bill.find({}).lean(),
      BankAccount.find({}).lean(),
      TransferHistory.find({}).lean(),
      WarrantyReplacement.find({}).lean(),
      ReturnedInventory.find({}).lean(),
      StockHistory.find({}).lean(),
      TechnicianInventory.find({}).lean(),
      TransactionHistory.find({}).lean(),
      OwnershipTransfer.find({}).lean()
    ]);

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Helper function to convert data to sheet format
    const createSheet = (data, sheetName) => {
      if (!data || data.length === 0) {
        // Create empty sheet with headers
        const emptySheet = XLSX.utils.json_to_sheet([]);
        XLSX.utils.book_append_sheet(workbook, emptySheet, sheetName);
        return;
      }

      // Convert ObjectIds and dates to strings for Excel compatibility
      const processedData = data.map((item, index) => {
        const processed = { 'S.No': index + 1 };

        Object.keys(item).forEach(key => {
          if (key === '__v') return; // Skip version key

          const value = item[key];

          // Handle different data types
          if (value === null || value === undefined) {
            processed[key] = '';
          } else if (value instanceof Date) {
            processed[key] = value.toISOString();
          } else if (typeof value === 'object' && value._id) {
            // ObjectId
            processed[key] = value.toString();
          } else if (Array.isArray(value)) {
            // Arrays - convert to JSON string
            processed[key] = JSON.stringify(value);
          } else if (typeof value === 'object') {
            // Nested objects - convert to JSON string
            processed[key] = JSON.stringify(value);
          } else {
            processed[key] = value;
          }
        });

        return processed;
      });

      const sheet = XLSX.utils.json_to_sheet(processedData);

      // Auto-size columns
      const cols = [];
      if (processedData.length > 0) {
        Object.keys(processedData[0]).forEach(() => {
          cols.push({ wch: 15 });
        });
      }
      sheet['!cols'] = cols;

      XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    };

    // Create sheets for all collections
    createSheet(branches, 'Branches');
    createSheet(users, 'Users');
    createSheet(inventory, 'Inventory');
    createSheet(customers, 'Customers');
    createSheet(leads, 'Leads');
    createSheet(dealers, 'Dealers');
    createSheet(distributors, 'Distributors');
    createSheet(salesBills, 'SalesBills');
    createSheet(bills, 'Bills');
    createSheet(bankAccounts, 'BankAccounts');
    createSheet(transferHistory, 'TransferHistory');
    createSheet(warrantyReplacements, 'WarrantyReplacements');
    createSheet(returnedInventory, 'ReturnedInventory');
    createSheet(stockHistory, 'StockHistory');
    createSheet(technicianInventory, 'TechnicianInventory');
    createSheet(transactionHistory, 'TransactionHistory');
    createSheet(ownershipTransfers, 'OwnershipTransfers');

    // Add metadata sheet
    const metadata = [{
      'Export Date': new Date().toISOString(),
      'Exported By': req.userId,
      'Total Branches': branches.length,
      'Total Users': users.length,
      'Total Inventory Items': inventory.length,
      'Total Customers': customers.length,
      'Total Leads': leads.length,
      'Total Dealers': dealers.length,
      'Total Distributors': distributors.length,
      'Total Sales Bills': salesBills.length,
      'Total Bills': bills.length,
      'Total Bank Accounts': bankAccounts.length,
      'Total Transfer History': transferHistory.length,
      'Total Warranty Replacements': warrantyReplacements.length,
      'Total Returned Inventory': returnedInventory.length,
      'Total Stock History': stockHistory.length,
      'Total Technician Inventory': technicianInventory.length,
      'Total Transaction History': transactionHistory.length,
      'Total Ownership Transfers': ownershipTransfers.length,
      'Software Version': '1.0'
    }];

    const metadataSheet = XLSX.utils.json_to_sheet(metadata);
    metadataSheet['!cols'] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'buffer'
    });

    // Generate filename with current date and time
    const currentDate = new Date();
    const dateStr = currentDate.toISOString().split('T')[0];
    const timeStr = currentDate.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `software_full_backup_${dateStr}_${timeStr}.xlsx`;

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);

    // Send file
    res.send(excelBuffer);

    console.log(`Full backup exported successfully by user ${req.userId}. Total records: ${
      branches.length + users.length + inventory.length + customers.length +
      leads.length + dealers.length + distributors.length + salesBills.length +
      bills.length + bankAccounts.length + transferHistory.length +
      warrantyReplacements.length + returnedInventory.length + stockHistory.length +
      technicianInventory.length + transactionHistory.length + ownershipTransfers.length
    }`);

  } catch (err) {
    console.error('Error exporting full backup:', err);
    res.status(500).json({
      success: false,
      message: 'Server error. Failed to export full backup.',
      error: err.message
    });
  }
};

module.exports = exportFullBackup;
