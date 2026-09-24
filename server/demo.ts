import { DEFAULT_PREFERENCES, type Opponent } from '../shared/types.js';

// Fictional practice partners. Their history is illustrative and never enters real-player reputation.
const examples = [
  ['demo-aldric', 'Aldric Ashford', 'Paladin', 'Stormwind', 10, 50, 25, 42, 18],
  ['demo-elara', 'Elara Moonwell', 'Druid', 'Stormwind', 5, 25, 15, 28, 14],
  ['demo-finn', 'Finn Copperpot', 'Rogue', 'Booty Bay', 20, 100, 50, 63, 31],
  ['demo-brom', 'Brom Ironhand', 'Warrior', 'Ironforge', 10, 50, 25, 17, 9],
  ['demo-lyra', 'Lyra Frostweave', 'Mage', 'Stormwind', 1, 10, 5, 8, 6],
  ['demo-thorne', 'Thorne Blackwood', 'Hunter', 'Darnassus', 50, 200, 100, 35, 20],
] as const;
export function demoPlayers(): Opponent[] {
  return examples.map(
    (
      [
        id,
        name,
        className,
        zone,
        minStake,
        maxStake,
        preferredStake,
        settlements,
        distinctOpponents,
      ],
      index,
    ) => ({
      id,
      name,
      className,
      zone,
      region: 'US',
      ruleset: 'Normal',
      faction: 'Alliance',
      demo: true,
      preferences: {
        ...DEFAULT_PREFERENCES,
        minStake,
        maxStake,
        preferredStake,
        sessionLimit: 1000,
      },
      settlements,
      distinctOpponents,
      waitingSince: Date.now() - (6 - index) * 60_000,
      expiresAt: Date.now() + 15 * 60_000,
      suggestedStake: preferredStake,
    }),
  );
}
