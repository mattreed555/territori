export const STRATEGIES = {
  Aggressive: 'Create local numerical advantages. Threaten captures and pressure contested territory.',
  Cautious: 'Reinforce threatened stones. Keep friendly neighbors at least equal to enemy neighbors around your stones. Prefer stable territory.',
  Expansive: 'Claim open space efficiently. Establish new footholds without giving away easy captures.',
  Fluid: 'Shift to escape threats, reinforce allies, or create capture opportunities.',
  Balanced: 'Weigh lasting territory, stone safety, and useful captures. Adapt to the position.'
} as const;
export type Strategy = keyof typeof STRATEGIES;
export type Player = 'Human' | Strategy;
export const PLAYERS = ['Human', ...Object.keys(STRATEGIES)] as Player[];
