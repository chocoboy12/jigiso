const express = require('express');
const router = express.Router();
const { getShowcase } = require('../controllers/showcase.controller');

router.get('/', getShowcase);

module.exports = router;
