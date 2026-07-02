const Item = require('../../models/inventoryModel');
const XLSX = require('xlsx');

const exportInventory = async (req, res) => {
  try {
    // Get all inventory items without stock data
    const items = await Item.find({})
      .select('-stock -__v -updatedAt') // Exclude stock array and unnecessary fields
      .populate('branch', 'name')
      .sort('createdAt');

    if (!items || items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No inventory items found to export'
      });
    }

    // Transform data for Excel format
    const excelData = items.map((item, index) => {
      return {
        'S.No': index + 1,
        'ID': item.id || '',
        'Name': item.name || '',
        'Type': item.type || '',
        'Unit': item.unit || 'N/A',
        'Warranty': item.warranty || 'N/A',
        'MRP': item.mrp || 0,
        'Purchase Price': item.purchasePrice || 0,
        'Customer Price': item.pricing?.customerPrice || 0,
        'Dealer Price': item.pricing?.dealerPrice || 0,
        'Distributor Price': item.pricing?.distributorPrice || 0,
        'Branch': item.branch?.name || 'N/A',
        'Created Date': item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : ''
      };
    });

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths for better readability
    const columnWidths = [
      { wch: 6 },  // S.No
      { wch: 15 }, // ID
      { wch: 25 }, // Name
      { wch: 18 }, // Type
      { wch: 10 }, // Unit
      { wch: 12 }, // Warranty
      { wch: 12 }, // MRP
      { wch: 15 }, // Purchase Price
      { wch: 15 }, // Customer Price
      { wch: 12 }, // Dealer Price
      { wch: 18 }, // Distributor Price
      { wch: 15 }, // Branch
      { wch: 15 }  // Created Date
    ];
    worksheet['!cols'] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory Items');

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'buffer'
    });

    // Generate filename with current date
    const currentDate = new Date().toISOString().split('T')[0];
    const filename = `inventory_backup_${currentDate}.xlsx`;

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);

    // Send file
    res.send(excelBuffer);

    console.log(`Inventory exported successfully: ${items.length} items exported by user ${req.userId}`);

  } catch (err) {
    console.error('Error exporting inventory:', err);
    res.status(500).json({
      success: false,
      message: 'Server error. Failed to export inventory.'
    });
  }
};

module.exports = exportInventory;