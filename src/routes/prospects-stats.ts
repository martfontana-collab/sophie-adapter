import { Router } from 'express';
import type { Request, Response } from 'express';
import { getProspectStats } from '../services/sheets.js';

const router = Router();

router.get('/prospects/stats', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'week';

    let afterDate: Date | undefined;
    const now = new Date();

    switch (period) {
      case 'week':
        afterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        afterDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'all':
        afterDate = undefined;
        break;
      default:
        afterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const stats = await getProspectStats(afterDate);
    res.json({ period, stats });
  } catch (error) {
    console.error('[prospects/stats] Error:', error);
    res.status(500).json({ error: 'Failed to fetch prospect stats' });
  }
});

export default router;
