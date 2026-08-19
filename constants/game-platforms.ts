export type GamePlatform = {
  iconPlatform: string;
  id: string;
  label: string;
  platformIds: readonly number[];
  translationKey?: string;
};

export type GamePlatformSection = {
  data: readonly GamePlatform[];
  title: string;
};

export const FEATURED_GAME_PLATFORMS: readonly GamePlatform[] = [
  {
    id: "playstation",
    label: "PlayStation",
    iconPlatform: "PlayStation 5",
    platformIds: [167, 48, 9, 8, 7, 38, 46],
  },
  {
    id: "xbox",
    label: "Xbox",
    iconPlatform: "Xbox Series X|S",
    platformIds: [169, 49, 12, 11],
  },
  {
    id: "pc",
    label: "PC",
    iconPlatform: "PC (Microsoft Windows)",
    platformIds: [6, 14, 3, 92],
  },
  {
    id: "nintendo",
    label: "Nintendo",
    iconPlatform: "Nintendo Switch",
    platformIds: [130, 41, 5, 21, 4, 37, 20, 24, 22, 33, 19, 18],
  },
  {
    id: "mobile",
    label: "Mobile",
    translationKey: "Mobile",
    iconPlatform: "iOS",
    platformIds: [39, 34],
  },
  {
    id: "retro",
    label: "Retro",
    translationKey: "Retro",
    iconPlatform: "Nintendo Entertainment System",
    platformIds: [4, 18, 19, 22, 24, 33, 29, 32, 23, 35, 59, 52, 16, 15, 50, 80],
  },
] as const;

export const GAME_PLATFORM_SECTIONS: readonly GamePlatformSection[] = [
  {
    title: "Popular",
    data: FEATURED_GAME_PLATFORMS,
  },
  {
    title: "PlayStation",
    data: [
      { id: "playstation-5", label: "PlayStation 5", iconPlatform: "PlayStation 5", platformIds: [167] },
      { id: "playstation-4", label: "PlayStation 4", iconPlatform: "PlayStation 4", platformIds: [48] },
      { id: "playstation-3", label: "PlayStation 3", iconPlatform: "PlayStation 3", platformIds: [9] },
      { id: "playstation-2", label: "PlayStation 2", iconPlatform: "PlayStation 2", platformIds: [8] },
      { id: "playstation-original", label: "PlayStation", iconPlatform: "PlayStation", platformIds: [7] },
      { id: "playstation-portable", label: "PSP", iconPlatform: "PlayStation Portable", platformIds: [38] },
      { id: "playstation-vita", label: "PlayStation Vita", iconPlatform: "PlayStation Vita", platformIds: [46] },
    ],
  },
  {
    title: "Xbox",
    data: [
      { id: "xbox-series", label: "Xbox Series X|S", iconPlatform: "Xbox Series X|S", platformIds: [169] },
      { id: "xbox-one", label: "Xbox One", iconPlatform: "Xbox One", platformIds: [49] },
      { id: "xbox-360", label: "Xbox 360", iconPlatform: "Xbox 360", platformIds: [12] },
      { id: "xbox-original", label: "Xbox", iconPlatform: "Xbox", platformIds: [11] },
    ],
  },
  {
    title: "Nintendo",
    data: [
      { id: "nintendo-switch", label: "Nintendo Switch", iconPlatform: "Nintendo Switch", platformIds: [130] },
      { id: "nintendo-wii-u", label: "Wii U", iconPlatform: "Nintendo Wii U", platformIds: [41] },
      { id: "nintendo-wii", label: "Wii", iconPlatform: "Nintendo Wii", platformIds: [5] },
      { id: "nintendo-gamecube", label: "GameCube", iconPlatform: "Nintendo GameCube", platformIds: [21] },
      { id: "nintendo-64", label: "Nintendo 64", iconPlatform: "Nintendo 64", platformIds: [4] },
      { id: "nintendo-3ds", label: "Nintendo 3DS", iconPlatform: "Nintendo 3DS", platformIds: [37] },
      { id: "nintendo-ds", label: "Nintendo DS", iconPlatform: "Nintendo DS", platformIds: [20] },
      { id: "game-boy-advance", label: "Game Boy Advance", iconPlatform: "Game Boy Advance", platformIds: [24] },
      { id: "game-boy-color", label: "Game Boy Color", iconPlatform: "Game Boy Color", platformIds: [22] },
      { id: "game-boy", label: "Game Boy", iconPlatform: "Game Boy", platformIds: [33] },
      { id: "super-nintendo", label: "Super Nintendo", iconPlatform: "Super Nintendo Entertainment System", platformIds: [19] },
      { id: "nintendo-entertainment-system", label: "NES", iconPlatform: "Nintendo Entertainment System", platformIds: [18] },
    ],
  },
  {
    title: "PC & Mobile",
    data: [
      { id: "windows", label: "Windows", iconPlatform: "PC (Microsoft Windows)", platformIds: [6] },
      { id: "mac", label: "macOS", iconPlatform: "Mac", platformIds: [14] },
      { id: "linux", label: "Linux", iconPlatform: "Linux", platformIds: [3] },
      { id: "steamos", label: "SteamOS", iconPlatform: "SteamOS", platformIds: [92] },
      { id: "ios", label: "iOS", iconPlatform: "iOS", platformIds: [39] },
      { id: "android", label: "Android", iconPlatform: "Android", platformIds: [34] },
      { id: "web-browser", label: "Web browser", translationKey: "Web browser", iconPlatform: "Web browser", platformIds: [82] },
    ],
  },
  {
    title: "Sega & Retro",
    data: [
      { id: "dreamcast", label: "Dreamcast", iconPlatform: "Sega Dreamcast", platformIds: [23] },
      { id: "sega-saturn", label: "Sega Saturn", iconPlatform: "Sega Saturn", platformIds: [32] },
      { id: "sega-genesis", label: "Genesis / Mega Drive", iconPlatform: "Sega Genesis", platformIds: [29] },
      { id: "sega-cd", label: "Sega CD", iconPlatform: "Sega CD", platformIds: [78] },
      { id: "sega-32x", label: "Sega 32X", iconPlatform: "Sega 32X", platformIds: [30] },
      { id: "game-gear", label: "Game Gear", iconPlatform: "Sega Game Gear", platformIds: [35] },
      { id: "atari-2600", label: "Atari 2600", iconPlatform: "Atari 2600", platformIds: [59] },
      { id: "atari-7800", label: "Atari 7800", iconPlatform: "Atari 7800", platformIds: [60] },
      { id: "arcade", label: "Arcade", iconPlatform: "Arcade", platformIds: [52] },
      { id: "neo-geo", label: "Neo Geo AES", iconPlatform: "Neo Geo AES", platformIds: [80] },
      { id: "3do", label: "3DO", iconPlatform: "3DO", platformIds: [50] },
      { id: "amiga", label: "Amiga", iconPlatform: "Amiga", platformIds: [16] },
      { id: "commodore-64", label: "Commodore 64", iconPlatform: "Commodore 64", platformIds: [15] },
    ],
  },
] as const;

const allPlatforms = GAME_PLATFORM_SECTIONS.flatMap((section) => section.data);

export function getGamePlatform(id: string) {
  return allPlatforms.find((platform) => platform.id === id) ?? null;
}
