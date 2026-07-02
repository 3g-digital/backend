const mongoose = require('mongoose');
const SalesBill = require('../../models/salesBillModel');
const Bill = require('../../models/billModel');
const Customer = require('../../models/customerModel');

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  try {
    return new mongoose.Types.ObjectId(value);
  } catch (err) {
    return null;
  }
};

/**
 * Get Balance Overview for Manager Dashboard
 * Shows customers, dealers, and distributors with outstanding balances
 * Only shows accounts with due amount > 0
 */
const getBalanceOverview = async (req, res) => {
  try {
    const isAdmin = req.userRole === 'admin';

    if (!isAdmin && req.userRole !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only managers and admins can view balance overview.',
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
          message: 'Branch information is required for manager balance overview',
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

    // Aggregate bills by customer/dealer/distributor
    // Group by customerId and customerType to get totals for each account
    const balanceOverviewPipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            customerId: '$customerId',
            customerType: '$customerType',
          },
          customerName: { $first: '$customerName' },
          customerPhone: { $first: '$customerPhone' },
          customerModel: { $first: '$customerModel' },
          totalBilled: { $sum: { $ifNull: ['$total', 0] } },
          totalCollected: { $sum: { $ifNull: ['$paidAmount', 0] } },
          totalOutstanding: { $sum: { $ifNull: ['$dueAmount', 0] } },
          billCount: { $sum: 1 },
        },
      },
      // Lookup actual customer/dealer/distributor names
      {
        $lookup: {
          from: 'customers',
          let: { custId: '$_id.customerId', custType: '$_id.customerType' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$custId'] },
                    { $eq: ['$$custType', 'customer'] }
                  ]
                }
              }
            },
            { $project: { name: 1, firmName: 1, phoneNumber: 1, _id: 1 } }
          ],
          as: 'customerDetails'
        }
      },
      {
        $lookup: {
          from: 'dealers',
          let: { custId: '$_id.customerId', custType: '$_id.customerType' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$custId'] },
                    { $eq: ['$$custType', 'dealer'] }
                  ]
                }
              }
            },
            { $project: { name: 1, firmName: 1, phoneNumber: 1 } }
          ],
          as: 'dealerDetails'
        }
      },
      {
        $lookup: {
          from: 'distributors',
          let: { custId: '$_id.customerId', custType: '$_id.customerType' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$custId'] },
                    { $eq: ['$$custType', 'distributor'] }
                  ]
                }
              }
            },
            { $project: { name: 1, phoneNumber: 1 } }
          ],
          as: 'distributorDetails'
        }
      },
      // Only include accounts with outstanding balance > 0
      {
        $match: {
          totalOutstanding: { $gt: 0 },
        },
      },
      // Sort by outstanding amount (highest first)
      {
        $sort: { totalOutstanding: -1 },
      },
      {
        $project: {
          _id: 0,
          customerId: '$_id.customerId',
          customerType: '$_id.customerType',
          name: {
            $cond: [
              { $gt: [{ $size: '$customerDetails' }, 0] },
              { $arrayElemAt: ['$customerDetails.name', 0] },
              {
                $cond: [
                  { $gt: [{ $size: '$dealerDetails' }, 0] },
                  { $arrayElemAt: ['$dealerDetails.name', 0] },
                  {
                    $cond: [
                      { $gt: [{ $size: '$distributorDetails' }, 0] },
                      { $arrayElemAt: ['$distributorDetails.name', 0] },
                      '$customerName'
                    ]
                  }
                ]
              }
            ]
          },
          phone: {
            $cond: [
              { $gt: [{ $size: '$customerDetails' }, 0] },
              { $arrayElemAt: ['$customerDetails.phoneNumber', 0] },
              {
                $cond: [
                  { $gt: [{ $size: '$dealerDetails' }, 0] },
                  { $arrayElemAt: ['$dealerDetails.phoneNumber', 0] },
                  {
                    $cond: [
                      { $gt: [{ $size: '$distributorDetails' }, 0] },
                      { $arrayElemAt: ['$distributorDetails.phoneNumber', 0] },
                      '$customerPhone' // Fallback to bill's customerPhone
                    ]
                  }
                ]
              }
            ]
          },
          firmName: {
            $cond: [
              { $gt: [{ $size: '$customerDetails' }, 0] },
              { $arrayElemAt: ['$customerDetails.firmName', 0] },
              {
                $cond: [
                  { $gt: [{ $size: '$dealerDetails' }, 0] },
                  {
                    $ifNull: [
                      { $arrayElemAt: ['$dealerDetails.firmName', 0] },
                      { $arrayElemAt: ['$dealerDetails.name', 0] }
                    ]
                  },
                  {
                    $cond: [
                      { $gt: [{ $size: '$distributorDetails' }, 0] },
                      {
                        $ifNull: [
                          { $arrayElemAt: ['$distributorDetails.firmName', 0] },
                          { $arrayElemAt: ['$distributorDetails.name', 0] }
                        ]
                      },
                      null
                    ]
                  }
                ]
              }
            ]
          },
          billed: { $round: ['$totalBilled', 2] },
          collected: { $round: ['$totalCollected', 2] },
          outstanding: { $round: ['$totalOutstanding', 2] },
          billCount: 1,
        },
      },
    ];

    const balanceData = await SalesBill.aggregate(balanceOverviewPipeline);

    // Fetch Work Order Bills (technician bills) and add to balance data
    let workOrderBalanceData = [];

    try {
      const workOrderMatchCriteria = { status: 'approved', amountDue: { $gt: 0 } };

      // For manager, filter by technician's branch
      if (!isAdmin && branchObjectId) {
        const User = require('../../models/userModel');
        const branchTechnicians = await User.find({
          role: 'technician',
          branch: branchObjectId,
        }).select('_id');

        const technicianIds = branchTechnicians.map((t) => t._id);

        if (technicianIds.length > 0) {
          workOrderMatchCriteria.technician = { $in: technicianIds };

          // Aggregate work order bills by customer
          const workOrderPipeline = [
            { $match: workOrderMatchCriteria },
            {
              $group: {
                _id: '$customer',
                totalBilled: { $sum: { $ifNull: ['$totalAmount', 0] } },
                totalCollected: { $sum: { $ifNull: ['$amountPaid', 0] } },
                totalOutstanding: { $sum: { $ifNull: ['$amountDue', 0] } },
                billCount: { $sum: 1 },
              },
            },
            {
              $lookup: {
                from: 'customers',
                localField: '_id',
                foreignField: '_id',
                as: 'customerDetails',
              },
            },
            { $unwind: '$customerDetails' },
            {
              $project: {
                _id: 0,
                customerId: '$_id',
                customerType: 'customer',
                name: '$customerDetails.name',
                firmName: '$customerDetails.firmName',
                phone: '$customerDetails.phoneNumber',
                billed: { $round: ['$totalBilled', 2] },
                collected: { $round: ['$totalCollected', 2] },
                outstanding: { $round: ['$totalOutstanding', 2] },
                billCount: 1,
              },
            },
          ];

          workOrderBalanceData = await Bill.aggregate(workOrderPipeline);
        }
      }
    } catch (workOrderError) {
      console.error('Error fetching work order balance data:', workOrderError);
    }

    // Merge sales bills and work order bills
    // Group by customerId to combine if same customer has both types of bills
    const mergedBalanceMap = new Map();

    // Add sales bills
    balanceData.forEach((account) => {
      const key = account.customerId.toString();
      mergedBalanceMap.set(key, account);
    });

    // Add or merge work order bills
    workOrderBalanceData.forEach((account) => {
      const key = account.customerId.toString();
      if (mergedBalanceMap.has(key)) {
        // Merge with existing
        const existing = mergedBalanceMap.get(key);
        existing.billed += account.billed;
        existing.collected += account.collected;
        existing.outstanding += account.outstanding;
        existing.billCount += account.billCount;
      } else {
        // Add new
        mergedBalanceMap.set(key, account);
      }
    });

    // Convert map back to array and sort by outstanding
    const combinedBalanceData = Array.from(mergedBalanceMap.values())
      .filter((account) => account.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding);

    // Calculate summary statistics
    const summary = {
      totalAccounts: combinedBalanceData.length,
      totalBilled: combinedBalanceData.reduce((sum, account) => sum + account.billed, 0),
      totalCollected: combinedBalanceData.reduce((sum, account) => sum + account.collected, 0),
      totalOutstanding: combinedBalanceData.reduce((sum, account) => sum + account.outstanding, 0),
      byType: {
        customers: combinedBalanceData.filter(a => a.customerType === 'customer').length,
        dealers: combinedBalanceData.filter(a => a.customerType === 'dealer').length,
        distributors: combinedBalanceData.filter(a => a.customerType === 'distributor').length,
      },
    };

    res.status(200).json({
      success: true,
      data: {
        accounts: combinedBalanceData,
        summary,
      },
    });
  } catch (error) {
    console.error('Error fetching balance overview:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching balance overview',
    });
  }
};

module.exports = getBalanceOverview;
