const express = require('express');
const router = express.Router();
const insiderController = require('../controllers/insiderController');

router.get('/', insiderController.getInsiderDetails);

module.exports = router;
