const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

router.get('/', categoryController.getAll);
router.get('/subcategories', categoryController.getSubcategories);
router.get('/:id', categoryController.getById);
router.get('/:id/products', categoryController.getProducts);

module.exports = router;
