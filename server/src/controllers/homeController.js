const db = require('../db');
const Category = require('../models/Category');
const Product = require('../models/Product');

exports.getHomeData = (req, res) => {
  try {
    const data = db.read();

    const categories = Category.findAll();
    const banners = data.promoBanners || [];
    const featuredProducts = Product.findFeatured(8);
    const trendingProducts = Product.findTrending(8);
    const dealOfDayProducts = Product.findDeals(8);
    const curatedCollections = data.curatedCollections || [];
    const topBrands = data.topBrands || [];
    const bankOffers = data.bankOffers || [];

    return res.status(200).json({
      success: true,
      data: {
        banners,
        categories,
        featuredProducts,
        trendingProducts,
        dealOfDayProducts,
        curatedCollections,
        topBrands,
        bankOffers,
      },
      // Top-level aliases for direct access
      banners,
      categories,
      featuredProducts,
      trendingProducts,
      dealOfDayProducts,
      curatedCollections,
      topBrands,
      bankOffers,
    });
  } catch (err) {
    console.error('Error fetching home screen data:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch home screen data.',
    });
  }
};
