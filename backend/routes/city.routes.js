const express = require('express');
const router = express.Router();
const { getCities, getCity } = require('../controllers/city.controller');

router.get('/', getCities);
router.get('/:slug', getCity);

module.exports = router;
