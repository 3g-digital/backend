const mongoose = require('mongoose');
const ReturnedInventory = require('../../models/returnedInventoryModel');
const TechnicianInventory = require('../../models/technicianInventoryModel');
const Item = require('../../models/inventoryModel');
const User = require('../../models/userModel');
const sendNotification = require('../../helpers/push/sendNotification');

const rejectReturnedInventory = async (req, res) => {
  try {
    // Only managers can reject returned inventory
    if (req.userRole !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Only managers can reject returned inventory.'
      });
    }

    const { returnId } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason || rejectionReason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

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
      // Restore items back to technician's inventory
      for (const returnedItem of returnEntry.items) {
        // Check if the referenced item exists
        if (!returnedItem.item) {
          throw new Error(`Referenced item not found for returned item. The item may have been deleted.`);
        }

        const item = await Item.findById(returnedItem.item._id).session(session);

        if (!item) {
          throw new Error(`Item not found: ${returnedItem.item._id}`);
        }

        // Find or create technician inventory entry
        let techInventory = await TechnicianInventory.findOne({
          technician: returnEntry.technician,
          item: item._id
        }).session(session);

        if (!techInventory) {
          // Create new technician inventory entry if doesn't exist
          techInventory = new TechnicianInventory({
            technician: returnEntry.technician,
            item: item._id,
            serializedItems: [],
            genericQuantity: 0,
            lastUpdated: new Date(),
            lastUpdatedBy: req.userId
          });
        }

        // Restore item to technician's inventory
        if (returnedItem.type === 'serialized-product') {
          // For serialized product, restore the specific serial item
          const existingSerialIndex = techInventory.serializedItems.findIndex(
            si => si.serialNumber === returnedItem.serialNumber
          );

          if (existingSerialIndex >= 0) {
            // Update status back to active
            techInventory.serializedItems[existingSerialIndex].status = 'active';
          } else {
            // Add back the serialized item
            techInventory.serializedItems.push({
              serialNumber: returnedItem.serialNumber,
              status: 'active',
              assignedAt: new Date()
            });
          }
        } else {
          // For generic product, add back the quantity
          techInventory.genericQuantity += returnedItem.quantity;
        }

        // Update timestamps
        techInventory.lastUpdated = new Date();
        techInventory.lastUpdatedBy = req.userId;

        await techInventory.save({ session });
      }

      // Update the returned inventory entry with rejection details
      returnEntry.status = 'rejected';
      returnEntry.rejectedAt = new Date();
      returnEntry.rejectedBy = req.userId;
      returnEntry.rejectionReason = rejectionReason.trim();
      await returnEntry.save({ session });

      // Commit the transaction
      await session.commitTransaction();

      try {
        const technician = await User.findById(returnEntry.technician).select('fcmTokens');
        const tokens = technician?.fcmTokens?.map((entry) => entry.token).filter(Boolean) || [];
        if (tokens.length) {
          const cleanReason = (rejectionReason || '').replace(/\s+/g, ' ').trim();
          const truncatedReason = cleanReason.length > 120 ? `${cleanReason.slice(0, 117)}...` : cleanReason;
          const notificationTitle = 'Inventory Return Rejected';
          const notificationBody = truncatedReason || 'Your inventory return request was rejected.';

          await sendNotification({
            tokens,
            notification: {
              title: notificationTitle,
              body: notificationBody,
            },
            data: {
              title: notificationTitle,
              body: notificationBody,
              status: 'rejected',
              reason: truncatedReason,
              url: '/technician-dashboard?tab=inventory',
              icon: '/logo192.png',
            },
          });
        }
      } catch (notificationError) {
        console.error('Failed to notify technician about return rejection:', notificationError);
      }

      res.json({
        success: true,
        message: 'Returned inventory rejected successfully',
        data: {
          id: returnEntry._id,
          status: returnEntry.status,
          rejectedAt: returnEntry.rejectedAt,
          rejectionReason: returnEntry.rejectionReason
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
    console.error('Error rejecting returned inventory:', err);

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

module.exports = rejectReturnedInventory;
