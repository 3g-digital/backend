const Item = require('../../models/inventoryModel');
const createInventory = async (req, res) => {
  try {
    // Admin can create all items, Manager and Technician can only create services
    if (req.userRole !== 'admin' && req.userRole !== 'manager' && req.userRole !== 'technician') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Only admin, manager, and technician can add items.'
      });
    }

    // If manager or technician, only allow service creation
    if ((req.userRole === 'manager' || req.userRole === 'technician') && req.body.type !== 'service') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Managers and technicians can only add services.'
      });
    }
    
    const {
      id,
      type,
      name,
      unit,
      warranty,
      mrp,
      purchasePrice,
      customerPrice,
      dealerPrice,
      distributorPrice
    } = req.body;

    console.log('Received data:', {
      customerPrice,
      dealerPrice,
      distributorPrice,
      customerPriceType: typeof customerPrice,
      dealerPriceType: typeof dealerPrice,
      distributorPriceType: typeof distributorPrice
    });
   
    // Check if item with same ID already exists
    const existingItemWithId = await Item.findOne({ id });
    if (existingItemWithId) {
      return res.status(400).json({
        success: false,
        message: 'Item with this ID already exists'
      });
    }
   
    // Check if item with same name already exists
    const existingItemWithName = await Item.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });
   
    if (existingItemWithName) {
      return res.status(400).json({
        success: false,
        message: 'Product with this name already exists'
      });
    }
   
    // Create the new item object based on type
    // Admin creates items without branch assignment
    let newItemData = {
      id,
      type,
      name
    };

    // Add multi-tier pricing
    // Allow 0 as a valid price (for AMC customers with free services)
    // For services, dealer and distributor prices can be null
    const isValidPrice = (price) => {
      return price !== undefined && price !== null && price !== '';
    };

    // Customer price is always required
    if (!isValidPrice(customerPrice)) {
      return res.status(400).json({
        success: false,
        message: 'Customer price is required'
      });
    }

    // For non-service items, all prices are required
    if (type !== 'service') {
      if (!isValidPrice(dealerPrice) || !isValidPrice(distributorPrice)) {
        return res.status(400).json({
          success: false,
          message: 'Dealer price and distributor price are required for products'
        });
      }
    }

    // Convert prices to numbers (handles "0" string and other string numbers)
    // For services, use 0 if dealer/distributor prices are null
    newItemData.pricing = {
      customerPrice: Number(customerPrice),
      dealerPrice: type === 'service' && (dealerPrice === null || dealerPrice === undefined) ? 0 : Number(dealerPrice),
      distributorPrice: type === 'service' && (distributorPrice === null || distributorPrice === undefined) ? 0 : Number(distributorPrice)
    };

    console.log('Converted pricing:', newItemData.pricing);

    // Add salePrice for backward compatibility (use customerPrice as default)
    newItemData.salePrice = Number(customerPrice);

    // Add additional fields for product types only
    if (type === 'serialized-product' || type === 'generic-product') {
      newItemData.unit = unit;
      newItemData.warranty = warranty;
      newItemData.mrp = mrp;
      newItemData.purchasePrice = purchasePrice;
    }
   
    const newItem = new Item(newItemData);
    await newItem.save();
   
    res.json({
      success: true,
      item: newItem
    });
  } catch (err) {
    console.error('Error adding inventory item:', err);
    console.error('Error details:', err.message);
    console.error('Error stack:', err.stack);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
module.exports = createInventory;