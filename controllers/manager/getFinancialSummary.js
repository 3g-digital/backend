const mongoose = require('mongoose');
const SalesBill = require('../../models/salesBillModel');
const Bill = require('../../models/billModel');

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  try {
    return new mongoose.Types.ObjectId(value);
  } catch (err) {
    return null;
  }
};

const getFinancialSummary = async (req, res) => {
  try {
    const isAdmin = req.userRole === 'admin';

    if (!isAdmin && req.userRole !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only managers and admins can view financial summary.',
      });
    }

    let branchId = null;
    if (isAdmin) {
      branchId = req.query.branch || null;
    } else {
      const branchField = req.userBranch;
      branchId = branchField && branchField._id ? branchField._id : branchField;
      if (!branchId) {
        return res.status(400).json({
          success: false,
          message: 'Branch information is required for manager summary',
        });
      }
    }

    const matchStage = {};
    const branchObjectId = toObjectId(branchId);
    if (branchObjectId) {
      matchStage.branch = branchObjectId;
    } else if (!isAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Invalid branch identifier provided',
      });
    }

    const summaryPipeline = [
      { $match: matchStage },
      {
        $facet: {
          // Total revenue from ALL bill types (customer, dealer, distributor)
          totals: [
            {
              $group: {
                _id: null,
                totalBilledAmount: { $sum: { $ifNull: ['$total', 0] } },
                amountCollected: { $sum: { $ifNull: ['$paidAmount', 0] } },
                outstandingAmount: { $sum: { $ifNull: ['$dueAmount', 0] } },
                totalBills: { $sum: 1 },
              },
            },
          ],
          // Calculate total expenses from inventory items (purchase price * quantity)
          // Includes items from all bill types (customer, dealer, distributor)
          expenses: [
            { $unwind: '$items' },
            {
              $lookup: {
                from: 'items',
                localField: 'items.itemId',
                foreignField: '_id',
                as: 'itemDetails',
              },
            },
            { $unwind: '$itemDetails' },
            {
              $match: {
                'itemDetails.type': {
                  $in: ['serialized-product', 'generic-product'],
                },
              },
            },
            {
              $group: {
                _id: null,
                totalExpenses: {
                  $sum: {
                    $multiply: [
                      { $ifNull: ['$items.quantity', 0] },
                      { $ifNull: ['$itemDetails.purchasePrice', 0] },
                    ],
                  },
                },
              },
            },
          ],
          accounts: [
            { $match: { customerType: 'customer' } },
            {
              $group: {
                _id: '$customerId',
                totalDue: { $sum: { $ifNull: ['$dueAmount', 0] } },
              },
            },
            {
              $group: {
                _id: null,
                totalCustomers: { $sum: 1 },
                settledCustomers: {
                  $sum: {
                    $cond: [{ $lte: ['$totalDue', 0.01] }, 1, 0],
                  },
                },
                customersWithOutstanding: {
                  $sum: {
                    $cond: [{ $gt: ['$totalDue', 0.01] }, 1, 0],
                  },
                },
              },
            },
          ],
          collection: [
            { $match: { paymentStatus: 'completed' } },
            {
              $project: {
                diffDays: {
                  $let: {
                    vars: {
                      days: {
                        $divide: [
                          {
                            $subtract: [
                              { $ifNull: ['$updatedAt', '$createdAt'] },
                              '$createdAt',
                            ],
                          },
                          1000 * 60 * 60 * 24,
                        ],
                      },
                    },
                    in: {
                      $cond: [{ $lt: ['$$days', 0] }, 0, '$$days'],
                    },
                  },
                },
              },
            },
            {
              $group: {
                _id: null,
                averageCollectionTime: { $avg: '$diffDays' },
              },
            },
          ],
        },
      },
      {
        $project: {
          totals: { $ifNull: [{ $arrayElemAt: ['$totals', 0] }, {}] },
          expenses: { $ifNull: [{ $arrayElemAt: ['$expenses', 0] }, {}] },
          accounts: { $ifNull: [{ $arrayElemAt: ['$accounts', 0] }, {}] },
          collection: { $ifNull: [{ $arrayElemAt: ['$collection', 0] }, {}] },
        },
      },
      {
        $project: {
          totalBilledAmount: {
            $round: [{ $ifNull: ['$totals.totalBilledAmount', 0] }, 2],
          },
          amountCollected: {
            $round: [{ $ifNull: ['$totals.amountCollected', 0] }, 2],
          },
          outstandingAmount: {
            $round: [{ $ifNull: ['$totals.outstandingAmount', 0] }, 2],
          },
          totalBills: { $ifNull: ['$totals.totalBills', 0] },
          totalExpenses: {
            $round: [{ $ifNull: ['$expenses.totalExpenses', 0] }, 2],
          },
          accountsSummary: {
            totalCustomers: { $ifNull: ['$accounts.totalCustomers', 0] },
            settledCustomers: { $ifNull: ['$accounts.settledCustomers', 0] },
            customersWithOutstanding: {
              $ifNull: ['$accounts.customersWithOutstanding', 0],
            },
          },
          averageCollectionTime: {
            $round: [{ $ifNull: ['$collection.averageCollectionTime', 0] }, 0],
          },
        },
      },
    ];

    const [summaryDoc] = await SalesBill.aggregate(summaryPipeline);

    const summary = summaryDoc || {
      totalBilledAmount: 0,
      amountCollected: 0,
      outstandingAmount: 0,
      totalBills: 0,
      totalExpenses: 0,
      accountsSummary: {
        totalCustomers: 0,
        settledCustomers: 0,
        customersWithOutstanding: 0,
      },
      averageCollectionTime: 0,
    };

    // Fetch Work Order Bills (technician bills) separately and add to summary
    let workOrderBillsData = {
      totalBilled: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      count: 0,
    };

    try {
      // Build match criteria for work order bills
      const workOrderMatchCriteria = { status: 'approved' }; // Only approved bills

      // For manager, filter by technician's branch
      if (!isAdmin && branchObjectId) {
        // Get all technicians from this branch
        const User = require('../../models/userModel');
        const branchTechnicians = await User.find({
          role: 'technician',
          branch: branchObjectId,
        }).select('_id');

        const technicianIds = branchTechnicians.map((t) => t._id);

        if (technicianIds.length > 0) {
          workOrderMatchCriteria.technician = { $in: technicianIds };
        } else {
          // No technicians in this branch, skip work order bills
          workOrderMatchCriteria.technician = null;
        }
      }

      if (workOrderMatchCriteria.technician !== null) {
        const workOrderBills = await Bill.aggregate([
          { $match: workOrderMatchCriteria },
          {
            $group: {
              _id: null,
              totalBilled: { $sum: { $ifNull: ['$totalAmount', 0] } },
              totalCollected: { $sum: { $ifNull: ['$amountPaid', 0] } },
              totalOutstanding: { $sum: { $ifNull: ['$amountDue', 0] } },
              count: { $sum: 1 },
            },
          },
        ]);

        if (workOrderBills.length > 0) {
          workOrderBillsData = workOrderBills[0];
        }

        // Calculate average collection time for completed work order bills
        const completedWorkOrderBills = await Bill.aggregate([
          {
            $match: {
              ...workOrderMatchCriteria,
              extendedPaymentStatus: 'paid' // Fully paid bills
            }
          },
          {
            $project: {
              diffDays: {
                $let: {
                  vars: {
                    days: {
                      $divide: [
                        {
                          $subtract: [
                            { $ifNull: ['$paidAt', '$updatedAt'] },
                            '$createdAt',
                          ],
                        },
                        1000 * 60 * 60 * 24, // Convert milliseconds to days
                      ],
                    },
                  },
                  in: {
                    $cond: [{ $lt: ['$$days', 0] }, 0, '$$days'],
                  },
                },
              },
            },
          },
          {
            $group: {
              _id: null,
              averageCollectionTime: { $avg: '$diffDays' },
              count: { $sum: 1 },
            },
          },
        ]);

        if (completedWorkOrderBills.length > 0) {
          workOrderBillsData.averageCollectionTime = completedWorkOrderBills[0].averageCollectionTime || 0;
          workOrderBillsData.completedCount = completedWorkOrderBills[0].count || 0;
        } else {
          workOrderBillsData.averageCollectionTime = 0;
          workOrderBillsData.completedCount = 0;
        }
      }
    } catch (workOrderError) {
      console.error('Error fetching work order bills:', workOrderError);
      // Continue without work order bills data
    }

    // Combine sales bills and work order bills data
    const totalBilledAmount = Number(summary.totalBilledAmount || 0) + Number(workOrderBillsData.totalBilled || 0);
    const amountCollected = Number(summary.amountCollected || 0) + Number(workOrderBillsData.totalCollected || 0);
    const outstandingAmount = Number(summary.outstandingAmount || 0) + Number(workOrderBillsData.totalOutstanding || 0);
    const totalExpenses = Number(summary.totalExpenses || 0);

    const netProfit = amountCollected - totalExpenses;
    const collectionRate =
      totalBilledAmount > 0
        ? Number(((amountCollected / totalBilledAmount) * 100).toFixed(1))
        : 0;
    const profitMargin =
      amountCollected > 0
        ? Number(((netProfit / amountCollected) * 100).toFixed(1))
        : 0;

    // Calculate combined average collection time
    // Weighted average based on number of completed bills from each source
    let combinedAverageCollectionTime = 0;

    const salesBillsAvgTime = summary.averageCollectionTime || 0;
    const workOrderAvgTime = workOrderBillsData.averageCollectionTime || 0;

    // Get count of completed bills from summary (we need to track this)
    // For now, if we have collection time from sales bills, count is at least 1
    const salesCompletedCount = salesBillsAvgTime > 0 ? 1 : 0; // Simplified
    const workOrderCompletedCount = workOrderBillsData.completedCount || 0;

    const totalCompletedBills = salesCompletedCount + workOrderCompletedCount;

    if (totalCompletedBills > 0) {
      // Weighted average
      combinedAverageCollectionTime = Math.round(
        ((salesBillsAvgTime * salesCompletedCount) + (workOrderAvgTime * workOrderCompletedCount)) / totalCompletedBills
      );
    }

    res.status(200).json({
      success: true,
      data: {
        totalBilledAmount,
        amountCollected,
        outstandingAmount,
        totalBills: (summary.totalBills || 0) + (workOrderBillsData.count || 0),
        totalExpenses,
        netProfit,
        collectionRate,
        profitMargin,
        accountsSummary: summary.accountsSummary || {
          totalCustomers: 0,
          settledCustomers: 0,
          customersWithOutstanding: 0,
        },
        averageCollectionTime: combinedAverageCollectionTime,
      },
    });
  } catch (error) {
    console.error('Error fetching manager financial summary:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching financial summary',
    });
  }
};

module.exports = getFinancialSummary;
