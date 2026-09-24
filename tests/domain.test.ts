import test from 'node:test';
import assert from 'node:assert/strict';
import { addRoll, chooseStake, compatible, parseReceipt, ticketFor } from '../server/domain';
import { DEFAULT_PREFERENCES, type Match, type Profile } from '../shared/types';

const a: Profile = {
  id: 'a',
  name: 'Aldric Ashford',
  className: 'Paladin',
  region: 'US',
  ruleset: 'Normal',
  faction: 'Alliance',
  zone: 'Stormwind',
  preferences: { ...DEFAULT_PREFERENCES },
};
const b: Profile = {
  ...a,
  id: 'b',
  name: 'Elara Moonwell',
  preferences: { ...DEFAULT_PREFERENCES, minStake: 30, maxStake: 100, preferredStake: 75 },
};
const game = (): Match => ({
  id: '00000000-0000-4000-8000-000000000000',
  players: [a, b],
  phase: 'playing',
  demo: false,
  mode: 'practice',
  stake: 50,
  start: 1000,
  zone: 'Stormwind',
  ready: ['a', 'b'],
  firstPlayerId: 'a',
  turn: 'a',
  rolls: [],
  loserId: null,
  confirmations: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

test('compatibility requires region, ruleset, faction, and overlapping stakes', () => {
  assert.equal(compatible(a, b), true);
  for (const override of [
    { region: 'EU' },
    { faction: 'Horde' },
    { ruleset: 'Hardcore' },
    { id: 'a' },
  ])
    assert.equal(compatible(a, { ...b, ...override } as Profile), false);
  assert.equal(compatible(a, { ...b, preferences: { ...b.preferences, minStake: 51 } }), false);
  assert.equal(
    compatible({ ...a, preferences: { ...a.preferences, establishedOnly: true } }, b, 4),
    false,
  );
  assert.equal(
    compatible({ ...a, preferences: { ...a.preferences, establishedOnly: true } }, b, 5),
    true,
  );
});
test('stake always remains inside both players’ bounds', () => {
  assert.equal(chooseStake(a, b), 50);
  assert.equal(
    chooseStake(a, { ...b, preferences: { ...b.preferences, minStake: 50, preferredStake: 100 } }),
    50,
  );
  assert.throws(() => chooseStake(a, { ...b, preferences: { ...b.preferences, minStake: 51 } }));
});
test('only the next player may roll, range decreases, and one ends the game', () => {
  const match = game();
  assert.throws(() => addRoll(match, 'b'));
  addRoll(match, 'a', () => 19);
  assert.equal(match.turn, 'b');
  addRoll(match, 'b', (low, upper) => {
    assert.equal(low, 1);
    assert.equal(upper, 20);
    return 1;
  });
  assert.equal(match.loserId, 'b');
  assert.equal(match.phase, 'settlement');
  assert.throws(() => addRoll(match, 'a'));
});
test('tickets preserve non-ASCII names without executable Lua or ambiguous separators', () => {
  const match = game();
  match.players[0] = { ...a, name: 'Élara Moonwell' };
  const fields = ticketFor(match).split('|');
  assert.equal(fields.length, 13);
  assert.equal(fields[2], 'practice');
  assert.equal(Buffer.from(fields[9], 'hex').toString('utf8'), 'Élara Moonwell');
});
test('receipt parser rejects real-value modes and malformed data', () => {
  const id = game().id;
  assert.deepEqual(parseReceipt(`RKR1|${id}|practice|player1|1800000000`), {
    id,
    outcome: 'player1',
  });
  for (const value of [
    'hello',
    `RKR1|${id}|gold|player1|1800000000`,
    `RKR1|${id}|practice|player3|1800000000`,
    `RKR1|${id}|practice|player1|nope`,
  ])
    assert.throws(() => parseReceipt(value));
});
