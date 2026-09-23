/**
 * Vercel function body. api/index.js imports this file once per warm instance.
 * Requests flow through the same Express app as `npm run dev`, so routes behave
 * identically in both places.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app.js';
import { ensureDatabase } from './db/bootstrap.js';

type VercelRequest = IncomingMessage & { body?: unknown; _body?: boolean };
type VercelResponse = ServerResponse & { status?: (code: number) => VercelResponse };

const app = createApp();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel parses JSON bodies before the function runs, so tell Express's body
  // parser to leave the already-populated req.body alone (it honours req._body).
  if (req.body !== undefined) {
    if (typeof req.body === 'string') {
      try {
        req.body = JSON.parse(req.body) as unknown;
      } catch {
        /* leave it as a string; routes validate everything anyway */
      }
    }
    req._body = true;
  }

  try {
    await ensureDatabase();
  } catch (error) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: false,
        setup: true,
        error: String((error as Error)?.message ?? error).slice(0, 400),
      }),
    );
    return;
  }

  return (app as unknown as (req: VercelRequest, res: VercelResponse) => void)(req, res);
}
