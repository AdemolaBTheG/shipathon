# Joylogue Expo Guidelines

Read the exact Expo SDK 57 docs at https://docs.expo.dev/versions/v57.0.0/ before writing Expo code.

## Project Direction

- This is Joylogue, a local-first gaming backlog app built with Expo Router and TypeScript.
- Preserve the dark, cinematic, editorial visual direction. Avoid generic neon gamer UI.
- Routes belong in `app/`. Keep shared components, data access, and types outside `app/`.
- Use kebab-case filenames.

## Navigation And UI

- Use Expo Router layouts and typed route boundaries.
- Use `expo-symbols` for icons. Do not add another icon system.
- Use `expo-image` for remote game cover art.
- Use `react-native-reanimated` for meaningful transitions, not decorative animation everywhere.
- Account for safe areas with Expo Router headers, tabs, or `react-native-safe-area-context`.
- Prefer responsive `ScrollView`, `FlatList`, or `SectionList` layouts over fixed screen dimensions.

## Data And APIs

- SQLite is the local source of truth for guest users. Use `expo-sqlite` with Drizzle ORM.
- Do not introduce MMKV as a second database for the same game data.
- Supabase is reserved for cloud sync, auth, friends, public profiles, and realtime activity.
- IGDB credentials must stay server-side. Use an Expo Router API route under `app/api/` as the IGDB proxy.
- API routes are deployed through EAS Hosting. Use Web APIs in routes; do not rely on filesystem or native Node modules.
- Never expose secrets through `EXPO_PUBLIC_*` variables.
- Local secrets belong in `.env.local`; production secrets belong in EAS environment variables.

## Widgets And Native Builds

- `expo-widgets` is iOS-only and requires a development/native build; it will not run in Expo Go.
- Use Expo Go for ordinary app iteration when possible.
- Use an EAS development build when testing widgets or other native-only modules.
- Do not run `expo prebuild --clean` or generate `ios/` and `android/` folders without first checking existing native changes.

## Verification

Before handing off meaningful changes, run:

```bash
npx tsc --noEmit
npx expo-doctor
```
