export const GAME_GENRES = [
  { id: 2, label: "Point-and-click", translationKey: "genre.point-and-click" },
  { id: 4, label: "Fighting", translationKey: "genre.fighting" },
  { id: 5, label: "Shooter", translationKey: "genre.shooter" },
  { id: 7, label: "Music", translationKey: "genre.music" },
  { id: 8, label: "Platform", translationKey: "genre.platform" },
  { id: 9, label: "Puzzle", translationKey: "genre.puzzle" },
  { id: 10, label: "Racing", translationKey: "genre.racing" },
  { id: 11, label: "Real Time Strategy (RTS)", translationKey: "genre.rts" },
  { id: 12, label: "Role-playing (RPG)", translationKey: "genre.rpg" },
  { id: 13, label: "Simulator", translationKey: "genre.simulator" },
  { id: 14, label: "Sport", translationKey: "genre.sport" },
  { id: 15, label: "Strategy", translationKey: "genre.strategy" },
  { id: 16, label: "Turn-based strategy (TBS)", translationKey: "genre.turn-based-strategy" },
  { id: 24, label: "Tactical", translationKey: "genre.tactical" },
  { id: 25, label: "Hack and slash/Beat 'em up", translationKey: "genre.hack-and-slash" },
  { id: 26, label: "Quiz/Trivia", translationKey: "genre.quiz-trivia" },
  { id: 30, label: "Pinball", translationKey: "genre.pinball" },
  { id: 31, label: "Adventure", translationKey: "genre.adventure" },
  { id: 32, label: "Indie", translationKey: "genre.indie" },
  { id: 33, label: "Arcade", translationKey: "genre.arcade" },
  { id: 34, label: "Visual Novel", translationKey: "genre.visual-novel" },
  { id: 35, label: "Card & Board Game", translationKey: "genre.card-board" },
  { id: 36, label: "MOBA", translationKey: "genre.moba" },
] as const;

export type GameGenre = (typeof GAME_GENRES)[number];

export function isGameGenreId(value: number) {
  return GAME_GENRES.some((genre) => genre.id === value);
}
