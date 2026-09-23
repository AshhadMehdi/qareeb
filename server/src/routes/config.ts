import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { databaseReport, ensureDatabase } from '../db/bootstrap.js';
import { publicConfig } from '../env.js';
import { gatewayStatus } from '../lib/payments.js';
import { ok } from '../lib/errors.js';
import { getSettings } from '../lib/settings.js';

export const configRouter = Router();

/** Read by the client on boot: demo credentials, city centre, payment modes. */
configRouter.get('/config', async (_req, res) => {
  let settings = null;
  let ready = false;
  try {
    await ensureDatabase();
    settings = await getSettings();
    ready = true;
  } catch (error) {
    console.warn('[qareeb] /api/config could not load settings:', (error as Error).message);
  }
  res.json(
    ok({
      ...publicConfig(),
      ready,
      city: settings?.cityName ?? 'Abbottabad',
      center: settings ? { lat: settings.cityLat, lng: settings.cityLng } : publicConfig().defaultCenter,
      announcement: settings?.announcement ?? '',
      supportPhone: settings?.supportPhone ?? '',
      paymentMethods: (['COD', 'JAZZCASH', 'EASYPAISA', 'WALLET', 'CARD'] as const).map((method) => ({
        method,
        ...gatewayStatus(method),
      })),
      limits: {
        maxUploadBytes: 3 * 1024 * 1024,
        radiusCapKm: settings?.radiusCapKm ?? 12,
        cancelWindowMinutes: settings?.cancelWindowMinutes ?? 5,
      },
    }),
  );
});

configRouter.get('/health', async (_req, res) => {
  const report = { ok: true, time: new Date().toISOString(), database: { connected: false, driver: null as string | null } };
  try {
    await ensureDatabase();
    const db = await getDb();
    await db.execute(sql`select 1`);
    report.database.connected = true;
    report.database.driver = databaseReport()?.driver ?? null;
  } catch (error) {
    res.status(503).json({
      ok: false,
      time: report.time,
      database: { connected: false, error: (error as Error).message.slice(0, 300) },
    });
    return;
  }
  res.json(report);
});
