const SalesBill = require('../../models/salesBillModel');

async function generateQRCode(req, res) {
  try {
    const { billId } = req.params;
    const { amount } = req.query; // Optional: specific amount for partial payments

    // Find the bill
    const bill = await SalesBill.findById(billId)
      .populate('customerId', 'name firmName')
      .populate('branch', 'name');

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found"
      });
    }

    // Check if user has access to this bill
    if (req.user.role !== 'admin' && req.user.branch) {
      if (bill.branch && bill.branch._id.toString() !== req.user.branch.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this bill"
        });
      }
    }

    // Determine amount for QR code
    const qrAmount = amount ? parseFloat(amount) : bill.dueAmount;

    if (qrAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "No pending amount for payment"
      });
    }

    // Generate UPI payment URL
    // In a real implementation, you would use your business UPI details
    const upiId = process.env.UPI_ID || "business@paytm"; // Set this in your .env file
    const businessName = process.env.BUSINESS_NAME || "Your Business";
    
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(businessName)}&am=${qrAmount}&cu=INR&tn=${encodeURIComponent(`Bill Payment - ${bill.billNumber}`)}&tr=${bill.billNumber}`;

    // Update bill with QR code data if it's for the full due amount
    if (qrAmount === bill.dueAmount) {
      await SalesBill.findByIdAndUpdate(billId, {
        qrCodeData: upiUrl,
        updatedBy: req.userId,
        updatedAt: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: "QR code generated successfully",
      data: {
        billNumber: bill.billNumber,
        customerName: bill.customerName,
        amount: qrAmount,
        upiUrl: upiUrl,
        qrCodeData: upiUrl,
        // You can also return a base64 encoded QR code image here
        // using a library like qrcode
      }
    });

  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({
      success: false,
      message: "Server error while generating QR code"
    });
  }
}

module.exports = generateQRCode;