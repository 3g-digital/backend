const SalesBill = require('../../models/salesBillModel');
const Bill = require('../../models/billModel');

const getAvailableMonths = async (req, res) => {
  try {
    // Get unique months from SalesBills (Customer, Dealer, Distributor bills)
    const salesBillMonths = await SalesBill.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          }
        }
      },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month'
        }
      }
    ]);

    // Get unique months from Work Order Bills (Technician bills)
    const workOrderMonths = await Bill.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          }
        }
      },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month'
        }
      }
    ]);

    // Combine both arrays and remove duplicates
    const allMonths = [...salesBillMonths, ...workOrderMonths];

    // Create a Set to remove duplicates based on year-month combination
    const uniqueMonthsMap = new Map();
    allMonths.forEach(item => {
      const key = `${item.year}-${item.month}`;
      if (!uniqueMonthsMap.has(key)) {
        uniqueMonthsMap.set(key, item);
      }
    });

    // Convert Map back to array and sort (latest first)
    const uniqueMonths = Array.from(uniqueMonthsMap.values()).sort((a, b) => {
      if (b.year !== a.year) {
        return b.year - a.year;
      }
      return b.month - a.month;
    });

    res.status(200).json({
      success: true,
      data: uniqueMonths
    });
  } catch (error) {
    console.error('Error fetching available months:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching available months'
    });
  }
};

module.exports = getAvailableMonths;
