import 'dotenv/config';
import express from 'express';
import { getCachedBiens, getLastRefresh, startCacheRefresh } from './services/sheets.js';
import { verifyRetellSignature } from './utils/retell-verify.js';
import searchBienRouter from './routes/search-bien.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Health check (no auth required)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    cache_size: getCachedBiens().length,
    last_refresh: getLastRefresh(),
  });
});

// Search endpoint with Retell signature verification
app.use(verifyRetellSignature, searchBienRouter);

// Start cache refresh if Google Sheet credentials available
const sheetId = process.env.GOOGLE_SHEET_ID;
if (sheetId) {
  const intervalMs = parseInt(process.env.CACHE_REFRESH_MS || '300000', 10);
  startCacheRefresh(intervalMs);
  console.log(`[server] Cache refresh started (every ${intervalMs / 1000}s)`);
} else {
  console.warn('[server] No GOOGLE_SHEET_ID -- running without sheet cache (test mode)');
}

app.listen(PORT, () => {
  console.log(`[server] Sophie adapter listening on port ${PORT}`);
});

export default app;
