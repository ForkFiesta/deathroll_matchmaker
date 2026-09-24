import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
import { Store } from '../server/store';
import type { Match, Profile } from '../shared/types';

type Agent = ReturnType<typeof request.agent>;
const post = (agent: Agent, path: string, body = {}) =>
  agent.post(`/api${path}`).set('X-Last-Roll', '1').send(body);
async function session(app: ReturnType<typeof createApp>['app']) {
  const agent = request.agent(app);
  const response = await post(agent, '/session');
  assert.equal(response.status, 201);
  return { agent, profile: response.body.profile as Profile, response };
}
async function update(agent: Agent, profile: Profile, patch: Partial<Profile>) {
  const { id: _id, ...body } = { ...profile, ...patch };
  return agent.put('/api/profile').set('X-Last-Roll', '1').send(body);
}
function setup(t: TestContext) {
  const result = createApp({ database: ':memory:', testing: true, staticDir: '/not-a-directory' });
  t.after(() => result.store.db.close());
  return result;
}

test('guest session uses an HttpOnly cookie and stores only its hash', async (t) => {
  const { app, store } = setup(t);
  const { agent, profile, response } = await session(app);
  const cookie = response.headers['set-cookie'][0];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  const token = cookie.split(';')[0].split('=')[1];
  assert.equal(store.db.prepare('SELECT token FROM sessions WHERE token=?').get(token), undefined);
  assert.equal((await post(agent, '/session')).body.profile.id, profile.id);
  assert.equal((await request(app).get('/api/me')).status, 401);
});
test('mutation requests enforce request header and same origin', async (t) => {
  const { app } = setup(t);
  const { agent } = await session(app);
  assert.equal((await agent.post('/api/queue').send({})).status, 403);
  assert.equal((await post(agent, '/queue').set('Origin', 'https://attacker.example')).status, 403);
  assert.equal((await post(agent, '/queue')).status, 200);
});
test('profile validation rejects invalid limits and executable-looking names', async (t) => {
  const { app } = setup(t);
  const { agent, profile } = await session(app);
  assert.equal((await update(agent, profile, { name: '<script>alert(1)</script>' })).status, 400);
  assert.equal(
    (
      await update(agent, profile, {
        preferences: { ...profile.preferences, minStake: 51, maxStake: 50 },
      })
    ).status,
    400,
  );
  assert.equal(
    (await update(agent, profile, { preferences: { ...profile.preferences, preferredStake: 80 } }))
      .status,
    400,
  );
  assert.equal((await update(agent, profile, { name: 'Élara Moonwell' })).status, 200);
});
test('a sample match completes, persists rolls, and settles explicitly', async (t) => {
  const { app, store } = setup(t);
  const { agent, profile } = await session(app);
  const created = await post(agent, '/matches', { opponentId: 'demo-aldric' });
  assert.equal(created.status, 201);
  let match: Match = created.body.match;
  assert.equal(match.stake, 25);
  assert.equal(match.mode, 'practice');
  assert.equal((await update(agent, profile, { name: 'Changed Name' })).status, 409);
  match = (await post(agent, `/matches/${match.id}/ready`)).body.match;
  let safety = 0;
  while (match.phase === 'playing' && safety++ < 300) {
    const response = await post(agent, `/matches/${match.id}/roll`);
    assert.equal(response.status, 200);
    match = response.body.match;
  }
  assert.equal(match.phase, 'settlement');
  assert.equal(match.rolls.at(-1)!.value, 1);
  assert.equal(store.match(match.id)!.rolls.length, match.rolls.length);
  assert.equal((await post(agent, `/matches/${match.id}/roll`)).status, 400);
  const receipt = `RKR1|${match.id}|practice|player1|1800000000`;
  const attached = await post(agent, `/matches/${match.id}/receipt`, { receipt });
  assert.equal(attached.status, 200);
  assert.equal(attached.body.match.phase, 'settlement');
  assert.equal(attached.body.match.loserId, match.loserId);
  assert.equal(attached.body.match.receipt.evidence, 'client-supplied');
  const confirmation = await post(agent, `/matches/${match.id}/confirm`);
  assert.equal(confirmation.body.match.phase, 'settled');
  assert.equal((await agent.get('/api/history')).body.matches.length, 1);
  assert.equal((await agent.get('/api/me')).body.activeMatch, null);
  assert.equal(
    store.stats(profile.id, false).settlements,
    0,
    'Sample matches must never improve community reputation',
  );
});
test('match details, tickets, actions, and receipts are private to participants', async (t) => {
  const { app } = setup(t);
  const owner = await session(app);
  const stranger = await session(app);
  const match: Match = (await post(owner.agent, '/matches', { opponentId: 'demo-elara' })).body
    .match;
  for (const path of [`/api/matches/${match.id}`, `/api/matches/${match.id}/ticket`])
    assert.equal((await stranger.agent.get(path)).status, 404);
  assert.equal((await post(stranger.agent, `/matches/${match.id}/cancel`)).status, 404);
  assert.equal(
    (
      await post(stranger.agent, `/matches/${match.id}/receipt`, {
        receipt: `RKR1|${match.id}|practice|player1|1800000000`,
      })
    ).status,
    404,
  );
  const wrongReceipt = 'RKR1|00000000-0000-4000-8000-000000000000|practice|player1|1800000000';
  assert.equal(
    (await post(owner.agent, `/matches/${match.id}/receipt`, { receipt: wrongReceipt })).status,
    400,
  );
});
test('community invitations require acceptance, mutual readiness, and correct turns', async (t) => {
  const { app } = setup(t);
  const a = await session(app);
  const b = await session(app);
  await post(b.agent, '/queue');
  const lobby = await a.agent.get('/api/lobby');
  assert.equal(lobby.body.opponents.filter((p: { demo: boolean }) => !p.demo).length, 1);
  const created = await post(a.agent, '/matches', { opponentId: b.profile.id });
  const id = created.body.match.id;
  assert.equal(created.body.match.phase, 'invited');
  assert.equal((await post(a.agent, `/matches/${id}/accept`)).status, 400);
  assert.equal((await post(a.agent, `/matches/${id}/roll`)).status, 400);
  assert.equal((await post(b.agent, `/matches/${id}/accept`)).body.match.phase, 'ready');
  assert.equal((await post(a.agent, `/matches/${id}/ready`)).body.match.phase, 'ready');
  const match: Match = (await post(b.agent, `/matches/${id}/ready`)).body.match;
  assert.equal(match.phase, 'playing');
  const wrong = match.turn === a.profile.id ? b : a;
  assert.equal((await post(wrong.agent, `/matches/${id}/roll`)).status, 400);
  assert.equal((await post(a.agent, `/matches/${id}/cancel`)).status, 400);
  const result = await post(a.agent, `/matches/${id}/dispute`, {
    reason: 'We disconnected during the practice game.',
  });
  assert.equal(result.body.match.phase, 'disputed');
  assert.equal((await a.agent.get('/api/me')).body.activeMatch, null);
});
test('community settlement requires both participants and cannot be confirmed twice', async (t) => {
  const { app, store } = setup(t);
  const a = await session(app);
  const b = await session(app);
  await post(b.agent, '/queue');
  const match: Match = (await post(a.agent, '/matches', { opponentId: b.profile.id })).body.match;
  match.phase = 'settlement';
  match.loserId = a.profile.id;
  store.saveMatch(match);
  assert.equal(
    (await post(a.agent, `/matches/${match.id}/confirm`)).body.match.phase,
    'settlement',
  );
  const repeated = await post(a.agent, `/matches/${match.id}/confirm`);
  assert.equal(repeated.body.match.confirmations.length, 1);
  assert.equal((await post(b.agent, `/matches/${match.id}/confirm`)).body.match.phase, 'settled');
});
test('expired queues and incompatible profiles cannot be challenged', async (t) => {
  const { app, store } = setup(t);
  const a = await session(app);
  const b = await session(app);
  await post(b.agent, '/queue');
  store.db.prepare('UPDATE queue SET expires_at=0').run();
  assert.equal((await post(a.agent, '/matches', { opponentId: b.profile.id })).status, 404);
  await update(b.agent, b.profile, { region: 'EU' });
  await post(b.agent, '/queue');
  assert.equal((await post(a.agent, '/matches', { opponentId: b.profile.id })).status, 400);
  assert.equal(
    (await post(a.agent, '/matches', { opponentId: 'demo-aldric', stake: 99999 })).status,
    400,
  );
});
test('simultaneous challenges reserve at most one match per player', async (t) => {
  const { app } = setup(t);
  const { agent } = await session(app);
  const results = await Promise.all([
    post(agent, '/matches', { opponentId: 'demo-aldric' }),
    post(agent, '/matches', { opponentId: 'demo-brom' }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
});
test('different sessions can independently use the same fictional partner', async (t) => {
  const { app } = setup(t);
  const a = await session(app);
  const b = await session(app);
  assert.equal((await post(a.agent, '/matches', { opponentId: 'demo-aldric' })).status, 201);
  assert.equal((await post(b.agent, '/matches', { opponentId: 'demo-aldric' })).status, 201);
});
test('daily loss limit counts unsettled results and expires only at UTC day boundary', async (t) => {
  const { app, store } = setup(t);
  const { agent, profile } = await session(app);
  const match: Match = (await post(agent, '/matches', { opponentId: 'demo-aldric' })).body.match;
  match.phase = 'disputed';
  match.loserId = profile.id;
  match.stake = 100;
  store.saveMatch(match);
  assert.equal((await post(agent, '/queue')).status, 400);
  assert.equal((await post(agent, '/matches', { opponentId: 'demo-aldric' })).status, 400);
  assert.equal((await agent.get('/api/lobby')).body.opponents.length, 0);
  match.createdAt = Date.now() - 86400_000;
  store.saveMatch(match);
  assert.equal((await post(agent, '/queue')).status, 200);
});
test('stale invitations expire and release the reservation', async (t) => {
  const { app, store } = setup(t);
  const { agent } = await session(app);
  const match: Match = (await post(agent, '/matches', { opponentId: 'demo-aldric' })).body.match;
  match.updatedAt = Date.now() - 6 * 60_000;
  store.saveMatch(match);
  assert.equal((await agent.get('/api/me')).body.activeMatch, null);
  assert.equal(store.match(match.id)!.phase, 'cancelled');
});
test('SQLite data survives reopening the application store', () => {
  const directory = mkdtempSync(join(tmpdir(), 'last-roll-test-'));
  const path = join(directory, 'test.db');
  try {
    const first = new Store(path);
    const profile = first.createProfile();
    first.db.close();
    const second = new Store(path);
    assert.equal(second.profile(profile.id)!.name, profile.name);
    second.db.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
