const mongoose = require('mongoose');
const SalesBill = require('../../models/salesBillModel');
const Bill = require('../../models/billModel');

const getAdminFinancialSummary = async (req, res) => {
  try {
    // Only admin can access this endpoint
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admins can view overall financial summary.',
      });
    }

    // Get month/year filter from query params
    const { month, year, period } = req.query;
    let dateFilter = {};

    if (period === 'overall') {
      // No filter - all data
      dateFilter = {};
    } else if (month && year) {
      // Specific month filter
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };
    } else {
      // Default: Current month
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };
    }

    // Aggregate financial data from ALL branches with date filtering
    const summaryPipeline = [
      // Apply date filter first
      ...(Object.keys(dateFilter).length > 0 ? [{ $match: dateFilter }] : []),
      {
        $facet: {
          // Total revenue from ALL bill types (customer, dealer, distributor) across ALL branches
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
          // Calculate net profit from items (totalPrice - quantity * purchasePrice)
          itemsProfit: [
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
                netProfitItems: {
                  $sum: {
                    $subtract: [
                      { $ifNull: ['$items.totalPrice', 0] },
                      {
                        $multiply: [
                          { $ifNull: ['$items.quantity', 0] },
                          { $ifNull: ['$itemDetails.purchasePrice', 0] },
                        ],
                      },
                    ],
                  },
                },
              },
            },
          ],
          // Calculate total services amount (totalPrice already includes quantity)
          services: [
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
                'itemDetails.type': 'service',
              },
            },
            {
              $group: {
                _id: null,
                totalServices: {
                  $sum: { $ifNull: ['$items.totalPrice', 0] },
                },
              },
            },
          ],
        },
      },
      {
        $project: {
          totals: { $ifNull: [{ $arrayElemAt: ['$totals', 0] }, {}] },
          expenses: { $ifNull: [{ $arrayElemAt: ['$expenses', 0] }, {}] },
          itemsProfit: { $ifNull: [{ $arrayElemAt: ['$itemsProfit', 0] }, {}] },
          services: { $ifNull: [{ $arrayElemAt: ['$services', 0] }, {}] },
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
          netProfitItems: {
            $round: [{ $ifNull: ['$itemsProfit.netProfitItems', 0] }, 2],
          },
          totalServices: {
            $round: [{ $ifNull: ['$services.totalServices', 0] }, 2],
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
      netProfitItems: 0,
      totalServices: 0,
    };

    // Fetch Work Order Bills (technician bills) from ALL branches
    let workOrderBillsData = {
      totalBilled: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      count: 0,
    };

    try {
      // Get all approved work order bills from all branches with date filter
      const workOrderMatchConditions = { status: 'approved' };
      if (Object.keys(dateFilter).length > 0) {
        Object.assign(workOrderMatchConditions, dateFilter);
      }

      const workOrderBills = await Bill.aggregate([
        { $match: workOrderMatchConditions }, // Apply status and date filter
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
    } catch (workOrderError) {
      console.error('Error fetching work order bills:', workOrderError);
      // Continue without work order bills data
    }

    // Combine sales bills and work order bills data
    const totalBilledAmount = Number(summary.totalBilledAmount || 0) + Number(workOrderBillsData.totalBilled || 0);
    const amountCollected = Number(summary.amountCollected || 0) + Number(workOrderBillsData.totalCollected || 0);
    const outstandingAmount = Number(summary.outstandingAmount || 0) + Number(workOrderBillsData.totalOutstanding || 0);
    const totalExpenses = Number(summary.totalExpenses || 0);
    const totalBills = (summary.totalBills || 0) + (workOrderBillsData.count || 0);

    // Calculate Net Profit from Items (Sale Price - Purchase Price) * Quantity
    const netProfitItems = Number(summary.netProfitItems || 0);

    // Calculate Total Services Amount
    const totalServices = Number(summary.totalServices || 0);

    // Calculate Gross Profit (Net Profit Items + Total Services)
    const grossProfit = netProfitItems + totalServices;

    // Calculate profit margin based on net profit items
    const profitMargin = amountCollected > 0
      ? Number(((netProfitItems / amountCollected) * 100).toFixed(1))
      : 0;

    const collectionRate = totalBilledAmount > 0
      ? Number(((amountCollected / totalBilledAmount) * 100).toFixed(1))
      : 0;

    // Calculate average collection time across all branches
    let averageCollectionTime = 0;
    try {
      // Get average collection time from completed sales bills with date filter
      const collectionTimeMatchConditions = { paymentStatus: 'completed' };
      if (Object.keys(dateFilter).length > 0) {
        Object.assign(collectionTimeMatchConditions, dateFilter);
      }

      const salesBillsCollectionTime = await SalesBill.aggregate([
        { $match: collectionTimeMatchConditions },
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
      ]);

      if (salesBillsCollectionTime.length > 0) {
        averageCollectionTime = Math.round(salesBillsCollectionTime[0].averageCollectionTime || 0);
      }
    } catch (err) {
      console.error('Error calculating average collection time:', err);
    }

    res.status(200).json({
      success: true,
      data: {
        totalBilledAmount,
        amountCollected,
        outstandingAmount,
        totalBills,
        totalExpenses,
        netProfitItems,
        totalServices,
        grossProfit,
        collectionRate,
        profitMargin,
        averageCollectionTime,
      },
    });
  } catch (error) {
    console.error('Error fetching admin financial summary:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching admin financial summary',
    });
  }
};

module.exports = getAdminFinancialSummary;
