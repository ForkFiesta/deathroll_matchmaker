import express from 'express';
import rateLimit from 'express-rate-limit';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { z, ZodError } from 'zod';
import {
  CLASSES,
  FACTIONS,
  REGIONS,
  RULESETS,
  ZONES,
  type Match,
  type Opponent,
  type Profile,
} from '../shared/types.js';
import {
  AppError,
  addRoll,
  advanceDemo,
  assert,
  chooseStake,
  compatible,
  parseReceipt,
  sortOpponents,
  ticketFor,
} from './domain.js';
import { demoPlayers } from './demo.js';
import { Store } from './store.js';

const preferencesSchema = z
  .object({
    minStake: z.number().int().min(1).max(1000),
    maxStake: z.number().int().min(1).max(1000),
    preferredStake: z.number().int().min(1).max(1000),
    sessionLimit: z.number().int().min(1).max(5000),
    establishedOnly: z.boolean(),
  })
  .strict()
  .refine(
    (p) =>
      p.minStake <= p.preferredStake &&
      p.preferredStake <= p.maxStake &&
      p.sessionLimit >= p.minStake,
    {
      message:
        'Keep your preferred stake inside the range, and your daily limit at least as large as the minimum stake.',
    },
  );
const profileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^[\p{L}\p{N} '\-]+$/u, 'Use letters, numbers, spaces, apostrophes or hyphens.'),
    className: z.enum(CLASSES),
    region: z.enum(REGIONS),
    ruleset: z.enum(RULESETS),
    faction: z.enum(FACTIONS),
    zone: z.enum(ZONES),
    preferences: preferencesSchema,
  })
  .strict();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function createApp(
  options: { database?: string; testing?: boolean; staticDir?: string } = {},
) {
  const store = new Store(options.database ?? process.env.DATABASE_PATH ?? '.data/last-roll.db');
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
    });
    next();
  });
  if (!options.testing)
    app.use(
      '/api',
      rateLimit({
        windowMs: 60_000,
        limit: 180,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { error: 'A little too fast. Please try again in a minute.' },
      }),
    );
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method)) {
      if (req.headers['x-last-roll'] !== '1')
        return res.status(403).json({ error: 'Missing request verification header.' });
      const origin = req.headers.origin;
      const allowed = process.env.PUBLIC_ORIGIN ?? `${req.protocol}://${req.get('host')}`;
      if (
        origin &&
        origin !== allowed &&
        !(process.env.NODE_ENV !== 'production' && origin === 'http://127.0.0.1:5173')
      )
        return res.status(403).json({ error: 'This origin is not allowed.' });
    }
    next();
  });
  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', mode: 'practice', version: '0.1.0' }),
  );
  app.post('/api/session', (req, res) => {
    const token = cookieToken(req.headers.cookie);
    const existing =
      token &&
      (store.db
        .prepare('SELECT player_id FROM sessions WHERE token=? AND expires_at>?')
        .get(hash(token), Date.now()) as { player_id: string } | undefined);
    if (existing) return res.json({ profile: store.profile(existing.player_id) });
    const profile = store.createProfile();
    const fresh = randomBytes(32).toString('hex');
    store.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    store.db
      .prepare('INSERT INTO sessions VALUES (?,?,?)')
      .run(hash(fresh), profile.id, Date.now() + 7 * 86400_000);
    res.cookie('lr_session', fresh, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure || process.env.PUBLIC_ORIGIN?.startsWith('https://'),
      maxAge: 7 * 86400_000,
      path: '/',
    });
    res.status(201).json({ profile });
  });
  app.use('/api', (req, res, next) => {
    const token = cookieToken(req.headers.cookie);
    const session =
      token &&
      (store.db
        .prepare('SELECT player_id FROM sessions WHERE token=? AND expires_at>?')
        .get(hash(token), Date.now()) as { player_id: string } | undefined);
    if (!session)
      return res
        .status(401)
        .json({ error: 'Your practice session expired. Refresh to start a new one.' });
    res.locals.profile = store.profile(session.player_id);
    store.expireInvitations();
    next();
  });
  app.get('/api/me', (_req, res) => {
    const profile: Profile = res.locals.profile;
    res.json({
      profile,
      activeMatch: store.active(profile.id),
      queued: !!store.queued(profile.id),
      losses: store.losses(profile.id),
      stats: store.stats(profile.id),
    });
  });
  app.put('/api/profile', (req, res) => {
    const profile: Profile = res.locals.profile;
    assert(
      !store.active(profile.id),
      'Finish or cancel your current match before changing your profile.',
      409,
    );
    const update = profileSchema.parse(req.body);
    const updated = { ...update, id: profile.id };
    store.saveProfile(updated);
    store.leave(profile.id);
    res.json({ profile: updated });
  });
  app.get('/api/lobby', (_req, res) => {
    const profile: Profile = res.locals.profile;
    const rows = store.db
      .prepare(
        'SELECT player_id, created_at, expires_at FROM queue WHERE expires_at>? AND player_id!=?',
      )
      .all(Date.now(), profile.id) as {
      player_id: string;
      created_at: number;
      expires_at: number;
    }[];
    const people: Opponent[] = rows.map((row) => {
      const p = store.profile(row.player_id)!;
      return {
        ...p,
        demo: false,
        ...store.stats(p.id, false),
        waitingSince: row.created_at,
        expiresAt: row.expires_at,
        suggestedStake: 0,
      };
    });
    const opponents = [...demoPlayers(), ...people].filter(
      (p) =>
        compatible(profile, p, p.settlements) &&
        compatible(p, profile, store.stats(profile.id, false).settlements) &&
        (p.demo || !store.active(p.id)) &&
        chooseStake(profile, p) <= profile.preferences.sessionLimit - store.losses(profile.id) &&
        (p.demo || chooseStake(profile, p) <= p.preferences.sessionLimit - store.losses(p.id)),
    );
    for (const p of opponents) p.suggestedStake = chooseStake(profile, p);
    const queue = store.queued(profile.id);
    res.json({
      opponents: sortOpponents(profile, opponents),
      queued: !!queue,
      expiresAt: queue?.expires_at ?? null,
    });
  });
  app.post('/api/queue', (_req, res) => {
    const profile: Profile = res.locals.profile;
    assert(!store.active(profile.id), 'You already have a match in progress.', 409);
    assert(
      store.losses(profile.id) + profile.preferences.minStake <= profile.preferences.sessionLimit,
      'You have reached your daily practice loss limit.',
    );
    const now = Date.now();
    store.db
      .prepare(
        'INSERT INTO queue VALUES (?,?,?) ON CONFLICT(player_id) DO UPDATE SET expires_at=excluded.expires_at',
      )
      .run(profile.id, now, now + 15 * 60_000);
    res.json({ queued: true });
  });
  app.delete('/api/queue', (_req, res) => {
    store.leave(res.locals.profile.id);
    res.json({ queued: false });
  });
  app.post('/api/matches', (req, res) => {
    const { opponentId } = z
      .object({ opponentId: z.string().max(64) })
      .strict()
      .parse(req.body);
    const profile: Profile = res.locals.profile;
    assert(!store.active(profile.id), 'Finish your current match first.', 409);
    const example = demoPlayers().find((p) => p.id === opponentId);
    const opponent = example ?? store.profile(opponentId);
    assert(
      opponent && (example || store.queued(opponentId)),
      'This player is no longer available.',
      404,
    );
    assert(
      profile.name.normalize('NFKC').toLowerCase() !==
        opponent.name.normalize('NFKC').toLowerCase(),
      'Choose distinct character names before matching.',
    );
    assert(example || !store.active(opponentId), 'This player just joined another match.', 409);
    assert(
      compatible(
        profile,
        opponent,
        example?.settlements ?? store.stats(opponentId, false).settlements,
      ) && compatible(opponent, profile, store.stats(profile.id, false).settlements),
      'Your matchmaking preferences do not overlap.',
    );
    const stake = chooseStake(profile, opponent);
    assert(
      stake + store.losses(profile.id) <= profile.preferences.sessionLimit,
      'This stake would exceed your remaining daily limit.',
    );
    assert(
      example || stake + store.losses(opponentId) <= opponent.preferences.sessionLimit,
      'This stake would exceed your opponent’s remaining daily limit.',
    );
    const now = Date.now();
    const match: Match = {
      id: randomUUID(),
      players: [profile, opponent],
      demo: !!example,
      mode: 'practice',
      stake,
      start: 1000,
      zone: profile.zone,
      phase: example ? 'ready' : 'invited',
      ready: [],
      firstPlayerId: '',
      turn: '',
      rolls: [],
      loserId: null,
      confirmations: [],
      createdAt: now,
      updatedAt: now,
    };
    match.firstPlayerId = match.players[randomInt(0, 2)].id;
    match.turn = match.firstPlayerId;
    store.saveMatch(match);
    store.leave(profile.id);
    store.leave(opponentId);
    res.status(201).json({ match });
  });
  app.get('/api/history', (_req, res) =>
    res.json({
      matches: store
        .matches(res.locals.profile.id)
        .filter((m) => !['invited', 'ready', 'playing', 'settlement'].includes(m.phase))
        .slice(0, 100),
    }),
  );
  app.get('/api/matches/:id', (req, res) =>
    res.json({ match: memberMatch(req.params.id, res.locals.profile.id, store) }),
  );
  app.get('/api/matches/:id/ticket', (req, res) =>
    res.json({ ticket: ticketFor(memberMatch(req.params.id, res.locals.profile.id, store)) }),
  );
  app.post('/api/matches/:id/:action', (req, res) => {
    const profile: Profile = res.locals.profile;
    const match = memberMatch(req.params.id, profile.id, store);
    const action = req.params.action;
    if (action === 'accept') {
      assert(
        match.phase === 'invited' && match.players[1].id === profile.id,
        'This invitation cannot be accepted.',
      );
      match.phase = 'ready';
    } else if (action === 'cancel') {
      assert(
        ['invited', 'ready'].includes(match.phase),
        'A started match cannot be cancelled. Record a dispute if it cannot continue.',
      );
      match.phase = 'cancelled';
    } else if (action === 'ready') {
      assert(match.phase === 'ready', 'This match is not waiting for readiness.');
      if (!match.ready.includes(profile.id)) match.ready.push(profile.id);
      if (match.demo && !match.ready.includes(match.players[1].id))
        match.ready.push(match.players[1].id);
      if (match.ready.length === 2) {
        match.phase = 'playing';
        advanceDemo(match);
      }
    } else if (action === 'roll') {
      addRoll(match, profile.id);
      advanceDemo(match);
    } else if (action === 'confirm') {
      assert(match.phase === 'settlement', 'This match is not awaiting settlement.');
      if (!match.confirmations.includes(profile.id)) match.confirmations.push(profile.id);
      if (match.confirmations.length === 2) match.phase = 'settled';
    } else if (action === 'dispute') {
      assert(
        ['playing', 'settlement'].includes(match.phase),
        'Only an active or unsettled match can be disputed.',
      );
      const { reason } = z
        .object({ reason: z.string().trim().min(10).max(500) })
        .strict()
        .parse(req.body);
      match.phase = 'disputed';
      match.disputeReason = reason;
    } else if (action === 'receipt') {
      const { receipt } = z
        .object({ receipt: z.string().max(1000) })
        .strict()
        .parse(req.body);
      const parsed = parseReceipt(receipt);
      assert(parsed.id === match.id, 'This receipt belongs to a different match.');
      match.receipt = {
        importedBy: profile.id,
        importedAt: Date.now(),
        outcome: parsed.outcome,
        evidence: 'client-supplied',
      };
    } else throw new AppError(404, 'Unknown match action.');
    match.updatedAt = Date.now();
    store.saveMatch(match);
    res.json({ match });
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'This endpoint does not exist.' }));
  const staticDir = resolve(options.staticDir ?? 'dist');
  if (existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(staticDir, 'index.html')));
  }
  app.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (error instanceof ZodError)
        return res.status(400).json({ error: error.issues[0]?.message ?? 'Check your input.' });
      if (error instanceof AppError) return res.status(error.status).json({ error: error.message });
      if (error instanceof SyntaxError)
        return res.status(400).json({ error: 'The request contains invalid JSON.' });
      console.error('Request failed:', error instanceof Error ? error.message : 'unknown error');
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    },
  );
  return { app, store };
}
function cookieToken(header?: string) {
  return header
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith('lr_session='))
    ?.slice('lr_session='.length);
}
function memberMatch(id: string, playerId: string, store: Store): Match {
  const match = store.match(id);
  assert(match && match.players.some((p) => p.id === playerId), 'Match not found.', 404);
  return match;
}
