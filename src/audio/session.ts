import { setAudioModeAsync } from "expo-audio";
import { AudioManager } from "react-native-audio-api";

export async function setAudioSession(kind: "playback" | "record") {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: kind === "record",
      interruptionMode: "duckOthers",
      shouldPlayInBackground: true,
    });
  } catch {
    // expo-audio session is best-effort next to the sampler.
  }
  try {
    AudioManager.setAudioSessionOptions({
      iosCategory: kind === "record" ? "playAndRecord" : "playback",
      iosMode: kind === "record" ? "measurement" : "default",
      iosOptions: kind === "record" ? ["defaultToSpeaker", "allowBluetoothA2DP"] : ["mixWithOthers"],
    });
    await AudioManager.setAudioSessionActivity(true);
  } catch {
    // Android ignores unknown session keys.
  }
}
