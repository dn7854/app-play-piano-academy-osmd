export type SessionKind = "playback" | "record";

export type SessionCategory = "playback" | "playAndRecord";
export type SessionMode = "default" | "measurement";
export type SessionOption = "mixWithOthers" | "defaultToSpeaker" | "allowBluetoothA2DP";

export type SessionProfile = {
  iosCategory: SessionCategory;
  iosMode: SessionMode;
  iosOptions: SessionOption[];
  allowsRecording: boolean;
};

const playbackMix: SessionProfile = {
  iosCategory: "playback",
  iosMode: "default",
  iosOptions: ["mixWithOthers"],
  allowsRecording: false,
};

const playbackPlain: SessionProfile = {
  iosCategory: "playback",
  iosMode: "default",
  iosOptions: [],
  allowsRecording: false,
};

/** Speaker playback while the microphone is open. Valid with the default mode. */
const recordSpeaker: SessionProfile = {
  iosCategory: "playAndRecord",
  iosMode: "default",
  iosOptions: ["mixWithOthers", "defaultToSpeaker", "allowBluetoothA2DP"],
  allowsRecording: true,
};

/**
 * Cleaner pitch input. `defaultToSpeaker` is omitted: iOS raises
 * NSInvalidArgumentException for that option together with measurement mode.
 * iPad has no receiver, so playAndRecord already comes out of the speaker.
 */
const recordMeasurement: SessionProfile = {
  iosCategory: "playAndRecord",
  iosMode: "measurement",
  iosOptions: ["mixWithOthers", "allowBluetoothA2DP"],
  allowsRecording: true,
};

const recordMinimal: SessionProfile = {
  iosCategory: "playAndRecord",
  iosMode: "default",
  iosOptions: ["mixWithOthers"],
  allowsRecording: true,
};

/**
 * Ordered attempts. `mixWithOthers` is never combined with `duckOthers`.
 * `allowBluetoothA2DP` is never paired with the playback category (iOS 26 rejects it).
 */
export function sessionAttempts(kind: SessionKind, isPad: boolean): SessionProfile[] {
  if (kind === "playback") return [playbackMix, playbackPlain];
  return isPad ? [recordMeasurement, recordSpeaker, recordMinimal] : [recordSpeaker, recordMinimal];
}
