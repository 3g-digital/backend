const SalesBill = require('../../models/salesBillModel');
const Dealer = require('../../models/dealerModel');
const Distributor = require('../../models/distributorModel');
const Item = require('../../models/inventoryModel');
const createTransactionRecord = require('../transactionHistory/createTransactionRecord');

// Function to update inventory stock after sale
async function updateInventoryStock(soldItems, userBranch) {
  for (const soldItem of soldItems) {
    const { itemId, serialNumber, quantity } = soldItem;
    
    const inventoryItem = await Item.findById(itemId);
    if (!inventoryItem) continue;
    
    if (inventoryItem.type === 'serialized-product') {
      // For serialized products, remove specific serial number from stock
      inventoryItem.stock = inventoryItem.stock.filter(stockItem => 
        !(stockItem.serialNumber === serialNumber && 
          stockItem.branch.toString() === userBranch.toString())
      );
    } else if (inventoryItem.type === 'generic-product') {
      // For generic products, reduce quantity from the branch stock
      let remainingQty = quantity;
      
      for (let i = 0; i < inventoryItem.stock.length && remainingQty > 0; i++) {
        const stockItem = inventoryItem.stock[i];
        
        if (stockItem.branch.toString() === userBranch.toString()) {
          const availableQty = stockItem.quantity;
          const toDeduct = Math.min(remainingQty, availableQty);
          
          stockItem.quantity -= toDeduct;
          remainingQty -= toDeduct;
          
          // Remove stock entry if quantity becomes 0
          if (stockItem.quantity <= 0) {
            inventoryItem.stock.splice(i, 1);
            i--; // Adjust index after removal
          }
        }
      }
    }
    
    // Save the updated inventory item
    await inventoryItem.save();
  }
}

async function createSalesBill(req, res) {
  try {
    const {
      customerType,
      customerId,
      items,
      paymentMethod,
      paidAmount,
      receivedAmount,
      transactionId,
      paymentDetails,
      notes
    } = req.body;

    // Validate required fields
    if (!customerType || !customerId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Customer type, customer ID, and items are required"
      });
    }

    if (!['dealer', 'distributor'].includes(customerType)) {
      return res.status(400).json({
        success: false,
        message: "Customer type must be either 'dealer' or 'distributor'"
      });
    }

    if (!['cash', 'upi', 'bank_transfer', 'cheque'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Payment method must be cash, upi, bank_transfer, or cheque"
      });
    }

    // Verify customer exists
    let customer;
    let customerModel;
    
    if (customerType === 'dealer') {
      customer = await Dealer.findById(customerId);
      customerModel = 'Dealer';
    } else {
      customer = await Distributor.findById(customerId);
      customerModel = 'Distributor';
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: `${customerType.charAt(0).toUpperCase() + customerType.slice(1)} not found`
      });
    }

    // Determine which branch to use (admin uses dealer/distributor's branch, manager uses their own)
    const branchToUse = req.user && req.user.role === 'admin'
      ? customer.branch
      : req.user.branch;

    // Process and validate items
    const processedItems = [];
    let subtotal = 0;

    for (const itemData of items) {
      const { itemId, quantity, serialNumber } = itemData;

      if (!itemId || !quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Item ID and valid quantity are required for all items"
        });
      }

      // Get item details
      const item = await Item.findById(itemId);
      if (!item) {
        return res.status(404).json({
          success: false,
          message: `Item not found: ${itemId}`
        });
      }

      // Get appropriate price based on customer type
      if (!item.pricing) {
        return res.status(400).json({
          success: false,
          message: `Multi-tier pricing not configured for item: ${item.name}`
        });
      }

      let unitPrice;
      if (customerType === 'dealer') {
        unitPrice = item.pricing.dealerPrice;
      } else {
        unitPrice = item.pricing.distributorPrice;
      }

      if (!unitPrice || unitPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${customerType} price for item: ${item.name}`
        });
      }

      // For serialized products, validate serial number availability
      if (item.type === 'serialized-product') {
        if (!serialNumber) {
          return res.status(400).json({
            success: false,
            message: `Serial number required for item: ${item.name}`
          });
        }

        // Check if serial number exists in current branch stock
        const stockItem = item.stock.find(s =>
          s.serialNumber === serialNumber &&
          s.branch.toString() === branchToUse.toString()
        );
        if (!stockItem) {
          return res.status(400).json({
            success: false,
            message: `Serial number ${serialNumber} not available in this branch for item: ${item.name}`
          });
        }
      } else if (item.type === 'generic-product') {
        // For generic products, check if enough quantity is available in the branch
        const branchStock = item.stock.filter(s =>
          s.branch.toString() === branchToUse.toString()
        );
        const availableQty = branchStock.reduce((total, stock) => total + stock.quantity, 0);
        
        if (availableQty < quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for item: ${item.name}. Available: ${availableQty}, Requested: ${quantity}`
          });
        }
      }

      const totalPrice = unitPrice * quantity;
      subtotal += totalPrice;

      processedItems.push({
        itemId,
        itemName: item.name,
        serialNumber: serialNumber || null,
        quantity,
        unitPrice,
        totalPrice
      });
    }

    // Calculate final amounts
    const total = subtotal;
    const paidAmountValue = paidAmount || 0;
    const receivedAmountValue = receivedAmount || paidAmountValue; // For bank transfer, use receivedAmount
    const dueAmount = Math.max(0, total - paidAmountValue);

    // Determine payment status
    let paymentStatus = 'pending';
    if (paidAmountValue >= total) {
      paymentStatus = 'completed';
    } else if (paidAmountValue > 0) {
      paymentStatus = 'partial';
    }

    // Generate bill number manually
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const billCount = await SalesBill.countDocuments({
      billNumber: { $regex: `^SB${year}${month}` }
    });
    
    const sequence = String(billCount + 1).padStart(4, '0');
    const billNumber = `SB${year}${month}${sequence}`;

    // Validate method-specific fields
    let validatedPaymentDetails = {};

    switch(paymentMethod) {
      case 'cash':
        // No additional validation needed for cash
        break;

      case 'upi':
        if (paymentDetails?.upiTransactionId) {
          validatedPaymentDetails.upiTransactionId = paymentDetails.upiTransactionId;
        }
        if (paymentDetails?.selectedBankAccount) {
          validatedPaymentDetails.selectedBankAccount = paymentDetails.selectedBankAccount;
        }
        break;

      case 'bank_transfer':
        if (!paymentDetails?.utrNumber) {
          return res.status(400).json({
            success: false,
            message: "UTR number is required for bank transfer"
          });
        }
        validatedPaymentDetails.utrNumber = paymentDetails.utrNumber;
        validatedPaymentDetails.bankName = paymentDetails.bankName || '';
        validatedPaymentDetails.transferDate = paymentDetails.transferDate || new Date();
        break;

      case 'cheque':
        if (!paymentDetails?.chequeNumber || !paymentDetails?.chequeAmount) {
          return res.status(400).json({
            success: false,
            message: "Cheque number and amount are required"
          });
        }
        validatedPaymentDetails.chequeNumber = paymentDetails.chequeNumber;
        validatedPaymentDetails.chequeBank = paymentDetails.chequeBank || '';
        validatedPaymentDetails.chequeIfsc = paymentDetails.chequeIfsc || '';
        validatedPaymentDetails.chequeDate = paymentDetails.chequeDate || new Date();
        validatedPaymentDetails.chequeAmount = paymentDetails.chequeAmount;
        validatedPaymentDetails.drawerName = paymentDetails.drawerName || customer.name;
        validatedPaymentDetails.chequeStatus = paymentDetails.chequeStatus || 'received';
        break;
    }

    // Create sales bill data
    const billData = {
      billNumber,
      customerType,
      customerId,
      customerModel,
      customerName: customer.name,
      customerFirmName: customer.firmName || '',
      customerPhone: customer.phoneNumber,
      items: processedItems,
      subtotal,
      total,
      paymentMethod,
      paymentStatus,
      paidAmount: paidAmountValue,
      receivedAmount: receivedAmountValue,
      dueAmount,
      transactionId: transactionId || null,
      paymentDetails: validatedPaymentDetails,
      notes: notes || '',
      branch: branchToUse,
      createdBy: req.userId,
      createdByRole: req.user ? req.user.role : null,
      createdByName: req.user ? `${req.user.firstName} ${req.user.lastName}` : null
    };

    // Generate QR code data for UPI payments
    if (paymentMethod === 'upi' && dueAmount > 0) {
      // QR code data will be generated in frontend based on selected bank account
      billData.qrCodeData = `upi://pay?am=${dueAmount}&cu=INR&tn=Bill Payment-${billNumber}`;
    }

    const salesBill = new SalesBill(billData);
    const savedBill = await salesBill.save();

    // Update inventory stock after successful bill creation
    await updateInventoryStock(processedItems, branchToUse);

    // Create transaction record if payment was made during bill creation
    if (paidAmountValue > 0) {
      try {
        await createTransactionRecord({
          customerId,
          customerType,
          customerName: customer.name,
          amount: paidAmountValue,
          paymentMethod,
          transactionId: transactionId || null,
          paymentDetails: validatedPaymentDetails,
          relatedBills: [{
            billId: savedBill._id,
            billNumber: savedBill.billNumber,
            allocatedAmount: paidAmountValue
          }],
          notes: notes || `Payment made during bill creation`,
          branch: branchToUse,
          createdBy: req.userId,
          transactionType: 'payment_received' // This is bill creation payment
        });

        console.log(`Transaction history created for bill creation: ${savedBill.billNumber} - ₹${paidAmountValue}`);
      } catch (transactionError) {
        console.error('Error creating transaction history for bill creation:', transactionError);
        // Continue with response even if transaction history fails
      }
    }

    res.status(201).json({
      success: true,
      message: "Sales bill created successfully",
      data: savedBill
    });

  } catch (error) {
    console.error('Error creating sales bill:', error);
    res.status(500).json({
      success: false,
      message: "Server error while creating sales bill"
    });
  }
}

module.exports = createSalesBill;