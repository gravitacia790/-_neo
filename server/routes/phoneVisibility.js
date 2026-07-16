const express = require('express');
const { z } = require('zod');
const authRequired = require('../middleware/authRequired');
const { safe } = require('../middleware/safe');
const {
  createPhoneVisibilityRequest,
  respondToPhoneVisibilityRequest,
} = require('../services/phoneVisibilityService');

const router = express.Router();
const requestIdSchema = z.coerce.number().int().positive();
const decisionSchema = z.object({ decision: z.enum(['approved', 'rejected']) });

router.post(
  '/:directorId',
  authRequired,
  safe('phone_visibility_request')(async (req, res) => {
    const result = await createPhoneVisibilityRequest(req.user, req.params.directorId);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  })
);

router.put(
  '/:requestId',
  authRequired,
  safe('phone_visibility_request')(async (req, res) => {
    const parsedId = requestIdSchema.safeParse(req.params.requestId);
    const parsedBody = decisionSchema.safeParse(req.body || {});
    if (!parsedId.success || !parsedBody.success) {
      return res.status(400).json({ error: 'Некорректные данные запроса' });
    }
    const result = await respondToPhoneVisibilityRequest(req.user, parsedId.data, parsedBody.data.decision);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  })
);

module.exports = router;
