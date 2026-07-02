const SalesBill = require('../../models/salesBillModel');
const Customer = require('../../models/customerModel');
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

async function createCustomerBill(req, res) {
  try {
    const { customerId, items, paymentMethod, paidAmount, receivedAmount, transactionId, paymentDetails, notes } = req.body;

    // Validation
    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Customer ID and items are required"
      });
    }

    if (!paymentMethod || !['cash', 'upi', 'bank_transfer', 'cheque'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Payment method must be cash, upi, bank_transfer, or cheque"
      });
    }

    // Fetch customer details
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "Customer not found"
      });
    }

    // Check if user has permission (admin can access all, manager only their branch)
    if (req.user && req.user.role !== 'admin' && req.userBranch) {
      if (customer.branch.toString() !== req.userBranch.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to create bill for this customer'
        });
      }
    }

    // Determine which branch to use (admin uses customer's branch, manager uses their own)
    const branchToUse = req.user && req.user.role === 'admin'
      ? customer.branch
      : req.userBranch;

    // Process items and calculate pricing
    const billItems = [];
    let subtotal = 0;

    for (const itemData of items) {
      const { itemId, quantity, serialNumber } = itemData;
      
      if (!itemId || !quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Valid item ID and quantity are required for all items"
        });
      }

      // Fetch item details
      const item = await Item.findById(itemId).populate('branch');
      if (!item) {
        return res.status(400).json({
          success: false,
          message: `Item with ID ${itemId} not found`
        });
      }

      // Check if item belongs to the branch
      if (branchToUse && item.branch &&
          !item.stock.some(stockItem =>
            stockItem.branch && stockItem.branch.toString() === branchToUse.toString()
          )) {
        return res.status(400).json({
          success: false,
          message: `Item ${item.name} is not available in this branch`
        });
      }

      // Use customer pricing
      const unitPrice = item.pricing?.customerPrice || item.salePrice || 0;
      const totalPrice = unitPrice * quantity;

      // Validate stock availability for non-service items
      if (item.type !== 'service') {
        if (item.type === 'serialized-product') {
          // For serialized products, validate serial number availability
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
      }

      billItems.push({
        itemId: item._id,
        itemName: item.name,
        serialNumber: serialNumber || null,
        quantity,
        unitPrice,
        totalPrice
      });

      subtotal += totalPrice;
    }

    // Generate bill number
    const year = new Date().getFullYear().toString().slice(-2);
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    const lastBill = await SalesBill.findOne({
      billNumber: new RegExp(`^CB${year}${month}`)
    }).sort({ billNumber: -1 });

    let sequence = 1;
    if (lastBill) {
      const lastSequence = parseInt(lastBill.billNumber.slice(-4));
      sequence = lastSequence + 1;
    }
    
    const billNumber = `CB${year}${month}${sequence.toString().padStart(4, '0')}`;

    // Create bill
    const bill = new SalesBill({
      billNumber,
      customerType: 'customer',
      customerId,
      customerModel: 'Customer',
      customerName: customer.name,
      customerPhone: customer.phoneNumber,
      items: billItems,
      subtotal,
      total: subtotal,
      paymentMethod,
      paymentStatus: paidAmount >= subtotal ? 'completed' : (paidAmount > 0 ? 'partial' : 'pending'),
      paidAmount: paidAmount || 0,
      dueAmount: subtotal - (paidAmount || 0),
      receivedAmount: receivedAmount || paidAmount || 0,
      transactionId: transactionId || null,
      paymentDetails: paymentDetails || undefined,
      notes: notes || '',
      branch: branchToUse,
      createdBy: req.userId,
      createdByRole: req.user ? req.user.role : null,
      createdByName: req.user ? `${req.user.firstName} ${req.user.lastName}` : null
    });

    await bill.save();

    // Update inventory stock after successful bill creation
    await updateInventoryStock(billItems, branchToUse);

    // Create transaction record if payment was made during bill creation
    if (bill.paidAmount > 0) {
      try {
        await createTransactionRecord({
          customerId: bill.customerId,
          customerType: 'customer',
          customerName: customer.name,
          amount: bill.paidAmount,
          paymentMethod: bill.paymentMethod,
          transactionId: bill.transactionId || null,
          paymentDetails: bill.paymentDetails || {},
          relatedBills: [{
            billId: bill._id,
            billNumber: bill.billNumber,
            allocatedAmount: bill.paidAmount
          }],
          notes: bill.notes || `Payment made during bill creation`,
          branch: branchToUse,
          createdBy: req.userId,
          transactionType: 'payment_received' // This is bill creation payment
        });

        console.log(`Transaction history created for customer bill creation: ${bill.billNumber} - ₹${bill.paidAmount}`);
      } catch (transactionError) {
        console.error('Error creating transaction history for customer bill creation:', transactionError);
        // Continue with response even if transaction history fails
      }
    }

    res.json({
      success: true,
      message: "Customer bill created successfully",
      data: {
        bill,
        billNumber
      }
    });

  } catch (error) {
    console.error('Error creating customer bill:', error);
    res.status(500).json({
      success: false,
      message: "Server error while creating customer bill"
    });
  }
}

module.exports = createCustomerBill;