const Item = require('../../models/inventoryModel');
const XLSX = require('xlsx');

const importInventory = async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators can import inventory.'
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
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];

    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Please upload an Excel file (.xlsx or .xls).'
      });
    }

    try {
      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (!jsonData || jsonData.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'The Excel file is empty or contains no valid data.'
        });
      }

      console.log(`Processing ${jsonData.length} rows from Excel file`);

      // Validate and transform data
      const validatedItems = [];
      const errors = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNumber = i + 2; // Excel row number (accounting for header)

        try {
          // Skip empty rows
          if (!row.Name || !row.Type) {
            continue;
          }

          // Validate required fields
          if (!row.ID) {
            errors.push(`Row ${rowNumber}: ID is required`);
            continue;
          }

          if (!row.Name.trim()) {
            errors.push(`Row ${rowNumber}: Name is required`);
            continue;
          }

          if (!['serialized-product', 'generic-product', 'service'].includes(row.Type)) {
            errors.push(`Row ${rowNumber}: Invalid type. Must be 'serialized-product', 'generic-product', or 'service'`);
            continue;
          }

          // Validate pricing data
          if (!row['Customer Price'] || row['Customer Price'] <= 0) {
            errors.push(`Row ${rowNumber}: Customer Price is required and must be greater than 0`);
            continue;
          }

          if (!row['Dealer Price'] || row['Dealer Price'] <= 0) {
            errors.push(`Row ${rowNumber}: Dealer Price is required and must be greater than 0`);
            continue;
          }

          if (!row['Distributor Price'] || row['Distributor Price'] <= 0) {
            errors.push(`Row ${rowNumber}: Distributor Price is required and must be greater than 0`);
            continue;
          }

          // For products, validate additional fields
          if (row.Type === 'serialized-product' || row.Type === 'generic-product') {
            if (!row.Unit) {
              errors.push(`Row ${rowNumber}: Unit is required for products`);
              continue;
            }

            if (!row.MRP || row.MRP <= 0) {
              errors.push(`Row ${rowNumber}: MRP is required for products and must be greater than 0`);
              continue;
            }

            if (!row['Purchase Price'] || row['Purchase Price'] <= 0) {
              errors.push(`Row ${rowNumber}: Purchase Price is required for products and must be greater than 0`);
              continue;
            }
          }

          // Create item object
          const itemData = {
            id: row.ID.toString().trim(),
            name: row.Name.toString().trim(),
            type: row.Type.toString().trim(),
            pricing: {
              customerPrice: parseFloat(row['Customer Price']) || 0,
              dealerPrice: parseFloat(row['Dealer Price']) || 0,
              distributorPrice: parseFloat(row['Distributor Price']) || 0
            },
            stock: [] // Empty stock array - managers will add stock separately
          };

          // Add product-specific fields
          if (row.Type === 'serialized-product' || row.Type === 'generic-product') {
            itemData.unit = row.Unit ? row.Unit.toString().trim() : 'Piece';
            itemData.warranty = row.Warranty ? row.Warranty.toString().trim() : '1 year';
            itemData.mrp = parseFloat(row.MRP) || 0;
            itemData.purchasePrice = parseFloat(row['Purchase Price']) || 0;
          }

          validatedItems.push(itemData);

        } catch (rowError) {
          errors.push(`Row ${rowNumber}: ${rowError.message}`);
        }
      }

      // If there are validation errors, return them
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors found in the Excel file',
          errors: errors.slice(0, 10), // Limit to first 10 errors
          totalErrors: errors.length
        });
      }

      if (validatedItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid items found in the Excel file after validation.'
        });
      }

      console.log(`Validated ${validatedItems.length} items for import`);

      // Check for duplicate IDs in the import data
      const ids = validatedItems.map(item => item.id);
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Duplicate IDs found in import data',
          duplicateIds: [...new Set(duplicateIds)]
        });
      }

      // Check for existing items in database
      const existingItems = await Item.find({ id: { $in: ids } }).select('id');
      if (existingItems.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Some items already exist in the database',
          existingIds: existingItems.map(item => item.id),
          suggestion: 'Please use different IDs or delete existing items first'
        });
      }

      // Import items using insertMany for better performance
      const importResult = await Item.insertMany(validatedItems, {
        ordered: false, // Continue inserting even if some fail
        lean: true
      });

      console.log(`Successfully imported ${importResult.length} inventory items`);

      res.json({
        success: true,
        message: `Successfully imported ${importResult.length} inventory items`,
        importedCount: importResult.length,
        totalProcessed: jsonData.length,
        importedItems: importResult.map(item => ({
          id: item.id,
          name: item.name,
          type: item.type
        }))
      });

    } catch (parseError) {
      console.error('Error parsing Excel file:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Failed to parse Excel file. Please ensure it is a valid Excel format.',
        error: parseError.message
      });
    }

  } catch (err) {
    console.error('Error importing inventory:', err);
    res.status(500).json({
      success: false,
      message: 'Server error. Failed to import inventory.',
      error: err.message
    });
  }
};

module.exports = importInventory;