import { createHmac } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export function verifyRetellSignature(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiKey = process.env.RETELL_API_KEY;

  if (!apiKey) {
    console.warn('[retell-verify] No RETELL_API_KEY set -- skipping verification');
    next();
    return;
  }

  const signature = req.headers['x-retell-signature'] as string | undefined;

  if (!signature) {
    res.status(401).json({ error: 'Missing X-Retell-Signature header' });
    return;
  }

  // Retell sends the raw body signed with HMAC-SHA256 using the API key
  const body = JSON.stringify(req.body);
  const expectedSignature = createHmac('sha256', apiKey)
    .update(body)
    .digest('hex');

  if (signature !== expectedSignature) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  next();
}
