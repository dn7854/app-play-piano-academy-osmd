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
| `EXPO_PUBLIC_API_BASE_URL` | Origin for the mobile API and the hosted embed. Default `https://www.danijelbrecelj.com`. |
| `EXPO_PUBLIC_ASSET_BASE_URL` | CDN used when MusicXML, MIDI, or MP3 paths are relative. |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | RevenueCat public iOS SDK key. |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | RevenueCat public Android SDK key. |
| `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT` | Entitlement unlocked by the purchase. Default `play_piano_academy_pro`. |
| `EXPO_PUBLIC_REVENUECAT_OFFERING_ID` | Offering that contains the package. Blank uses the current offering. |
| `EXPO_PUBLIC_REVENUECAT_PRODUCT_ID` | Non-consumable product id. Default `play_piano_academy_pro`. |

Create the non-consumable `play_piano_academy_pro` in App Store Connect and attach it in RevenueCat to the entitlement and an offering. There is no monthly or yearly subscription.

In a dev build with empty RevenueCat keys, the paywall's unlock button marks the session as Pro so the 20-second gate can be tried. That shortcut does not exist in release builds, and the PDF endpoint still checks the real RevenueCat user.

## What you can do

- The library is dark. Collections and the full piece list come from the mobile API.
- A score opens in the bright academy-studio theme. Portrait shows a full A4 page. Landscape on a phone zooms to the staff being played. Landscape on iPad zooms out enough to show several staves. Pinch zoom works only while playback is stopped.
- The seek bar stays on the score. Play and pause sit with it.
- The side panel has play mode, wait to play, the tempo sheet (55% to 100% of the written BPM), backing track, microphone, mic sensitivity, MIDI keyboard, PDF download, and the other pieces in the collection.
- Play mode sounds the written piano notes through the bundled sampler. Wait to play holds the score until any one of the expected notes is heard, from the on-screen keys, a MIDI keyboard, or the mic. It does not wait for a whole chord.
- iPad mic sensitivity starts higher, because that microphone barely picks up an acoustic piano. The slider is saved separately for phone and iPad.
- Premium pieces play for 20 seconds, then the paywall appears. Other pieces play through. PDF download is Pro only. Restore purchases is on the paywall.

## API

The app calls these routes on `EXPO_PUBLIC_API_BASE_URL`. The contract is `docs/mobile-academy-studio-api.md` on `cursor/mobile-academy-studio-api-50cf` (pull request 4 of the website). This client follows that contract. Normalization lives in `src/api/client.ts` if a field name still needs a tweak.

- `GET /api/mobile/academy-studio/collections`
- `GET /api/mobile/academy-studio/collections/{id-or-slug}`
- `GET /api/mobile/academy-studio/pieces`
- `GET /api/mobile/academy-studio/pieces/{id-or-slug}`
- `GET /api/mobile/academy-studio/pieces/{id}/pdf`

The PDF route is sent with `X-RevenueCat-App-User-Id` set to `Purchases.getAppUserID()`. Premium PDFs are rejected without a user who owns the entitlement. A JSON body `{ "url": "..." }` is followed; a PDF body is saved as-is.

Relative `musicXmlUrl`, `midiUrl`, `pdfUrl`, and MP3 `url` values are resolved against `EXPO_PUBLIC_ASSET_BASE_URL`.

Until the API is deployed, those routes redirect to sign-in and the library explains that the score service is not available yet. After a successful open, the catalog and the piece files are kept on device.

## Score view

The hosted page is `https://www.danijelbrecelj.com/academy-studio/embed/{pieceId}`. The app loads it first so OSMD fixes on the website show up here without an app release.

The offline copy is `assets/academy-embed/index.html`. Regenerate it with:

```bash
npm run build:academy-embed
```

If you have the website checkout:

```bash
npm run build:academy-embed -- --repo /path/to/app.danijelbrecelj.com
```

That copies `public/academy-embed/index.html` from the website when the file is present (the website's own `npm run build:academy-embed` writes it). Otherwise this repo builds the same protocol into the HTML, with OpenSheetMusicDisplay inlined so it works offline.

Fallback to the bundled page happens when:

- the device is offline
- the hosted page errors or returns HTTP 400+
- `ready` does not arrive within 5 seconds
- `ready.protocolVersion` is not `1`
- `loaded` does not arrive within 12 seconds of a compatible `ready`

MusicXML, MIDI, and MP3 files for pieces that have been opened are stored under the app cache. Offline, the bundled page receives `load` with a `musicXmlUrl`. That URL is the remote file when it can be fetched, and a `data:` URL of the cached MusicXML when it cannot.

### Protocol version 1

Messages are JSON. The embed posts them with `window.ReactNativeWebView.postMessage`. The app posts them with `webView.postMessage`.

`seconds = whole * 240 / bpm`. `whole` is an OSMD whole-note timestamp (a quarter note is `0.25`).

Embed to app:

```json
{ "type": "ready", "protocolVersion": 1 }
```

```json
{
  "type": "loaded",
  "protocolVersion": 1,
  "bpm": 50,
  "measures": [{ "number": 1, "whole": 0, "seconds": 0 }],
  "steps": [
    {
      "whole": 0,
      "seconds": 0,
      "durationWhole": 0.25,
      "durationSeconds": 1.2,
      "measure": 1,
      "notes": [
        { "midi": 61, "whole": 0, "seconds": 0, "durationWhole": 0.25, "durationSeconds": 1.2, "measure": 1, "staff": null }
      ]
    }
  ]
}
```

```json
{ "type": "error", "message": "The score could not be rendered." }
```

App to embed:

```json
{ "type": "load", "musicXmlUrl": "https://example.com/score.musicxml" }
```

```json
{ "type": "transport", "seconds": 1.2, "whole": 0.25, "bpm": 50, "playing": true, "waitMode": false }
```

```json
{ "type": "viewport", "orientation": "landscape", "device": "phone", "playing": true }
```

`transport` moves the sky cursor (green while wait-to-play is on) and scrolls the active system into view. `viewport` chooses the A4 fit: full page in portrait, one staff on a phone in landscape, several staves on a tablet in landscape. The page ignores pinch gestures while `playing` is true.

The note steps in `loaded` are what the app plays and what wait-to-play expects. A parsed MIDI file is used only when the embed has not sent steps yet.

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

Microphone purpose string (already in `app.json`):

> D8R Piano Academy listens for the notes you play on an acoustic piano so Wait to play can move ahead. The audio stays on this device.

## Checks

```bash
npm run check
npm run typecheck
npx expo-doctor
```

## What the owner still has to configure

- App Store Connect product `play_piano_academy_pro` (non-consumable) and the matching RevenueCat entitlement, offering, and SDK keys.
- `eas init` on the `danijelbrecelj` account, then a production iOS build.
- Replace `assets/icon.png`, `assets/adaptive-icon.png`, and `assets/splash-icon.png` with the three icons from the current App Store app if these stand-ins should not ship. The private keyboard-scores repo was not readable from this environment, so those files could not be copied.
- Merge and deploy website PR 4 so the hosted embed and `/api/mobile/academy-studio/*` are live. Until then the app uses the bundled score view whenever a MusicXML file is already cached, and the library shows that the API is not deployed.

## Notes on the sources

`app-keyboard-scores` and `app.danijelbrecelj.com` are private and were not readable here. Pitch detection follows the public D8R Metronome & Tuner app (`src/lib/pitch.ts`, `src/pitch/usePitch.ts`). The piano samples are the same set that app ships. MIDI uses `react-native-midi-api` (CoreMIDI / USB) because the old native patch could not be copied. The score theme, cursor colors, tempo range, wait-to-play rule, and OSMD page setup follow the live academy-studio player. The embed protocol follows the backend contract: `ready.protocolVersion`, `load.musicXmlUrl`, and `loaded` measures plus note steps.
