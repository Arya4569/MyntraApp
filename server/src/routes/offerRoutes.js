const express = require('express');
const router = express.Router();
const offerController = require('../controllers/offerController');

router.get('/bank-offers', offerController.getBankOffers);
router.get('/', offerController.getBankOffers);

module.exports = router;
