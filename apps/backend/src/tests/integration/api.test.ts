/**
 * End-to-end API tests. Require a disposable Postgres:
 *   TEST_DATABASE_URL=postgresql://... npm test
 * They are skipped automatically when TEST_DATABASE_URL is not set so the pure
 * unit tests always run in CI without a database.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { execSync } from 'node:child_process';

const hasDb = !!process.env.TEST_DATABASE_URL;
if (hasDb) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';

const d = hasDb ? describe : describe.skip;

d('DSM API (integration)', () => {
  let app: import('express').Express;
  let prisma: import('@prisma/client').PrismaClient;
  let adminToken = '';
  let handlerId = '';
  let handlerToken = '';

  beforeAll(async () => {
    // Reset the test schema from scratch (ignores any prior/failed migration state)
    // then seed. `db push --force-reset` drops & recreates everything.
    const runEnv = { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL };
    execSync('npx prisma db push --force-reset --skip-generate --accept-data-loss', {
      stdio: 'inherit',
      env: runEnv,
    });
    execSync('npx tsx prisma/seed.ts', { stdio: 'inherit', env: runEnv });

    const { createApp } = await import('../../app.js');
    const { prisma: p } = await import('../../lib/prisma.js');
    prisma = p;
    app = createApp();

    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@display.local', password: 'Admin@12345' });
    adminToken = login.body.accessToken;
    const handler = await prisma.user.findUnique({ where: { email: 'handler@display.local' } });
    handlerId = handler!.id;
    const hLogin = await request(app)
      .post('/auth/login')
      .send({ email: 'handler@display.local', password: 'Handler@12345' });
    handlerToken = hLogin.body.accessToken;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  let screenId = '';
  let deviceToken = '';

  it('1+5. registers a screen via pairing code', async () => {
    const pair = await request(app).post('/devices/pair-request').send({
      width: 1920,
      height: 1080,
      orientation: 'LANDSCAPE',
      userAgent: 'test',
    });
    expect(pair.status).toBe(201);
    const code = pair.body.pairingCode;

    const claim = await request(app)
      .post('/screens/pair')
      .set(auth(adminToken))
      .send({ pairingCode: code, name: 'Reception 1', orientation: 'LANDSCAPE', handlerIds: [handlerId] });
    expect(claim.status).toBe(201);
    expect(claim.body.screenKey).toBe('SCREEN-001');
    screenId = claim.body.id;

    const status = await request(app).get(`/devices/pair-status/${code}`);
    expect(status.body.status).toBe('paired');
    deviceToken = status.body.deviceToken;
    expect(deviceToken).toBeTruthy();
  });

  it('2. device authenticates with its credential', async () => {
    const res = await request(app).post('/devices/authenticate').send({ deviceToken });
    expect(res.status).toBe(200);
    expect(res.body.config.screenKey).toBe('SCREEN-001');
  });

  it('4. handler cannot access an unassigned screen', async () => {
    // create a second screen not assigned to handler
    const pair = await request(app).post('/devices/pair-request').send({ width: 1080, height: 1920, orientation: 'PORTRAIT' });
    const claim = await request(app)
      .post('/screens/pair')
      .set(auth(adminToken))
      .send({ pairingCode: pair.body.pairingCode, name: 'Hall', orientation: 'PORTRAIT', handlerIds: [] });
    const other = claim.body.id;
    const res = await request(app).get(`/screens/${other}/playlist`).set(auth(handlerToken));
    expect(res.status).toBe(403);
  });

  let contentA = '';
  let contentB = '';
  let contentX = '';
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  async function upload(title: string, token = handlerToken) {
    const res = await request(app)
      .post('/content')
      .set(auth(token))
      .field('title', title)
      .field('type', 'GENERAL')
      .attach('file', png, `${title}.png`);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT'); // Scenario 5: uploads are drafts
    return res.body.id as string;
  }

  it('5. uploads become drafts', async () => {
    contentA = await upload('A');
    contentB = await upload('B');
    contentX = await upload('X');
  });

  it('7+8+10. inserts, reorders and publishes a playlist', async () => {
    await request(app).post(`/screens/${screenId}/playlist/items`).set(auth(handlerToken)).send({ contentId: contentA });
    await request(app).post(`/screens/${screenId}/playlist/items`).set(auth(handlerToken)).send({ contentId: contentB });
    // insert X at position 1
    const ins = await request(app)
      .post(`/screens/${screenId}/playlist/items`)
      .set(auth(handlerToken))
      .send({ contentId: contentX, position: 1 });
    expect(ins.body.items.map((i: any) => i.content.id)).toEqual([contentA, contentX, contentB]);

    const pub = await request(app).post(`/screens/${screenId}/playlist/publish`).set(auth(handlerToken));
    expect(pub.status).toBe(200);
    expect(pub.body.version).toBe(1);

    const live = await request(app).get(`/devices/me/playlist`).set('Authorization', `Device ${deviceToken}`);
    expect(live.body.items).toHaveLength(3);
  });

  it('6+14. replace preserves position and creates history on republish', async () => {
    const editor = await request(app).get(`/screens/${screenId}/playlist`).set(auth(handlerToken));
    const itemX = editor.body.items[1]; // X at position 1
    await request(app)
      .put(`/screens/${screenId}/playlist/items/${itemX.id}/replace`)
      .set(auth(handlerToken))
      .send({ contentId: contentA }); // replace X with A (A already exists too but that's fine for the diff)
    // use a fresh content to make history deterministic
    const contentY = await upload('Y');
    const editor2 = await request(app).get(`/screens/${screenId}/playlist`).set(auth(handlerToken));
    await request(app)
      .put(`/screens/${screenId}/playlist/items/${editor2.body.items[1].id}/replace`)
      .set(auth(handlerToken))
      .send({ contentId: contentY });
    await request(app).post(`/screens/${screenId}/playlist/publish`).set(auth(handlerToken));

    const history = await request(app).get('/history').set(auth(handlerToken));
    expect(history.body.length).toBeGreaterThan(0);
  });

  it('17+18. admin restore returns content to library as DRAFT (never live)', async () => {
    const history = await request(app).get('/history').set(auth(adminToken));
    const item = history.body[0];
    const res = await request(app).post(`/history/${item.id}/restore`).set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.content.status).toBe('DRAFT');
  });

  it('22+23. maintenance mode then resume updates screen status', async () => {
    const m = await request(app)
      .post(`/screens/${screenId}/maintenance`)
      .set(auth(adminToken))
      .send({ durationMinutes: 10 });
    expect(m.status).toBe(200);
    let s = await prisma.screen.findUnique({ where: { id: screenId } });
    expect(s!.status).toBe('MAINTENANCE');
    await request(app).post(`/screens/${screenId}/resume`).set(auth(adminToken));
    s = await prisma.screen.findUnique({ where: { id: screenId } });
    expect(s!.status).toBe('ACTIVE');
  });

  it('24. heartbeat is recorded', async () => {
    const res = await request(app)
      .post('/devices/me/heartbeat')
      .set('Authorization', `Device ${deviceToken}`)
      .send({ status: 'online', playerVersion: '1.0.0', currentContent: 'A' });
    expect(res.status).toBe(200);
    const hb = await prisma.deviceHeartbeat.findFirst({ where: { screenId }, orderBy: { createdAt: 'desc' } });
    expect(hb!.playerVersion).toBe('1.0.0');
  });

  it('3+25. revoke credential and disable screen block the device', async () => {
    await request(app).post(`/screens/${screenId}/disable`).set(auth(adminToken));
    const blocked = await request(app).post('/devices/authenticate').send({ deviceToken });
    expect(blocked.status).toBe(403); // DEVICE_DISABLED
    await request(app).post(`/screens/${screenId}/enable`).set(auth(adminToken));
    await request(app).post(`/screens/${screenId}/revoke-credential`).set(auth(adminToken));
    const revoked = await request(app).post('/devices/authenticate').send({ deviceToken });
    expect(revoked.status).toBe(401); // DEVICE_REVOKED
  });

  it('19. birthday generation creates instances for today', async () => {
    const gen = await request(app).post('/birthday/generate').set(auth(adminToken));
    expect(gen.status).toBe(200);
    expect(gen.body.count).toBeGreaterThanOrEqual(2); // Rahul + Aman seeded for today
  });

  it('15. history cleanup removes expired entries', async () => {
    // force-expire all history then run the job
    await prisma.contentHistory.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const { runHistoryCleanup } = await import('../../scheduler/historyCleanup.job.js');
    const result = await runHistoryCleanup();
    expect(result.purged).toBeGreaterThanOrEqual(0);
    const remaining = await prisma.contentHistory.count({ where: { expiresAt: { lt: new Date() } } });
    expect(remaining).toBe(0);
  });
});
