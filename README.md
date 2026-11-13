# D8R Piano Academy

iPhone and iPad app for reading and playing D8R Piano Academy scores. The score is drawn by the website's OpenSheetMusicDisplay embed. The app plays the piano, the backing track, a MIDI keyboard, and an optional microphone.

Bundle id: `com.danijelbrecelj.playpianoacademymobile`. Expo owner: `danijelbrecelj`. This replaces the existing App Store app that uses the same bundle id.

## Setup

```bash
npm install
cp .env.example .env
npx expo start --dev-client
```

MIDI, the piano sampler, microphone, and RevenueCat need a development or store build. Expo Go does not include those native modules.

```bash
npx expo prebuild
npx expo run:ios
```

## Environment

All of these are public `EXPO_PUBLIC_` values. See `.env.example`.

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | Origin for the mobile API. Default `https://www.danijelbrecelj.com`. |
| `EXPO_PUBLIC_ASSET_BASE_URL` | CDN used when MusicXML, MIDI, or MP3 paths are relative. |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | RevenueCat public iOS SDK key. |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | RevenueCat public Android SDK key. |
| `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT` | Entitlement unlocked by the purchase. Default `d8r_piano_academy_pro`. |
| `EXPO_PUBLIC_REVENUECAT_OFFERING_ID` | Offering whose Lifetime package is purchased. Blank uses the current offering. |
| `EXPO_PUBLIC_REVENUECAT_PRODUCT_ID` | One-time store product bought when that offering has no Lifetime package. Default `d8r_piano_academy_pro`. |

`.env.example` and every `eas.json` build profile set `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT` and `EXPO_PUBLIC_REVENUECAT_PRODUCT_ID` to `d8r_piano_academy_pro`. The paywall buys the Lifetime package on the current RevenueCat offering, or on `EXPO_PUBLIC_REVENUECAT_OFFERING_ID` when that is set. If the offering or the Lifetime package is missing, it purchases the store product `d8r_piano_academy_pro` directly. That product is a non-consumable on the App Store and a one-time product on Google Play. RevenueCat attaches it to the `d8r_piano_academy_pro` entitlement. The paywall shows that package's store price. There is no monthly or yearly subscription.

In a dev build with empty RevenueCat keys, the paywall's unlock button marks the session as Pro so the 20-second gate can be tried. That shortcut does not exist in release builds, and the PDF endpoint still checks the real RevenueCat user.

## What you can do

- The library is dark. When the flow route is available, home opens on Flow: published sections, each with score tiles. Library (collections and the full piece list) stays on the same screen. Until that route is deployed, Flow stays hidden and home is the library.
- A score opens in the bright academy-studio theme. Portrait shows a full A4 page. Landscape on a phone zooms to the staff being played. Landscape on iPad zooms out enough to show several staves. Pinch zoom works only while playback is stopped.
- The seek bar stays on the score. Play and pause sit with it.
- The side panel has play mode, wait to play, the tempo sheet (55% to 100% of the written BPM), backing track, microphone, mic sensitivity, MIDI keyboard, PDF download, and the other pieces in the collection.
- Play mode sounds the written piano notes through the bundled sampler. Wait to play holds the score until any one of the expected notes is heard, from the on-screen keys, a MIDI keyboard, or the mic. It does not wait for a whole chord.
- iPad mic sensitivity starts higher, because that microphone barely picks up an acoustic piano. The slider is saved separately for phone and iPad.
- Premium pieces play for 20 seconds, then the paywall appears. Other pieces play through. PDF download is Pro only. Restore purchases is on the paywall.

## API

The app calls these routes on `EXPO_PUBLIC_API_BASE_URL`. The contract is `docs/mobile-academy-studio-api.md` on `cursor/mobile-academy-studio-api-50cf` (pull request 4 of the website). This client follows that contract. Normalization lives in `src/api/client.ts` if a field name still needs a tweak.

- `GET /api/mobile/academy-studio/flow`
- `GET /api/mobile/academy-studio/collections`
- `GET /api/mobile/academy-studio/collections/{id-or-slug}`
- `GET /api/mobile/academy-studio/pieces`
- `GET /api/mobile/academy-studio/pieces/{id-or-slug}`
- `GET /api/mobile/academy-studio/pieces/{id}/pdf`

Flow returns `{ "sections": [...] }` in display order. A tile opens the score with `piece.slug` or `piece.id`. `tiles[].id` is the placement id. A premium tile shows a Pro mark until the user owns `d8r_piano_academy_pro`, and still opens. Playback limits are unchanged. `{ "sections": [] }` is the empty path. A 404 or the sign-in page (the route is not deployed) hides Flow. The response is cached on device the same way as the catalog.

The PDF route is sent with `X-RevenueCat-App-User-Id` set to `Purchases.getAppUserID()`. Premium PDFs are rejected without a user who owns the `d8r_piano_academy_pro` entitlement. A JSON body `{ "url": "..." }` is followed; a PDF body is saved as-is.

Relative `musicXmlUrl`, `midiUrl`, `pdfUrl`, and MP3 `url` values are resolved against `EXPO_PUBLIC_ASSET_BASE_URL`.

Until the API is deployed, those routes redirect to sign-in and the library explains that the score service is not available yet. After a successful open, the catalog and the piece files are kept on device.

## Score view

The score page is the copy inside the app, `assets/academy-embed/index.html`. The studio on danijelbrecelj.com is a separate layout and is not loaded. `src/score/embedPatch.ts` fits a portrait A4 page into the score slot and lets one finger drag the page diagonally.

`npm run build:academy-embed` only checks that the snapshot is present. It does not copy the website embed.

MusicXML, MIDI, and MP3 files for pieces that have been opened are stored under the app cache. Offline, the page receives `load` with a blob `musicXmlUrl` built from the cached MusicXML. `data:` URLs are not accepted by the embed.

### Protocol version 1

The types are `src/lib/academy-embed-protocol.ts`, copied from the website. The embed posts JSON through `ReactNativeWebView.postMessage`. The app delivers commands by dispatching a `message` event inside the WebView. Every embed message includes `protocolVersion: 1`.

`seconds = whole * 240 / bpm`.

Embed to app: `ready`, `loaded` (measures and cursor steps with `pitches`), `noteTapped`, `error`.

App to embed:

- `hello` asks the document to send `ready` again.
- `load` with `musicXmlUrl` (https, http, blob, or a same-origin path), plus optional `pieceId`, `bpm`, `timeSignature`, `keySignature`, `measuresPerSystem`.
- `setLayout`: `portrait`, `landscape-phone`, or `landscape-tablet`.
- `cursor`: `time` and/or `noteIndex`, color `sky` or `green`.
- `seek`: `time` in seconds.
- `setPlaybackActive`: pinch-zoom is ignored while `active` is true, and the sheet follows the playhead.
- `setZoom`: multiplier from `0.5` to `3`.

A tap on the score posts `noteTapped` and does not move the highlight until the app replies with `seek` or `cursor`. Wait to play uses the green cursor. Play mode uses sky. Play mode and wait to play are one switch, as in the previous app: play mode runs the piece, wait mode holds on the current chord until any one of its notes is played.

## EAS

`eas.json` has `development`, `preview`, and `production`. Production uses remote credentials and auto-increments the build number from `app.json` (`ios.buildNumber`, `android.versionCode`).

```bash
npm install -g eas-cli
eas login
eas init
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

`eas init` writes the EAS project id into `app.json`. The Expo account must be `danijelbrecelj`. The iOS bundle id must stay `com.danijelbrecelj.playpianoacademymobile` so the build replaces the live app.

EAS keeps the iOS dSYM for each build. `eas.json` does not turn that off. Download the dSYM from the matching build on the EAS build page, or from App Store Connect after submit. Match it to the build number in the `.ips` (production auto-increments `ios.buildNumber`).

To symbolicate one address from an `.ips`:

```bash
xcrun atos -o App.dSYM/Contents/Resources/DWARF/<binary> -arch arm64 -l <load address> <address>
```

`<binary>` is the DWARF file inside the unzipped dSYM. `<load address>` is that binary's load address in the `.ips` image list, and `<address>` is the frame you want. Xcode can symbolicate the whole report once that dSYM is available to Organizer.

Microphone purpose string (already in `app.json`):

> D8R Piano Academy listens for the notes you play on an acoustic piano so Wait to play can move ahead. The audio stays on this device.

## Checks

```bash
npm run check
npm run typecheck
npx expo-doctor
```

## What the owner still has to configure

- Store product `d8r_piano_academy_pro` (non-consumable on the App Store, one-time product on Google Play), the RevenueCat entitlement `d8r_piano_academy_pro`, a Lifetime package on the current offering, and the SDK keys.
- `eas init` on the `danijelbrecelj` account, then a production iOS build.
- Replace `assets/icon.png`, `assets/adaptive-icon.png`, and `assets/splash-icon.png` with the three icons from the current App Store app if these stand-ins should not ship. The private keyboard-scores repo was not readable from this environment, so those files could not be copied.
- Merge and deploy website PR 4 so `/api/mobile/academy-studio/*` is live. Until then the library shows that the API is not deployed. The score page itself is the copy inside the app.

## Notes on the sources

The score page is `assets/academy-embed/index.html`. MIDI uses `@motiz88/react-native-midi` with `patches/@motiz88+react-native-midi+0.0.6.patch` and `src/hooks/useMidiController.ts` from the previous app. The sampler is `src/hooks/usePianoSound.ts` and `src/lib/sampleMapper.ts`, loading `assets/audio/piano/<note>.mp3`. Those mp3s and the three icon files are stand-ins until the owner copies the real binaries in; the filenames match the old app. The 20-second premium gate is `isPreviewLocked` from the website: automatic playback stops at 20 seconds, and seeking into that region opens the paywall. Wait mode is not gated, matching the website player.
