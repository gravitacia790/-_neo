var express = require('express');
var authRequired = require('../middleware/authRequired');
var safe = require('../middleware/safe').safe;
var directorsService = require('../services/directorsService');

var router = express.Router();

router.get(
  '/',
  authRequired,
  safe('directors')(async (req, res) => {
    res.json(await directorsService.listDirectors(req.user, req.query));
  })
);

router.get(
  '/mentors',
  authRequired,
  safe('directors')(async (req, res) => {
    res.json(await directorsService.listMentors(req.user));
  })
);

router.get(
  '/favorites',
  authRequired,
  safe('directors')(async (req, res) => {
    res.json(await directorsService.listFavorites(req.user, req.query));
  })
);

router.post(
  '/:id/favorite',
  authRequired,
  safe('directors')(async (req, res) => {
    var result = await directorsService.toggleFavorite(req.user, req.params.id);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  })
);

router.get(
  '/:id',
  authRequired,
  safe('directors')(async (req, res) => {
    var result = await directorsService.getDirectorById(req.user, req.params.id);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  })
);

module.exports = router;
