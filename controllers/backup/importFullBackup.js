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
const mongoose = require('mongoose');

const importFullBackup = async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators can import full backup.'
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please select an Excel file to import.'
      });
    }

    // Check file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];

    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Please upload an Excel file (.xlsx or .xls).'
      });
    }

    console.log(`Full backup restore initiated by admin user ${req.userId}`);

    // Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });

    // Expected sheets
    const expectedSheets = [
      'Branches', 'Users', 'Inventory', 'Customers', 'Leads',
      'Dealers', 'Distributors', 'SalesBills', 'Bills', 'BankAccounts',
      'TransferHistory', 'WarrantyReplacements', 'ReturnedInventory',
      'StockHistory', 'TechnicianInventory', 'TransactionHistory',
      'OwnershipTransfers', 'Metadata'
    ];

    // Validate that all required sheets exist
    const missingSheets = expectedSheets.filter(sheet => !workbook.SheetNames.includes(sheet));
    if (missingSheets.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid backup file. Missing sheets: ${missingSheets.join(', ')}`
      });
    }

    // Helper function to parse sheet data
    const parseSheet = (sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return [];

      const data = XLSX.utils.sheet_to_json(sheet);

      // Remove S.No column and process data
      return data.map(row => {
        const processed = {};
        Object.keys(row).forEach(key => {
          if (key === 'S.No') return; // Skip serial number

          let value = row[key];

          // Try to parse JSON strings (for arrays and nested objects)
          if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
            try {
              value = JSON.parse(value);
            } catch (e) {
              // Keep as string if parsing fails
            }
          }

          // Convert empty strings to null for optional fields
          if (value === '') {
            value = null;
          }

          processed[key] = value;
        });
        return processed;
      });
    };

    // Parse all sheets
    const backupData = {
      branches: parseSheet('Branches'),
      users: parseSheet('Users'),
      inventory: parseSheet('Inventory'),
      customers: parseSheet('Customers'),
      leads: parseSheet('Leads'),
      dealers: parseSheet('Dealers'),
      distributors: parseSheet('Distributors'),
      salesBills: parseSheet('SalesBills'),
      bills: parseSheet('Bills'),
      bankAccounts: parseSheet('BankAccounts'),
      transferHistory: parseSheet('TransferHistory'),
      warrantyReplacements: parseSheet('WarrantyReplacements'),
      returnedInventory: parseSheet('ReturnedInventory'),
      stockHistory: parseSheet('StockHistory'),
      technicianInventory: parseSheet('TechnicianInventory'),
      transactionHistory: parseSheet('TransactionHistory'),
      ownershipTransfers: parseSheet('OwnershipTransfers')
    };

    console.log('Backup data parsed successfully');

    // Mapping for old ObjectIds to new ObjectIds
    const idMappings = {
      branches: {},
      users: {},
      inventory: {},
      customers: {},
      leads: {},
      dealers: {},
      distributors: {},
      salesBills: {},
      bills: {},
      bankAccounts: {},
      transferHistory: {},
      warrantyReplacements: {},
      returnedInventory: {},
      stockHistory: {},
      technicianInventory: {},
      transactionHistory: {},
      ownershipTransfers: {}
    };

    // Statistics
    const stats = {
      branches: 0,
      users: 0,
      inventory: 0,
      customers: 0,
      leads: 0,
      dealers: 0,
      distributors: 0,
      salesBills: 0,
      bills: 0,
      bankAccounts: 0,
      transferHistory: 0,
      warrantyReplacements: 0,
      returnedInventory: 0,
      stockHistory: 0,
      technicianInventory: 0,
      transactionHistory: 0,
      ownershipTransfers: 0
    };

    // WARNING: This will delete all existing data
    // Clear all collections
    await Promise.all([
      Branch.deleteMany({}),
      User.deleteMany({}),
      Item.deleteMany({}),
      Customer.deleteMany({}),
      Lead.deleteMany({}),
      Dealer.deleteMany({}),
      Distributor.deleteMany({}),
      SalesBill.deleteMany({}),
      Bill.deleteMany({}),
      BankAccount.deleteMany({}),
      TransferHistory.deleteMany({}),
      WarrantyReplacement.deleteMany({}),
      ReturnedInventory.deleteMany({}),
      StockHistory.deleteMany({}),
      TechnicianInventory.deleteMany({}),
      TransactionHistory.deleteMany({}),
      OwnershipTransfer.deleteMany({})
    ]);

    console.log('All collections cleared');

    // Import data in sequence (order is critical!)

    // 1. Import Branches first (as they are referenced by many other collections)
    if (backupData.branches.length > 0) {
      for (const branchData of backupData.branches) {
        const oldId = branchData._id;
        delete branchData._id;
        delete branchData.S_No;

        const newBranch = await Branch.create(branchData);
        idMappings.branches[oldId] = newBranch._id.toString();
        stats.branches++;
      }
      console.log(`Imported ${stats.branches} branches`);
    }

    // 2. Import Users (they reference branches)
    if (backupData.users.length > 0) {
      for (const userData of backupData.users) {
        const oldId = userData._id;
        delete userData._id;
        delete userData.S_No;

        // Map branch reference
        if (userData.branch && idMappings.branches[userData.branch]) {
          userData.branch = idMappings.branches[userData.branch];
        } else if (userData.branch) {
          userData.branch = null; // Branch not found in mapping
        }

        // Password is already hashed, so we need to save without pre-save hook
        const newUser = new User(userData);
        await newUser.save({ validateBeforeSave: true });
        idMappings.users[oldId] = newUser._id.toString();
        stats.users++;
      }
      console.log(`Imported ${stats.users} users`);
    }

    // 3. Import Bank Accounts
    if (backupData.bankAccounts.length > 0) {
      for (const bankData of backupData.bankAccounts) {
        const oldId = bankData._id;
        delete bankData._id;
        delete bankData.S_No;

        // Map branch reference
        if (bankData.branch && idMappings.branches[bankData.branch]) {
          bankData.branch = idMappings.branches[bankData.branch];
        }

        const newBank = await BankAccount.create(bankData);
        idMappings.bankAccounts[oldId] = newBank._id.toString();
        stats.bankAccounts++;
      }
      console.log(`Imported ${stats.bankAccounts} bank accounts`);
    }

    // 4. Import Inventory
    if (backupData.inventory.length > 0) {
      for (const inventoryData of backupData.inventory) {
        const oldId = inventoryData._id;
        delete inventoryData._id;
        delete inventoryData.S_No;

        // Map branch reference
        if (inventoryData.branch && idMappings.branches[inventoryData.branch]) {
          inventoryData.branch = idMappings.branches[inventoryData.branch];
        }

        // Map stock array branch references
        if (inventoryData.stock && Array.isArray(inventoryData.stock)) {
          inventoryData.stock = inventoryData.stock.map(stockItem => {
            if (stockItem.branch && idMappings.branches[stockItem.branch]) {
              stockItem.branch = idMappings.branches[stockItem.branch];
            }
            return stockItem;
          });
        }

        const newItem = await Item.create(inventoryData);
        idMappings.inventory[oldId] = newItem._id.toString();
        stats.inventory++;
      }
      console.log(`Imported ${stats.inventory} inventory items`);
    }

    // 5. Import Dealers
    if (backupData.dealers.length > 0) {
      for (const dealerData of backupData.dealers) {
        const oldId = dealerData._id;
        delete dealerData._id;
        delete dealerData.S_No;

        // Map references
        if (dealerData.branch && idMappings.branches[dealerData.branch]) {
          dealerData.branch = idMappings.branches[dealerData.branch];
        }
        if (dealerData.createdBy && idMappings.users[dealerData.createdBy]) {
          dealerData.createdBy = idMappings.users[dealerData.createdBy];
        }
        if (dealerData.updatedBy && idMappings.users[dealerData.updatedBy]) {
          dealerData.updatedBy = idMappings.users[dealerData.updatedBy];
        }

        // Map nested remarks
        if (dealerData.remarks && Array.isArray(dealerData.remarks)) {
          dealerData.remarks = dealerData.remarks.map(remark => {
            if (remark.createdBy && idMappings.users[remark.createdBy]) {
              remark.createdBy = idMappings.users[remark.createdBy];
            }
            return remark;
          });
        }

        const newDealer = await Dealer.create(dealerData);
        idMappings.dealers[oldId] = newDealer._id.toString();
        stats.dealers++;
      }
      console.log(`Imported ${stats.dealers} dealers`);
    }

    // 6. Import Distributors
    if (backupData.distributors.length > 0) {
      for (const distributorData of backupData.distributors) {
        const oldId = distributorData._id;
        delete distributorData._id;
        delete distributorData.S_No;

        // Map references
        if (distributorData.branch && idMappings.branches[distributorData.branch]) {
          distributorData.branch = idMappings.branches[distributorData.branch];
        }
        if (distributorData.createdBy && idMappings.users[distributorData.createdBy]) {
          distributorData.createdBy = idMappings.users[distributorData.createdBy];
        }
        if (distributorData.updatedBy && idMappings.users[distributorData.updatedBy]) {
          distributorData.updatedBy = idMappings.users[distributorData.updatedBy];
        }

        // Map nested remarks
        if (distributorData.remarks && Array.isArray(distributorData.remarks)) {
          distributorData.remarks = distributorData.remarks.map(remark => {
            if (remark.createdBy && idMappings.users[remark.createdBy]) {
              remark.createdBy = idMappings.users[remark.createdBy];
            }
            return remark;
          });
        }

        const newDistributor = await Distributor.create(distributorData);
        idMappings.distributors[oldId] = newDistributor._id.toString();
        stats.distributors++;
      }
      console.log(`Imported ${stats.distributors} distributors`);
    }

    // 7. Import Leads
    if (backupData.leads.length > 0) {
      for (const leadData of backupData.leads) {
        const oldId = leadData._id;
        delete leadData._id;
        delete leadData.S_No;

        // Map references
        if (leadData.branch && idMappings.branches[leadData.branch]) {
          leadData.branch = idMappings.branches[leadData.branch];
        }
        if (leadData.createdBy && idMappings.users[leadData.createdBy]) {
          leadData.createdBy = idMappings.users[leadData.createdBy];
        }
        if (leadData.updatedBy && idMappings.users[leadData.updatedBy]) {
          leadData.updatedBy = idMappings.users[leadData.updatedBy];
        }
        if (leadData.convertedToCustomer && idMappings.customers[leadData.convertedToCustomer]) {
          leadData.convertedToCustomer = idMappings.customers[leadData.convertedToCustomer];
        }
        if (leadData.convertedToDealer && idMappings.dealers[leadData.convertedToDealer]) {
          leadData.convertedToDealer = idMappings.dealers[leadData.convertedToDealer];
        }
        if (leadData.convertedToDistributor && idMappings.distributors[leadData.convertedToDistributor]) {
          leadData.convertedToDistributor = idMappings.distributors[leadData.convertedToDistributor];
        }

        // Map nested remarks
        if (leadData.remarks && Array.isArray(leadData.remarks)) {
          leadData.remarks = leadData.remarks.map(remark => {
            if (remark.createdBy && idMappings.users[remark.createdBy]) {
              remark.createdBy = idMappings.users[remark.createdBy];
            }
            return remark;
          });
        }

        const newLead = await Lead.create(leadData);
        idMappings.leads[oldId] = newLead._id.toString();
        stats.leads++;
      }
      console.log(`Imported ${stats.leads} leads`);
    }

    // 8. Import Customers (with nested projects and work orders)
    if (backupData.customers.length > 0) {
      for (const customerData of backupData.customers) {
        const oldId = customerData._id;
        delete customerData._id;
        delete customerData.S_No;

        // Map references
        if (customerData.branch && idMappings.branches[customerData.branch]) {
          customerData.branch = idMappings.branches[customerData.branch];
        }
        if (customerData.createdBy && idMappings.users[customerData.createdBy]) {
          customerData.createdBy = idMappings.users[customerData.createdBy];
        }
        if (customerData.updatedBy && idMappings.users[customerData.updatedBy]) {
          customerData.updatedBy = idMappings.users[customerData.updatedBy];
        }
        if (customerData.leadId && idMappings.leads[customerData.leadId]) {
          customerData.leadId = idMappings.leads[customerData.leadId];
        }

        // Map nested projects
        if (customerData.projects && Array.isArray(customerData.projects)) {
          customerData.projects = customerData.projects.map(project => {
            if (project.createdBy && idMappings.users[project.createdBy]) {
              project.createdBy = idMappings.users[project.createdBy];
            }
            if (project.completedBy && idMappings.users[project.completedBy]) {
              project.completedBy = idMappings.users[project.completedBy];
            }
            return project;
          });
        }

        // Map nested work orders
        if (customerData.workOrders && Array.isArray(customerData.workOrders)) {
          customerData.workOrders = customerData.workOrders.map(workOrder => {
            if (workOrder.createdBy && idMappings.users[workOrder.createdBy]) {
              workOrder.createdBy = idMappings.users[workOrder.createdBy];
            }
            if (workOrder.technician && idMappings.users[workOrder.technician]) {
              workOrder.technician = idMappings.users[workOrder.technician];
            }
            if (workOrder.assignedBy && idMappings.users[workOrder.assignedBy]) {
              workOrder.assignedBy = idMappings.users[workOrder.assignedBy];
            }

            // Map bills array
            if (workOrder.bills && Array.isArray(workOrder.bills)) {
              workOrder.bills = workOrder.bills.map(billId => {
                return idMappings.bills[billId] || billId;
              });
            }

            // Map billingInfo
            if (workOrder.billingInfo && Array.isArray(workOrder.billingInfo)) {
              workOrder.billingInfo = workOrder.billingInfo.map(billing => {
                if (billing.billId && idMappings.bills[billing.billId]) {
                  billing.billId = idMappings.bills[billing.billId];
                }
                return billing;
              });
            }

            // Map itemsUsed
            if (workOrder.itemsUsed && Array.isArray(workOrder.itemsUsed)) {
              workOrder.itemsUsed = workOrder.itemsUsed.map(item => {
                if (item.itemId && idMappings.inventory[item.itemId]) {
                  item.itemId = idMappings.inventory[item.itemId];
                }
                return item;
              });
            }

            // Map statusHistory
            if (workOrder.statusHistory && Array.isArray(workOrder.statusHistory)) {
              workOrder.statusHistory = workOrder.statusHistory.map(history => {
                if (history.updatedBy && idMappings.users[history.updatedBy]) {
                  history.updatedBy = idMappings.users[history.updatedBy];
                }
                return history;
              });
            }

            return workOrder;
          });
        }

        const newCustomer = await Customer.create(customerData);
        idMappings.customers[oldId] = newCustomer._id.toString();
        stats.customers++;
      }
      console.log(`Imported ${stats.customers} customers`);
    }

    // 9. Import Bills
    if (backupData.bills.length > 0) {
      for (const billData of backupData.bills) {
        const oldId = billData._id;
        delete billData._id;
        delete billData.S_No;

        // Map references
        if (billData.customer && idMappings.customers[billData.customer]) {
          billData.customer = idMappings.customers[billData.customer];
        }
        if (billData.workOrder && idMappings.customers[billData.workOrder]) {
          billData.workOrder = idMappings.customers[billData.workOrder];
        }
        if (billData.createdBy && idMappings.users[billData.createdBy]) {
          billData.createdBy = idMappings.users[billData.createdBy];
        }
        if (billData.approvedBy && idMappings.users[billData.approvedBy]) {
          billData.approvedBy = idMappings.users[billData.approvedBy];
        }
        if (billData.branch && idMappings.branches[billData.branch]) {
          billData.branch = idMappings.branches[billData.branch];
        }

        // Map items
        if (billData.items && Array.isArray(billData.items)) {
          billData.items = billData.items.map(item => {
            if (item.itemId && idMappings.inventory[item.itemId]) {
              item.itemId = idMappings.inventory[item.itemId];
            }
            return item;
          });
        }

        const newBill = await Bill.create(billData);
        idMappings.bills[oldId] = newBill._id.toString();
        stats.bills++;
      }
      console.log(`Imported ${stats.bills} bills`);
    }

    // 10. Import Sales Bills
    if (backupData.salesBills.length > 0) {
      for (const salesBillData of backupData.salesBills) {
        const oldId = salesBillData._id;
        delete salesBillData._id;
        delete salesBillData.S_No;

        // Map references
        if (salesBillData.customerId) {
          if (salesBillData.customerModel === 'Dealer' && idMappings.dealers[salesBillData.customerId]) {
            salesBillData.customerId = idMappings.dealers[salesBillData.customerId];
          } else if (salesBillData.customerModel === 'Distributor' && idMappings.distributors[salesBillData.customerId]) {
            salesBillData.customerId = idMappings.distributors[salesBillData.customerId];
          } else if (salesBillData.customerModel === 'Customer' && idMappings.customers[salesBillData.customerId]) {
            salesBillData.customerId = idMappings.customers[salesBillData.customerId];
          }
        }

        if (salesBillData.branch && idMappings.branches[salesBillData.branch]) {
          salesBillData.branch = idMappings.branches[salesBillData.branch];
        }
        if (salesBillData.createdBy && idMappings.users[salesBillData.createdBy]) {
          salesBillData.createdBy = idMappings.users[salesBillData.createdBy];
        }
        if (salesBillData.updatedBy && idMappings.users[salesBillData.updatedBy]) {
          salesBillData.updatedBy = idMappings.users[salesBillData.updatedBy];
        }

        // Map payment details
        if (salesBillData.paymentDetails && salesBillData.paymentDetails.selectedBankAccount && idMappings.bankAccounts[salesBillData.paymentDetails.selectedBankAccount]) {
          salesBillData.paymentDetails.selectedBankAccount = idMappings.bankAccounts[salesBillData.paymentDetails.selectedBankAccount];
        }

        // Map items
        if (salesBillData.items && Array.isArray(salesBillData.items)) {
          salesBillData.items = salesBillData.items.map(item => {
            if (item.itemId && idMappings.inventory[item.itemId]) {
              item.itemId = idMappings.inventory[item.itemId];
            }
            return item;
          });
        }

        const newSalesBill = await SalesBill.create(salesBillData);
        idMappings.salesBills[oldId] = newSalesBill._id.toString();
        stats.salesBills++;
      }
      console.log(`Imported ${stats.salesBills} sales bills`);
    }

    // 11. Import Transfer History
    if (backupData.transferHistory.length > 0) {
      for (const transferData of backupData.transferHistory) {
        const oldId = transferData._id;
        delete transferData._id;
        delete transferData.S_No;

        // Map references
        if (transferData.fromManager && idMappings.users[transferData.fromManager]) {
          transferData.fromManager = idMappings.users[transferData.fromManager];
        }
        if (transferData.toManager && idMappings.users[transferData.toManager]) {
          transferData.toManager = idMappings.users[transferData.toManager];
        }
        if (transferData.fromBranch && idMappings.branches[transferData.fromBranch]) {
          transferData.fromBranch = idMappings.branches[transferData.fromBranch];
        }
        if (transferData.toBranch && idMappings.branches[transferData.toBranch]) {
          transferData.toBranch = idMappings.branches[transferData.toBranch];
        }

        // Map items
        if (transferData.items && Array.isArray(transferData.items)) {
          transferData.items = transferData.items.map(item => {
            if (item.itemId && idMappings.inventory[item.itemId]) {
              item.itemId = idMappings.inventory[item.itemId];
            }
            return item;
          });
        }

        const newTransfer = await TransferHistory.create(transferData);
        idMappings.transferHistory[oldId] = newTransfer._id.toString();
        stats.transferHistory++;
      }
      console.log(`Imported ${stats.transferHistory} transfer history records`);
    }

    // 12. Import Warranty Replacements
    if (backupData.warrantyReplacements.length > 0) {
      for (const warrantyData of backupData.warrantyReplacements) {
        const oldId = warrantyData._id;
        delete warrantyData._id;
        delete warrantyData.S_No;

        // Map references
        if (warrantyData.item && idMappings.inventory[warrantyData.item]) {
          warrantyData.item = idMappings.inventory[warrantyData.item];
        }
        if (warrantyData.replacedItem && idMappings.inventory[warrantyData.replacedItem]) {
          warrantyData.replacedItem = idMappings.inventory[warrantyData.replacedItem];
        }
        if (warrantyData.customer && idMappings.customers[warrantyData.customer]) {
          warrantyData.customer = idMappings.customers[warrantyData.customer];
        }
        if (warrantyData.registeredBy && idMappings.users[warrantyData.registeredBy]) {
          warrantyData.registeredBy = idMappings.users[warrantyData.registeredBy];
        }
        if (warrantyData.completedBy && idMappings.users[warrantyData.completedBy]) {
          warrantyData.completedBy = idMappings.users[warrantyData.completedBy];
        }
        if (warrantyData.branch && idMappings.branches[warrantyData.branch]) {
          warrantyData.branch = idMappings.branches[warrantyData.branch];
        }

        const newWarranty = await WarrantyReplacement.create(warrantyData);
        idMappings.warrantyReplacements[oldId] = newWarranty._id.toString();
        stats.warrantyReplacements++;
      }
      console.log(`Imported ${stats.warrantyReplacements} warranty replacements`);
    }

    // 13. Import Returned Inventory
    if (backupData.returnedInventory.length > 0) {
      for (const returnData of backupData.returnedInventory) {
        const oldId = returnData._id;
        delete returnData._id;
        delete returnData.S_No;

        // Map references
        if (returnData.technician && idMappings.users[returnData.technician]) {
          returnData.technician = idMappings.users[returnData.technician];
        }
        if (returnData.manager && idMappings.users[returnData.manager]) {
          returnData.manager = idMappings.users[returnData.manager];
        }
        if (returnData.branch && idMappings.branches[returnData.branch]) {
          returnData.branch = idMappings.branches[returnData.branch];
        }

        // Map items
        if (returnData.items && Array.isArray(returnData.items)) {
          returnData.items = returnData.items.map(item => {
            if (item.item && idMappings.inventory[item.item]) {
              item.item = idMappings.inventory[item.item];
            }
            return item;
          });
        }

        const newReturn = await ReturnedInventory.create(returnData);
        idMappings.returnedInventory[oldId] = newReturn._id.toString();
        stats.returnedInventory++;
      }
      console.log(`Imported ${stats.returnedInventory} returned inventory records`);
    }

    // 14. Import Stock History
    if (backupData.stockHistory.length > 0) {
      for (const stockData of backupData.stockHistory) {
        const oldId = stockData._id;
        delete stockData._id;
        delete stockData.S_No;

        // Map references
        if (stockData.item && idMappings.inventory[stockData.item]) {
          stockData.item = idMappings.inventory[stockData.item];
        }
        if (stockData.branch && idMappings.branches[stockData.branch]) {
          stockData.branch = idMappings.branches[stockData.branch];
        }
        if (stockData.addedBy && idMappings.users[stockData.addedBy]) {
          stockData.addedBy = idMappings.users[stockData.addedBy];
        }

        const newStock = await StockHistory.create(stockData);
        idMappings.stockHistory[oldId] = newStock._id.toString();
        stats.stockHistory++;
      }
      console.log(`Imported ${stats.stockHistory} stock history records`);
    }

    // 15. Import Technician Inventory
    if (backupData.technicianInventory.length > 0) {
      for (const techInvData of backupData.technicianInventory) {
        const oldId = techInvData._id;
        delete techInvData._id;
        delete techInvData.S_No;

        // Map references
        if (techInvData.technician && idMappings.users[techInvData.technician]) {
          techInvData.technician = idMappings.users[techInvData.technician];
        }
        if (techInvData.item && idMappings.inventory[techInvData.item]) {
          techInvData.item = idMappings.inventory[techInvData.item];
        }
        if (techInvData.assignedBy && idMappings.users[techInvData.assignedBy]) {
          techInvData.assignedBy = idMappings.users[techInvData.assignedBy];
        }
        if (techInvData.branch && idMappings.branches[techInvData.branch]) {
          techInvData.branch = idMappings.branches[techInvData.branch];
        }

        const newTechInv = await TechnicianInventory.create(techInvData);
        idMappings.technicianInventory[oldId] = newTechInv._id.toString();
        stats.technicianInventory++;
      }
      console.log(`Imported ${stats.technicianInventory} technician inventory records`);
    }

    // 16. Import Transaction History
    if (backupData.transactionHistory.length > 0) {
      for (const transactionData of backupData.transactionHistory) {
        const oldId = transactionData._id;
        delete transactionData._id;
        delete transactionData.S_No;

        // Map references
        if (transactionData.bill && idMappings.salesBills[transactionData.bill]) {
          transactionData.bill = idMappings.salesBills[transactionData.bill];
        }
        if (transactionData.customer) {
          if (transactionData.customerModel === 'Dealer' && idMappings.dealers[transactionData.customer]) {
            transactionData.customer = idMappings.dealers[transactionData.customer];
          } else if (transactionData.customerModel === 'Distributor' && idMappings.distributors[transactionData.customer]) {
            transactionData.customer = idMappings.distributors[transactionData.customer];
          } else if (transactionData.customerModel === 'Customer' && idMappings.customers[transactionData.customer]) {
            transactionData.customer = idMappings.customers[transactionData.customer];
          }
        }
        if (transactionData.branch && idMappings.branches[transactionData.branch]) {
          transactionData.branch = idMappings.branches[transactionData.branch];
        }
        if (transactionData.processedBy && idMappings.users[transactionData.processedBy]) {
          transactionData.processedBy = idMappings.users[transactionData.processedBy];
        }
        if (transactionData.bankAccount && idMappings.bankAccounts[transactionData.bankAccount]) {
          transactionData.bankAccount = idMappings.bankAccounts[transactionData.bankAccount];
        }

        const newTransaction = await TransactionHistory.create(transactionData);
        idMappings.transactionHistory[oldId] = newTransaction._id.toString();
        stats.transactionHistory++;
      }
      console.log(`Imported ${stats.transactionHistory} transaction history records`);
    }

    // 17. Import Ownership Transfers
    if (backupData.ownershipTransfers.length > 0) {
      for (const ownershipData of backupData.ownershipTransfers) {
        const oldId = ownershipData._id;
        delete ownershipData._id;
        delete ownershipData.S_No;

        // Map references
        if (ownershipData.item && idMappings.inventory[ownershipData.item]) {
          ownershipData.item = idMappings.inventory[ownershipData.item];
        }
        if (ownershipData.fromOwner && idMappings.customers[ownershipData.fromOwner]) {
          ownershipData.fromOwner = idMappings.customers[ownershipData.fromOwner];
        }
        if (ownershipData.toOwner && idMappings.customers[ownershipData.toOwner]) {
          ownershipData.toOwner = idMappings.customers[ownershipData.toOwner];
        }
        if (ownershipData.transferredBy && idMappings.users[ownershipData.transferredBy]) {
          ownershipData.transferredBy = idMappings.users[ownershipData.transferredBy];
        }

        const newOwnership = await OwnershipTransfer.create(ownershipData);
        idMappings.ownershipTransfers[oldId] = newOwnership._id.toString();
        stats.ownershipTransfers++;
      }
      console.log(`Imported ${stats.ownershipTransfers} ownership transfer records`);
    }

    // Calculate total imported records
    const totalImported = Object.values(stats).reduce((sum, count) => sum + count, 0);

    console.log(`Full backup restore completed successfully. Total records imported: ${totalImported}`);

    res.json({
      success: true,
      message: `Successfully restored ${totalImported} records from backup`,
      stats,
      totalImported
    });

  } catch (err) {
    console.error('Error importing full backup:', err);
    res.status(500).json({
      success: false,
      message: 'Server error. Failed to import full backup.',
      error: err.message
    });
  }
};

module.exports = importFullBackup;
