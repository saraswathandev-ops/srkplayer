# Agent Notes (SKR Player)

This repo is a bare React Native Android app (offline video/audio player).

## Build / Run Commands

- Install deps: `npm ci`
- Metro bundler: `npm run start`
- Run Android (debug): `npm run android`

### APK / Release

- Debug APK: `npm run apk`
- Clean Android build: `npm run apk:clean`
- Install debug APK to device: `npm run apk:install`
- Assemble release (no install): `npm run build:android`
- Assemble + install + launch release: `npm run apk:release`

## Test / Check Commands

There are no unit tests configured in this repo.

- Typecheck: `npm run typecheck`
- Lint: `npm run lint`

## Style / Code Rules

- Prefer TypeScript (`.ts`/`.tsx`) types over `any`; keep types local and minimal.
- Keep changes focused; avoid drive-by refactors and whitespace-only formatting.
- Match existing React Native patterns in the touched file (hooks/state naming, styling approach).
- Prefer `rg` for search and keep file reads targeted.

## Do Not Touch (Unless Explicitly Asked)

- `node_modules/`
- `dist/`
- `.expo/`, `.gradle/`, `android/.gradle/`
- Android build outputs: `android/app/build/`, `android/build/`
- Generated artifacts produced by build scripts (for example icon outputs from `npm run generate:icons`)

