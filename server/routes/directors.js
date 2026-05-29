var express = require('express');
var authRequired = require('../middleware/authRequired');
var safe = require('../middleware/safe').safe;
var directorsService = require('../services/directorsService');

var router = express.Router();

router.get(
  '/',
  authRequired,
  safe('directors')((req, res) => {
    res.json(directorsService.listDirectors(req.user, req.query));
  })
);

router.get(
  '/mentors',
  authRequired,
  safe('directors')((req, res) => {
    res.json(directorsService.listMentors(req.user));
  })
);

router.get(
  '/:id',
  authRequired,
  safe('directors')((req, res) => {
    var result = directorsService.getDirectorById(req.user, req.params.id);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  })
);

module.exports = router;
