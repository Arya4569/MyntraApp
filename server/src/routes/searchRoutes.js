const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

router.get('/popular', searchController.getPopularSearches);
router.get('/trending', searchController.getPopularSearches);

module.exports = router;
