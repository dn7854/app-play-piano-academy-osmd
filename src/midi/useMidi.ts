import { useCallback, useRef, useState } from "react";
import type { MIDIAccess } from "react-native-midi-api";

export type MidiPort = { id: string; name: string };

/**
 * USB and CoreMIDI keyboards through react-native-midi-api.
 * The previous app's native MIDI patch lives in a private repo, so this build
 * uses the maintained Web MIDI polyfill (CoreMIDI on iOS). A development or
 * EAS build is required; Expo Go does not include the native module.
 */
export function useMidi(onNote: (note: number, down: boolean) => void) {
  const [ports, setPorts] = useState<MidiPort[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const onNoteRef = useRef(onNote);
  onNoteRef.current = onNote;
  const accessRef = useRef<MIDIAccess | null>(null);

  const bind = useCallback((access: MIDIAccess) => {
    const inputs = [...access.inputs.values()];
    setPorts(inputs.map((input) => ({ id: input.id, name: input.name || input.manufacturer || "MIDI keyboard" })));
    for (const input of inputs) {
      input.onmidimessage = (event) => {
        const status = event.data[0] ?? 0;
        const note = event.data[1] ?? 0;
        const velocity = event.data[2] ?? 0;
        const command = status & 0xf0;
        if (command === 0x90 && velocity > 0) onNoteRef.current(note, true);
        else if (command === 0x80 || (command === 0x90 && velocity === 0)) onNoteRef.current(note, false);
      };
    }
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    try {
      const { requestMIDIAccess } = await import("react-native-midi-api");
      const access = await requestMIDIAccess({ sysex: false });
      accessRef.current = access;
      bind(access);
      access.onstatechange = () => bind(access);
      setReady(true);
      if (access.inputs.size === 0) {
        setError("No MIDI keyboard yet. Plug one in with the USB adapter, then connect again.");
      }
    } catch {
      setReady(false);
      setError("MIDI needs an installed build. Expo Go cannot open CoreMIDI.");
    }
  }, [bind]);

  return { ports, error, ready, connect };
}
