import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ACTIVE_PHASES, DEFAULT_PREFERENCES, type Match, type Profile } from '../shared/types.js';

export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES profiles(id), expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS queue (player_id TEXT PRIMARY KEY REFERENCES profiles(id), created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, p1 TEXT NOT NULL, p2 TEXT NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS matches_p1 ON matches(p1);
      CREATE INDEX IF NOT EXISTS matches_p2 ON matches(p2);`);
  }
  profile(id: string): Profile | null {
    const row = this.db.prepare('SELECT data FROM profiles WHERE id=?').get(id) as
      { data: string } | undefined;
    return row ? JSON.parse(row.data) : null;
  }
  saveProfile(profile: Profile) {
    this.db
      .prepare('INSERT INTO profiles VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data')
      .run(profile.id, JSON.stringify(profile));
  }
  createProfile(): Profile {
    const id = randomUUID();
    const profile: Profile = {
      id,
      name: `Wanderer ${id.slice(0, 4)}`,
      className: 'Rogue',
      region: 'US',
      ruleset: 'Normal',
      faction: 'Alliance',
      zone: 'Stormwind',
      preferences: { ...DEFAULT_PREFERENCES },
    };
    this.saveProfile(profile);
    return profile;
  }
  match(id: string): Match | null {
    const row = this.db.prepare('SELECT data FROM matches WHERE id=?').get(id) as
      { data: string } | undefined;
    return row ? JSON.parse(row.data) : null;
  }
  matches(id: string): Match[] {
    const rows = this.db
      .prepare('SELECT data FROM matches WHERE p1=? OR p2=? ORDER BY rowid DESC')
      .all(id, id) as { data: string }[];
    return rows.map((row) => JSON.parse(row.data));
  }
  saveMatch(match: Match) {
    this.db
      .prepare(
        'INSERT INTO matches VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
      )
      .run(match.id, ...match.players.map((p) => p.id), JSON.stringify(match));
  }
  active(id: string): Match | null {
    return this.matches(id).find((match) => ACTIVE_PHASES.includes(match.phase)) ?? null;
  }
  losses(id: string): number {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return this.matches(id)
      .filter((m) => m.createdAt >= +today && m.loserId === id)
      .reduce((sum, m) => sum + m.stake, 0);
  }
  stats(id: string, includeDemo = true) {
    const matches = this.matches(id).filter((m) => includeDemo || !m.demo);
    const settled = matches.filter((m) => m.phase === 'settled');
    return {
      matches: matches.filter((m) => m.loserId).length,
      settlements: settled.length,
      distinctOpponents: new Set(settled.map((m) => m.players.find((p) => p.id !== id)!.id)).size,
    };
  }
  queued(id: string): { created_at: number; expires_at: number } | undefined {
    return this.db
      .prepare('SELECT created_at, expires_at FROM queue WHERE player_id=? AND expires_at>?')
      .get(id, Date.now()) as { created_at: number; expires_at: number } | undefined;
  }
  leave(id: string) {
    this.db.prepare('DELETE FROM queue WHERE player_id=?').run(id);
  }
  expireInvitations() {
    const cutoff = Date.now() - 5 * 60_000;
    const rows = this.db.prepare('SELECT data FROM matches').all() as { data: string }[];
    for (const row of rows) {
      const match: Match = JSON.parse(row.data);
      if (['invited', 'ready'].includes(match.phase) && match.updatedAt < cutoff) {
        match.phase = 'cancelled';
        match.updatedAt = Date.now();
        this.saveMatch(match);
      }
    }
  }
}
