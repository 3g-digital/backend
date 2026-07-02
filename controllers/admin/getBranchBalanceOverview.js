const mongoose = require('mongoose');
const SalesBill = require('../../models/salesBillModel');
const Bill = require('../../models/billModel');
const Branch = require('../../models/branchModel');
const User = require('../../models/userModel');

const getBranchBalanceOverview = async (req, res) => {
  try {
    // Only admin can access this endpoint
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admins can view branch balance overview.',
      });
    }

    // Fetch all branches
    const branches = await Branch.find().select('_id name location');

    if (!branches || branches.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          branches: [],
          summary: {
            totalAmount: 0,
            totalCollected: 0,
            totalOutstanding: 0,
            totalExpenses: 0,
          },
        },
      });
    }

    // Get financial data for each branch
    const branchBalanceData = await Promise.all(
      branches.map(async (branch) => {
        const branchId = branch._id;

        // Aggregate SalesBill data for this branch
        const salesBillPipeline = [
          { $match: { branch: branchId } },
          {
            $facet: {
              totals: [
                {
                  $group: {
                    _id: null,
                    totalAmount: { $sum: { $ifNull: ['$total', 0] } },
                    amountCollected: { $sum: { $ifNull: ['$paidAmount', 0] } },
                    outstandingAmount: { $sum: { $ifNull: ['$dueAmount', 0] } },
                  },
                },
              ],
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
            },
          },
          {
            $project: {
              totals: { $ifNull: [{ $arrayElemAt: ['$totals', 0] }, {}] },
              expenses: { $ifNull: [{ $arrayElemAt: ['$expenses', 0] }, {}] },
            },
          },
        ];

        const [salesBillSummary] = await SalesBill.aggregate(salesBillPipeline);

        const salesTotals = salesBillSummary?.totals || {};
        const salesExpenses = salesBillSummary?.expenses || {};

        // Get technicians for this branch
        const branchTechnicians = await User.find({
          role: 'technician',
          branch: branchId,
        }).select('_id');

        const technicianIds = branchTechnicians.map((t) => t._id);

        // Aggregate work order bills for technicians in this branch
        let workOrderTotals = {
          totalAmount: 0,
          amountCollected: 0,
          outstandingAmount: 0,
        };

        if (technicianIds.length > 0) {
          const workOrderBills = await Bill.aggregate([
            {
              $match: {
                status: 'approved',
                technician: { $in: technicianIds },
              },
            },
            {
              $group: {
                _id: null,
                totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
                amountCollected: { $sum: { $ifNull: ['$amountPaid', 0] } },
                outstandingAmount: { $sum: { $ifNull: ['$amountDue', 0] } },
              },
            },
          ]);

          if (workOrderBills.length > 0) {
            workOrderTotals = workOrderBills[0];
          }
        }

        // Combine sales bills and work order bills
        const totalAmount =
          Number(salesTotals.totalAmount || 0) +
          Number(workOrderTotals.totalAmount || 0);
        const amountCollected =
          Number(salesTotals.amountCollected || 0) +
          Number(workOrderTotals.amountCollected || 0);
        const outstandingAmount =
          Number(salesTotals.outstandingAmount || 0) +
          Number(workOrderTotals.outstandingAmount || 0);
        const totalExpenses = Number(salesExpenses.totalExpenses || 0);

        return {
          branchId: branch._id,
          branchName: branch.name,
          branchLocation: branch.location,
          totalAmount: Math.round(totalAmount * 100) / 100,
          amountCollected: Math.round(amountCollected * 100) / 100,
          outstandingAmount: Math.round(outstandingAmount * 100) / 100,
          totalExpenses: Math.round(totalExpenses * 100) / 100,
        };
      })
    );

    // Calculate overall summary
    const summary = branchBalanceData.reduce(
      (acc, branch) => ({
        totalAmount: acc.totalAmount + branch.totalAmount,
        totalCollected: acc.totalCollected + branch.amountCollected,
        totalOutstanding: acc.totalOutstanding + branch.outstandingAmount,
        totalExpenses: acc.totalExpenses + branch.totalExpenses,
      }),
      {
        totalAmount: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        totalExpenses: 0,
      }
    );

    res.status(200).json({
      success: true,
      data: {
        branches: branchBalanceData,
        summary: {
          totalAmount: Math.round(summary.totalAmount * 100) / 100,
          totalCollected: Math.round(summary.totalCollected * 100) / 100,
          totalOutstanding: Math.round(summary.totalOutstanding * 100) / 100,
          totalExpenses: Math.round(summary.totalExpenses * 100) / 100,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching branch balance overview:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching branch balance overview',
    });
  }
};

module.exports = getBranchBalanceOverview;
