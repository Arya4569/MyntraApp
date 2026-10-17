const express = require('express');
const router = express.Router();
const offerController = require('../controllers/offerController');

router.get('/', offerController.getCoupons);
router.post('/validate', offerController.validateCoupon);

module.exports = router;
