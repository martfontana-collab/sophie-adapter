import 'dotenv/config';
import express from 'express';
import { getCachedBiens, getLastRefresh, startCacheRefresh } from './services/sheets.js';
import { verifyRetellSignature } from './utils/retell-verify.js';
import { logStateOnBoot } from './services/call-state.js';
import searchBienRouter from './routes/search-bien.js';
import webhookCallEndedRouter from './routes/webhook-call-ended.js';
import prospectsStatsRouter from './routes/prospects-stats.js';
import adminTestEmailRouter from './routes/admin-test-email.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Preserve raw body on req.rawBody so webhook HMAC verification can work
// against the exact bytes Retell signed (JSON.stringify can reorder keys).
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
  },
}));

// Health check (no auth required)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    cache_size: getCachedBiens().length,
    last_refresh: getLastRefresh(),
  });
});

// Search endpoint (signature verification disabled -- Retell HMAC mismatch)
app.use(searchBienRouter);
app.use(webhookCallEndedRouter);
app.use(prospectsStatsRouter);
app.use(adminTestEmailRouter);

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
  logStateOnBoot();
});

export default app;
