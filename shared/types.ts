export const REGIONS = ['US', 'EU'] as const;
export const RULESETS = ['Normal', 'PvP', 'Hardcore'] as const;
export const FACTIONS = ['Alliance', 'Horde'] as const;
export const CLASSES = [
  'Warrior',
  'Paladin',
  'Hunter',
  'Rogue',
  'Priest',
  'Shaman',
  'Mage',
  'Warlock',
  'Druid',
] as const;
export const ZONES = [
  'Stormwind',
  'Ironforge',
  'Darnassus',
  'Orgrimmar',
  'Thunder Bluff',
  'Undercity',
  'Booty Bay',
] as const;

export interface Preferences {
  minStake: number;
  maxStake: number;
  preferredStake: number;
  sessionLimit: number;
  establishedOnly: boolean;
}
export interface Profile {
  id: string;
  name: string;
  className: (typeof CLASSES)[number];
  region: (typeof REGIONS)[number];
  ruleset: (typeof RULESETS)[number];
  faction: (typeof FACTIONS)[number];
  zone: (typeof ZONES)[number];
  preferences: Preferences;
}
export interface Opponent extends Profile {
  demo: boolean;
  settlements: number;
  distinctOpponents: number;
  waitingSince: number;
  expiresAt: number;
  suggestedStake: number;
}
export type Phase =
  'invited' | 'ready' | 'playing' | 'settlement' | 'settled' | 'disputed' | 'cancelled';
export interface Roll {
  playerId: string;
  max: number;
  value: number;
  at: number;
}
export interface Match {
  id: string;
  players: [Profile, Profile];
  demo: boolean;
  mode: 'practice';
  stake: number;
  start: number;
  zone: string;
  phase: Phase;
  ready: string[];
  firstPlayerId: string;
  turn: string;
  rolls: Roll[];
  loserId: string | null;
  confirmations: string[];
  createdAt: number;
  updatedAt: number;
  disputeReason?: string;
  receipt?: {
    importedBy: string;
    importedAt: number;
    outcome: string;
    evidence: 'client-supplied';
  };
}
export interface SessionData {
  profile: Profile;
  activeMatch: Match | null;
  queued: boolean;
  losses: number;
  stats: { matches: number; settlements: number; distinctOpponents: number };
}
export interface LobbyData {
  opponents: Opponent[];
  queued: boolean;
  expiresAt: number | null;
}

export const DEFAULT_PREFERENCES: Preferences = {
  minStake: 10,
  maxStake: 50,
  preferredStake: 25,
  sessionLimit: 100,
  establishedOnly: false,
};
export const ACTIVE_PHASES: Phase[] = ['invited', 'ready', 'playing', 'settlement'];
