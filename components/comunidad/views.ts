/**
 * Internal navigation vocabulary for the mini-app. A single "active view"
 * identifies exactly one visible screen at any moment. Kept decoupled from
 * visual rules so styling/animation changes never touch navigation.
 */
export type GameView =
  | 'home'
  | 'onboarding'
  | 'daily'
  | 'daily-result'
  | 'streak'
  | 'quiz'
  | 'ranking'
  | 'challenges'
  | 'badges'
  | 'weekly-case';

export const GAME_VIEWS: GameView[] = [
  'home',
  'onboarding',
  'daily',
  'daily-result',
  'streak',
  'quiz',
  'ranking',
  'challenges',
  'badges',
  'weekly-case',
];

/** Views that are stubs for later slices (Req. 6.9 / 6.10). Slice 2 turned
 * ranking/challenges into real views; Slice 3 turned badges into a real view;
 * Slice 4 turned weekly-case into a real view. No stubs remain. */
export const STUB_VIEWS: GameView[] = [];

export function isGameView(value: string | null): value is GameView {
  return value !== null && (GAME_VIEWS as string[]).includes(value);
}
