import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ ok: true, service: 'ceo-command-center-api', timestamp: new Date().toISOString() });
});

export default router;
