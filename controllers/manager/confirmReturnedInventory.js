const mongoose = require('mongoose');
const ReturnedInventory = require('../../models/returnedInventoryModel');
const Item = require('../../models/inventoryModel');
const TransferHistory = require('../../models/transferHistoryModel');
const TechnicianInventory = require('../../models/technicianInventoryModel');
const User = require('../../models/userModel');
const sendNotification = require('../../helpers/push/sendNotification');

const confirmReturnedInventory = async (req, res) => {
  try {
    // Only managers can confirm returned inventory
    if (req.userRole !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Only managers can confirm returned inventory.'
      });
    }
    
    const { returnId } = req.params;
    
    // Find the returned inventory entry
    const returnEntry = await ReturnedInventory.findOne({
      _id: returnId,
      branch: req.userBranch,
      status: 'pending'
    }).populate('items.item');
    
    if (!returnEntry) {
      return res.status(404).json({
        success: false,
        message: 'Returned inventory entry not found or already processed'
      });
    }
    
    // Start a transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Process each returned item
      for (const returnedItem of returnEntry.items) {
        // Check if the referenced item exists (handle case where item was deleted)
        if (!returnedItem.item) {
          throw new Error(`Referenced item not found for returned item. The item may have been deleted.`);
        }

        const item = await Item.findById(returnedItem.item._id).session(session);

        if (!item) {
          throw new Error(`Item not found: ${returnedItem.item._id}`);
        }
        
        // Add back to main inventory
        if (returnedItem.type === 'serialized-product') {
          // For serialized product
          item.stock.push({
            serialNumber: returnedItem.serialNumber,
            quantity: 1,
            date: new Date(),
            branch: req.userBranch
          });
        } else {
          // For generic product
          item.stock.push({
            quantity: returnedItem.quantity,
            date: new Date(),
            branch: req.userBranch
          });
        }
        
        await item.save({ session });

        // Remove the serialized entry from the technician's inventory now that it is back in branch stock
        if (returnedItem.type === 'serialized-product') {
          const techInventory = await TechnicianInventory.findOne({
            technician: returnEntry.technician,
            item: item._id
          }).session(session);

          if (techInventory) {
            techInventory.serializedItems = techInventory.serializedItems.filter(
              serialItem => serialItem.serialNumber !== returnedItem.serialNumber
            );
            techInventory.lastUpdated = new Date();
            techInventory.lastUpdatedBy = req.userId;
            await techInventory.save({ session });
          }
        }
        
        // Create transfer history record
        await new TransferHistory({
          fromType: 'technician',
          fromId: returnEntry.technician,
          toType: 'branch',
          toId: req.userBranch,
          item: item._id,
          serialNumber: returnedItem.serialNumber || undefined,
          quantity: returnedItem.quantity,
          transferredBy: req.userId,
          transferredAt: new Date()
        }).save({ session });
      }
      
      // Update the returned inventory entry
      returnEntry.status = 'confirmed';
      returnEntry.confirmedAt = new Date();
      returnEntry.confirmedBy = req.userId;
      await returnEntry.save({ session });
      
      // Commit the transaction
      await session.commitTransaction();

      try {
        const technician = await User.findById(returnEntry.technician).select('fcmTokens');
        const tokens = technician?.fcmTokens?.map((entry) => entry.token).filter(Boolean) || [];
        if (tokens.length) {
          const totalItemsReturned = returnEntry.items.reduce((sum, item) => {
            if (item.type === 'serialized-product') {
              return sum + 1;
            }
            return sum + (item.quantity || 0);
          }, 0);
          const itemLabel = totalItemsReturned === 1 ? 'item' : 'items';
          const notificationTitle = 'Inventory Return Approved';
          const notificationBody = `Your ${totalItemsReturned} ${itemLabel} have been returned successfully.`;

          await sendNotification({
            tokens,
            notification: {
              title: notificationTitle,
              body: notificationBody,
            },
            data: {
              title: notificationTitle,
              body: notificationBody,
              totalItems: totalItemsReturned.toString(),
              status: 'confirmed',
              url: '/technician-dashboard?tab=inventory',
              icon: '/logo192.png',
            },
          });
        }
      } catch (notificationError) {
        console.error('Failed to notify technician about return approval:', notificationError);
      }
      
      res.json({
        success: true,
        message: 'Returned inventory confirmed successfully',
        data: {
          id: returnEntry._id,
          status: returnEntry.status,
          confirmedAt: returnEntry.confirmedAt
        }
      });
    } catch (err) {
      // Abort transaction on error
      await session.abortTransaction();
      throw err;
    } finally {
      // End session
      session.endSession();
    }
  } catch (err) {
    console.error('Error confirming returned inventory:', err);

    // Handle specific error cases
    if (err.message.includes('Referenced item not found') || err.message.includes('Item not found')) {
      res.status(400).json({
        success: false,
        message: err.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Server error. Please try again later.'
      });
    }
  }
};

module.exports = confirmReturnedInventory;
