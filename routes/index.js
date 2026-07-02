const express = require('express');
const router = express.Router();
const authToken = require('../middleware/authToken');
const { loginController } = require('../controllers/user/loginController');
const getAdminUsersController = require('../controllers/admin/getAdminUsersController');
const addAdminUserController = require('../controllers/admin/addAdminUserController');
const getManagersController = require('../controllers/admin/getManagersController');
const addManagerController = require('../controllers/admin/addManagerController');
const getTechniciansController = require('../controllers/admin/getTechniciansController');
const addTechnicianController = require('../controllers/admin/addTechnicianController');
const registerNotificationToken = require('../controllers/notifications/registerToken');
const removeNotificationToken = require('../controllers/notifications/removeToken');

// Bank Account controllers
const getBankAccountsController = require('../controllers/admin/getBankAccountsController');
const addBankAccountController = require('../controllers/admin/addBankAccountController');
const updateBankAccountController = require('../controllers/admin/updateBankAccountController');
const deleteBankAccountController = require('../controllers/admin/deleteBankAccountController');
const getBranchesController = require('../controllers/admin/getBranchesController');
const addBranchController = require('../controllers/admin/addBranchController');
const updateUserStatusController = require('../controllers/admin/updateUserStatusController');
const search = require('../controllers/Lead/search');
const getAllLeads = require('../controllers/Lead/getAllLeads');
const createLead = require('../controllers/Lead/createLead');
const getLead = require('../controllers/Lead/getLead');
const updateLead = require('../controllers/Lead/updateLead');
const addRemark = require('../controllers/Lead/addRemark');
const convertToCustomer = require('../controllers/Lead/convertToCustomer');
const convertToDealer = require('../controllers/Lead/convertToDealer');
const convertToDistributor = require('../controllers/Lead/convertToDistributor');
const convertToExistingCustomer = require('../controllers/Lead/convertToExistingCustomer');
const getAllCustomers = require('../controllers/customer/getAllCustomers');
const createCustomer = require('../controllers/customer/createCustomer');
const getCustomer = require('../controllers/customer/getCustomer');
const updateCustomer = require('../controllers/customer/updateCustomer');
const checkDuplicateContactPerson = require('../controllers/customer/checkDuplicateContactPerson');
const addOldProject = require('../controllers/customer/addOldProject');
const verifyPassword = require('../controllers/user/verifyPassword');
const getAllInventory = require('../controllers/inventory/getAllInventory');
const getInventory = require('../controllers/inventory/getInventory');
const createInventory = require('../controllers/inventory/createInventory');
const stockAdd = require('../controllers/inventory/stockAdd');
const updateInventory = require('../controllers/inventory/updateInventory');
const deleteInventory = require('../controllers/inventory/deleteInventory');
const checkSerialNumber = require('../controllers/inventory/checkSerialNumber');
const getStockHistory = require('../controllers/inventory/getStockHistory');
const getCurrentStockStatus = require('../controllers/inventory/getCurrentStockStatus');
const exportInventory = require('../controllers/inventory/exportInventory');
const importInventory = require('../controllers/inventory/importInventory');
const getBranchTechniciansController = require('../controllers/manager/getBranchTechniciansController');
const managerAddTechnicianController = require('../controllers/manager/managerAddTechnicianController');
const getFinancialSummary = require('../controllers/manager/getFinancialSummary');
const getAdminFinancialSummary = require('../controllers/admin/getAdminFinancialSummary');
const getBranchBalanceOverview = require('../controllers/admin/getBranchBalanceOverview');
const getBalanceOverview = require('../controllers/manager/getBalanceOverview');
const getAvailableMonths = require('../controllers/admin/getAvailableMonths');
const getUserController = require('../controllers/user/getUserController');
const updateUserController = require('../controllers/user/updateUserController');
const deleteUserController = require('../controllers/user/deleteUserController');
const getInventoryByType = require('../controllers/inventory/getInventoryByType');
const getNewBranchManagersController = require('../controllers/manager/getNewBranchManagersController');
const checkManagerStatusController = require('../controllers/manager/checkManagerStatusController');
const initiateTransferController = require('../controllers/manager/initiateTransferController');
const acceptTransferController = require('../controllers/manager/acceptTransferController');
const rejectTransferController = require('../controllers/manager/rejectTransferController');
const rejectTechnicianProjectTransfer = require('../controllers/manager/rejectTechnicianProjectTransfer');
const closeProject = require('../controllers/manager/closeProject');
const getRejectedTransfersController = require('../controllers/manager/getRejectedTransfersController');
const getAllWorkOrders = require('../controllers/customer/getAllWorkOrders');
const createWorkOrder = require('../controllers/customer/createWorkOrder');
const addComplaint = require('../controllers/customer/addComplaint');
const assignTechnician = require('../controllers/customer/assignTechnician');
const assignInventoryToTechnician = require('../controllers/inventory/assignInventoryToTechnician');
const getTechnicianInventory = require('../controllers/technician/getTechnicianInventory');
const getTechnicianWorkOrders = require('../controllers/technician/getTechnicianWorkOrders');
const updateWorkOrderStatus = require('../controllers/technician/updateWorkOrderStatus');
const getTechnicianActiveProject = require('../controllers/technician/getTechnicianActiveProject');
const createWorkOrderBill = require('../controllers/technician/createWorkOrderBill');
const confirmWorkOrderBill = require('../controllers/technician/confirmWorkOrderBill');
const completeWorkOrder = require('../controllers/technician/completeWorkOrder');
const getWorkOrderDetails = require('../controllers/technician/getWorkOrderDetails');
const getTransferHistory = require('../controllers/manager/getTransferHistory');
const returnInventoryToManager = require('../controllers/technician/returnInventoryToManager');
const getManagerProjects = require('../controllers/manager/getManagerProjects');
const approveWorkOrder = require('../controllers/manager/approveWorkOrder');
const cancelWorkOrder = require('../controllers/manager/cancelWorkOrder');
const addManagerInstruction = require('../controllers/manager/addManagerInstruction');
const getBillDetails = require('../controllers/manager/getBillDetails');
const rejectBill = require('../controllers/manager/rejectBill');
const getTechnicianProjects = require('../controllers/technician/getTechnicianProjects');
const addWorkOrderRemark = require('../controllers/technician/addWorkOrderRemark');
const getReturnedInventory = require('../controllers/manager/getReturnedInventory');
const confirmReturnedInventory = require('../controllers/manager/confirmReturnedInventory');
const rejectReturnedInventory = require('../controllers/manager/rejectReturnedInventory');
const getTechnicianReturnRequests = require('../controllers/technician/getTechnicianReturnRequests');
const acceptTechnicianProjectTransfer = require('../controllers/manager/acceptTechnicianProjectTransfer');
const getSerialNumberDetails = require('../controllers/manager/getSerialNumberDetails');
const updateSerialNumberStatus = require('../controllers/technician/updateUsedSerialNumbers');
const registerWarrantyReplacement = require('../controllers/manager/registerWarrantyReplacement');
const getAllWarrantyReplacements = require('../controllers/manager/getAllWarrantyReplacements');
const completeWarrantyReplacement = require('../controllers/manager/completeWarrantyReplacement');
const getTechnicianInventoryHistory = require('../controllers/technician/getTechnicianInventoryHistory');
const getManagerByIdController = require('../controllers/admin/getManagerByIdController');
const changePasswordController = require('../controllers/user/changePasswordController');
const adminChangePasswordController = require('../controllers/admin/adminChangePasswordController');
const getReplacementHistory = require('../controllers/manager/getReplacementHistory');
const checkWarrantyStatus = require('../controllers/manager/checkWarrantyStatus');
const findByReplacementSerial = require('../controllers/manager/findByReplacementSerial');
const updateWarrantyClaim = require('../controllers/manager/updateWarrantyClaim');
const { resetSystem } = require('../controllers/user/resetSystem');

// Profile picture upload controllers and middleware
const { uploadProfilePictureController, deleteProfilePictureController } = require('../controllers/user/uploadProfilePictureController');
const { upload, handleUploadError } = require('../middleware/upload');

// Excel upload middleware for inventory import
const { upload: excelUpload, handleUploadError: handleExcelUploadError } = require('../middleware/excelUpload');

// Dealer controllers
const createDealer = require('../controllers/dealer/createDealer');
const getAllDealers = require('../controllers/dealer/getAllDealers');
const getDealer = require('../controllers/dealer/getDealer');
const updateDealer = require('../controllers/dealer/updateDealer');
const addDealerRemark = require('../controllers/dealer/addDealerRemark');

// Distributor controllers
const createDistributor = require('../controllers/distributor/createDistributor');
const getAllDistributors = require('../controllers/distributor/getAllDistributors');
const getDistributor = require('../controllers/distributor/getDistributor');
const updateDistributor = require('../controllers/distributor/updateDistributor');
const addDistributorRemark = require('../controllers/distributor/addDistributorRemark');

// Sales controllers
const createSalesBill = require('../controllers/sales/createSalesBill');
const getSalesBills = require('../controllers/sales/getSalesBills');
const getSalesBillDetails = require('../controllers/sales/getSalesBillDetails');
const processPayment = require('../controllers/sales/processPayment');
const generateQRCode = require('../controllers/sales/generateQRCode');
const getDealerBills = require('../controllers/sales/getDealerBills');
const getDistributorBills = require('../controllers/sales/getDistributorBills');
const processBulkPayment = require('../controllers/sales/processBulkPayment');
const getCustomerBills = require('../controllers/sales/getCustomerBills');
const createCustomerBill = require('../controllers/sales/createCustomerBill');
const processCustomerBulkPayment = require('../controllers/sales/processCustomerBulkPayment');

// Transaction History controllers
const getTransactionHistory = require('../controllers/transactionHistory/getTransactionHistory');

// Backup controllers
const exportFullBackup = require('../controllers/backup/exportFullBackup');
const importFullBackup = require('../controllers/backup/importFullBackup');


// Login 
router.post("/login", loginController);

// User
router.get("/get-user/:id", authToken, getUserController);
router.post("/update-user/:id", authToken, updateUserController);
router.delete("/delete-user/:id", authToken, deleteUserController);
router.post("/change-password/:id", authToken, changePasswordController);
router.post("/reset-system", authToken, resetSystem);

// Profile Picture
router.post("/upload-profile-picture", authToken, upload.single('profileImage'), handleUploadError, uploadProfilePictureController);
router.delete("/delete-profile-picture", authToken, deleteProfilePictureController);

// Notifications
router.post("/notifications/token", authToken, registerNotificationToken);
router.delete("/notifications/token", authToken, removeNotificationToken);

// Admin
router.get("/get-admins", authToken, getAdminUsersController);
router.post("/add-admins", authToken, addAdminUserController);
router.get("/get-managers", authToken, getManagersController);
router.post("/add-managers", authToken, addManagerController);
router.get("/get-technicians", authToken, getTechniciansController);
router.post("/add-technicians", authToken, addTechnicianController);
router.get("/get-branches", authToken, getBranchesController);
router.post("/add-branches", authToken, addBranchController);
router.post("/user-status", authToken, updateUserStatusController);
router.get("/get-manager-detail/:managerId", authToken, getManagerByIdController);
router.post("/admin-change-password/:id", authToken, adminChangePasswordController);

// Bank Accounts (Admin only)
router.get("/get-bank-accounts", authToken, getBankAccountsController);
router.post("/add-bank-account", authToken, addBankAccountController);
router.put("/update-bank-account/:accountId", authToken, updateBankAccountController);
router.delete("/delete-bank-account/:accountId", authToken, deleteBankAccountController);

// Manager
router.get("/manager-get-technician", authToken, getBranchTechniciansController);
router.post("/manager-add-technician", authToken, managerAddTechnicianController);
router.get("/manager/financial-summary", authToken, getFinancialSummary);
router.get("/admin/financial-summary", authToken, getAdminFinancialSummary);
router.get("/admin/branch-balance-overview", authToken, getBranchBalanceOverview);
router.get("/manager/balance-overview", authToken, getBalanceOverview);
router.get("/get-available-months", authToken, getAvailableMonths);
router.get("/new-managers", authToken, getNewBranchManagersController);
router.get("/manager-status", authToken, checkManagerStatusController);
router.post("/initiate-transfer", authToken, initiateTransferController);
router.post("/accept-transfer/:transferId", authToken, acceptTransferController);
router.post("/reject-transfer/:transferId", authToken, rejectTransferController);
router.get("/get-rejected-transfers", authToken, getRejectedTransfersController);
router.get("/get-transfer-history", authToken, getTransferHistory);
router.get("/get-manager-projects", authToken, getManagerProjects);
router.post("/approve-order", authToken, approveWorkOrder);
router.post("/cancel-work-order", authToken, cancelWorkOrder);
router.post("/add-manager-instruction", authToken, addManagerInstruction);
router.get("/get-bill-details/:id", authToken, getBillDetails);
router.post("/accept-technician-project-transfer", authToken, acceptTechnicianProjectTransfer);
router.post("/reject-technician-project-transfer", authToken, rejectTechnicianProjectTransfer);
router.post("/close-project", authToken, closeProject);
router.get("/get-returned-inventory", authToken, getReturnedInventory);
router.post("/confirm-returned-inventory/:returnId", authToken, confirmReturnedInventory);
router.post("/reject-returned-inventory/:returnId", authToken, rejectReturnedInventory);
router.get("/get-technician-return-requests", authToken, getTechnicianReturnRequests);
router.get("/serial-number-detail/:serialNumber", authToken, getSerialNumberDetails);
router.post("/register-replacement", authToken, registerWarrantyReplacement);
router.get("/get-replacements", authToken, getAllWarrantyReplacements);
router.post("/complete-replacement", authToken, completeWarrantyReplacement);
router.get("/serial-number-history/:serialNumber", authToken, getReplacementHistory);
router.get("/check-warranty-status/:serialNumber", authToken, checkWarrantyStatus);
router.get("/replaced-serial-number/:serialNumber", authToken, findByReplacementSerial);
router.post("/warranty-claim", authToken, updateWarrantyClaim);

// Technician
router.get("/technician-work-orders", authToken, getTechnicianWorkOrders);
router.post("/update-work-status", authToken, updateWorkOrderStatus);
router.get("/technician-active-projects", authToken, getTechnicianActiveProject);
router.post("/create-bill", authToken, createWorkOrderBill);
router.post("/confirm-order-bill", authToken, confirmWorkOrderBill);
router.post("/complete-work-order", authToken, completeWorkOrder);
router.get("/get-work-order-details/:customerId/:orderId", authToken, getWorkOrderDetails);
router.post("/return-inventory", authToken, returnInventoryToManager);
router.get("/get-technician-projects/:technicianId", authToken, getTechnicianProjects);
router.post("/remark-add", authToken, addWorkOrderRemark);
router.post("/update-serial-status", authToken, updateSerialNumberStatus);
router.get("/get-inventory-history/:technicianId", authToken, getTechnicianInventoryHistory);

// Lead
router.get("/search", authToken, search);
router.get("/get-all-leads", authToken, getAllLeads);
router.post("/create-Lead", authToken, createLead);
router.get("/get-single-lead/:id", authToken, getLead);
router.post("/update-lead/:id", authToken, updateLead);
router.post("/lead-remarks/:id", authToken, addRemark);
router.post("/lead-convert/:id", authToken, convertToCustomer);
router.post("/lead-convert-dealer/:id", authToken, convertToDealer);
router.post("/lead-convert-distributor/:id", authToken, convertToDistributor);
router.post("/lead-convert-existing-customer/:id", authToken, convertToExistingCustomer);

// Customer
router.get("/get-all-customers", authToken, getAllCustomers);
router.post("/create-customer", authToken, createCustomer);
router.get("/get-single-customer/:id", authToken, getCustomer);
router.post("/update-customer/:id", authToken, updateCustomer);
router.get("/check-duplicate-contact-person", authToken, checkDuplicateContactPerson);
router.post("/verify-password", authToken, verifyPassword);
router.post("/add-old-project", authToken, addOldProject);
router.get("/get-work-orders", authToken, getAllWorkOrders);
router.post("/create-work-orders", authToken, createWorkOrder);
router.post("/add-complaint/:customerId", authToken, addComplaint);
router.post("/assign-technician", authToken, assignTechnician);

// Inventory
router.get("/get-all-inventory", authToken, getAllInventory);
router.get("/get-single-inventory/:id", authToken, getInventory);
router.post("/create-inventory", authToken, createInventory);
router.post("/add-stock", authToken, stockAdd);
router.post("/update-inventory/:id", authToken, updateInventory);
router.post("/delete-inventory/:id", authToken, deleteInventory);
router.get("/check-serial/:serialNumber", authToken, checkSerialNumber);
router.get("/inventory-by-type/:type", authToken, getInventoryByType);
router.get("/stock-history/:itemId", authToken, getStockHistory);
router.get("/inventory-current-stock/:itemId", authToken, getCurrentStockStatus);
router.post("/assign-inventory-technician", authToken, assignInventoryToTechnician);
router.get("/get-technician-inventory", authToken, getTechnicianInventory);

// Inventory Export/Import routes
router.get("/export-inventory", authToken, exportInventory);
router.post("/import-inventory", authToken, excelUpload.single('inventory'), handleExcelUploadError, importInventory);

// Software Backup/Restore routes (Admin only)
router.get("/export-full-backup", authToken, exportFullBackup);
router.post("/import-full-backup", authToken, excelUpload.single('backup'), handleExcelUploadError, importFullBackup);

// Dealer routes
router.post("/create-dealer", authToken, createDealer);
router.get("/get-all-dealers", authToken, getAllDealers);
router.get("/get-dealer/:id", authToken, getDealer);
router.post("/update-dealer/:id", authToken, updateDealer);
router.post("/dealer-remarks/:id", authToken, addDealerRemark);

// Distributor routes  
router.post("/create-distributor", authToken, createDistributor);
router.get("/get-all-distributors", authToken, getAllDistributors);
router.get("/get-distributor/:id", authToken, getDistributor);
router.post("/update-distributor/:id", authToken, updateDistributor);
router.post("/distributor-remarks/:id", authToken, addDistributorRemark);

// Sales routes
router.post("/create-sales-bill", authToken, createSalesBill);
router.get("/get-sales-bills", authToken, getSalesBills);
router.get("/get-bill-details/:billId", authToken, getSalesBillDetails);
router.post("/process-payment/:billId", authToken, processPayment);
router.get("/generate-qr/:billId", authToken, generateQRCode);
router.get("/get-dealer-bills/:dealerId", authToken, getDealerBills);
router.get("/get-distributor-bills/:distributorId", authToken, getDistributorBills);
router.post("/process-bulk-payment", authToken, processBulkPayment);
router.get("/get-customer-bills/:customerId", authToken, getCustomerBills);
router.post("/create-customer-bill", authToken, createCustomerBill);
router.post("/process-customer-bulk-payment", authToken, processCustomerBulkPayment);

// Transaction History routes
router.get("/transaction-history/:customerId", authToken, getTransactionHistory);

router.post("/reject-technician-project-transfer", authToken, rejectTechnicianProjectTransfer);
router.post("/reject-bill", authToken, rejectBill);

module.exports = router;
