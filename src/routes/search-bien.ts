import { Router } from 'express';
import type { Request, Response } from 'express';
import { searchBiens } from '../services/search.js';
import type { SearchRequest } from '../types/bien.js';

const router = Router();

router.post('/search-bien', (req: Request, res: Response) => {
  const body = req.body as SearchRequest;

  if (!body.args) {
    res.json({
      result_count: 0,
      has_multiple: false,
      message: 'Parametres manquants.',
      biens: [],
    });
    return;
  }

  const result = searchBiens(body.args);
  res.json(result);
});

export default router;
