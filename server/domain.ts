import { randomInt } from 'node:crypto';
import type { Match, Opponent, Profile } from '../shared/types.js';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function assert(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new AppError(status, message);
}
export function compatible(a: Profile, b: Profile, settlements = 0): boolean {
  return (
    a.id !== b.id &&
    a.region === b.region &&
    a.ruleset === b.ruleset &&
    a.faction === b.faction &&
    Math.max(a.preferences.minStake, b.preferences.minStake) <=
      Math.min(a.preferences.maxStake, b.preferences.maxStake) &&
    (!a.preferences.establishedOnly || settlements >= 5)
  );
}
export function chooseStake(a: Profile, b: Profile): number {
  const lower = Math.max(a.preferences.minStake, b.preferences.minStake);
  const upper = Math.min(a.preferences.maxStake, b.preferences.maxStake);
  assert(lower <= upper, 'Your stake ranges no longer overlap.');
  return Math.max(
    lower,
    Math.min(upper, Math.round((a.preferences.preferredStake + b.preferences.preferredStake) / 2)),
  );
}
export function sortOpponents(profile: Profile, players: Opponent[]): Opponent[] {
  return players.sort(
    (a, b) =>
      Number(b.zone === profile.zone) - Number(a.zone === profile.zone) ||
      Math.abs(a.suggestedStake - profile.preferences.preferredStake) -
        Math.abs(b.suggestedStake - profile.preferences.preferredStake) ||
      a.waitingSince - b.waitingSince,
  );
}
export function otherPlayer(match: Match, id: string): Profile {
  return match.players.find((p) => p.id !== id)!;
}
export function addRoll(
  match: Match,
  playerId: string,
  rng: (min: number, max: number) => number = randomInt,
): void {
  assert(match.phase === 'playing', 'This match is not accepting rolls.');
  assert(match.turn === playerId, 'Wait for your opponent to roll.');
  const max = match.rolls.at(-1)?.value ?? match.start;
  const value = rng(1, max + 1);
  match.rolls.push({ playerId, max, value, at: Date.now() });
  if (value === 1) {
    match.loserId = playerId;
    match.phase = 'settlement';
    if (match.demo) match.confirmations = [match.players[1].id];
  } else match.turn = otherPlayer(match, playerId).id;
  match.updatedAt = Date.now();
}
export function advanceDemo(match: Match): void {
  if (match.demo && match.phase === 'playing' && match.turn === match.players[1].id)
    addRoll(match, match.turn);
}
export function ticketFor(match: Match): string {
  const hex = (value: string) => Buffer.from(value, 'utf8').toString('hex');
  return [
    'RK1',
    match.id,
    'practice',
    match.players[0].region,
    match.players[0].ruleset,
    match.players[0].faction,
    match.stake,
    match.start,
    match.firstPlayerId === match.players[0].id ? '1' : '2',
    hex(match.players[0].name),
    hex(match.players[1].name),
    hex(match.zone),
    Math.floor(match.createdAt / 1000),
  ].join('|');
}
export function parseReceipt(input: string): { id: string; outcome: string } {
  const fields = input.trim().split('|');
  assert(
    fields.length === 5 && fields[0] === 'RKR1' && fields[2] === 'practice',
    'That is not a Rollkeeper practice receipt.',
  );
  assert(/^[a-f0-9-]{36}$/.test(fields[1]), 'Invalid match identifier.');
  assert(['player1', 'player2', 'unknown'].includes(fields[3]), 'Invalid receipt outcome.');
  assert(/^\d{1,10}$/.test(fields[4]), 'Invalid receipt timestamp.');
  return { id: fields[1], outcome: fields[3] };
}
