// src/hooks/useMidiController.ts

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export interface MidiNoteEvent {
  noteNumber: number;
  velocity: number;
  type: 'note-on' | 'note-off';
}

function detachMidi(access: any) {
  if (!access) return;
  try {
    access.onstatechange = null;
    Array.from(access.inputs.values()).forEach((input: any) => {
      input.onmidimessage = null;
    });
  } catch {
    // The native client may already be gone.
  }
}

export function useMidiController(enabled: boolean, onNoteInput: (event: MidiNoteEvent) => void) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [deviceName, setDeviceName] = useState<string>('Not connected');

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      setDeviceName('Not connected');
      return;
    }

    const hold: { access: any; mounted: boolean } = { access: null, mounted: true };

    async function initMidi() {
      try {
        let reqMIDI;

        if (Platform.OS === 'web') {
          if (!('requestMIDIAccess' in navigator)) {
            if (hold.mounted) setDeviceName('MIDI Not Supported');
            return;
          }
          reqMIDI = navigator.requestMIDIAccess.bind(navigator);
        } else {
          // Native iOS/Android: Import the modern Expo Module polyfill dynamically
          const NativeMidi = require('@motiz88/react-native-midi');
          reqMIDI = NativeMidi.requestMIDIAccess;
        }

        if (typeof reqMIDI !== 'function') {
          if (hold.mounted) setDeviceName('MIDI Not Supported');
          return;
        }

        const midiAccess = await reqMIDI();
        if (!hold.mounted) {
          detachMidi(midiAccess);
          return;
        }
        if (!midiAccess?.inputs || typeof midiAccess.inputs.values !== 'function') {
          if (hold.mounted) setDeviceName('Not connected');
          return;
        }
        hold.access = midiAccess;

        const setupInputs = () => {
          const inputs = Array.from(midiAccess.inputs.values());
          if (inputs.length > 0) {
            const firstInput: any = inputs[0];
            if (hold.mounted) {
              setDeviceName(firstInput.name || 'Hardware Keyboard');
              setIsConnected(true);
            }

            firstInput.onmidimessage = (message: { data: Uint8Array }) => {
              try {
                if (!message?.data || message.data.length < 3) return;
                const [status, noteNumber, velocity] = message.data;
                const command = status & 0xf0;

                // 0x90 = Note On, 0x80 = Note Off
                if (command === 0x90 && velocity > 0) {
                  onNoteInput({ noteNumber, velocity, type: 'note-on' });
                } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
                  onNoteInput({ noteNumber, velocity, type: 'note-off' });
                }
              } catch (err) {
                console.warn('[MIDI] Note handler failed:', err);
              }
            };
          } else {
            if (hold.mounted) {
              setDeviceName('Not connected');
              setIsConnected(false);
            }
          }
        };

        // Listen for hardware keyboards plugging in or unplugging in real-time
        midiAccess.onstatechange = () => {
          if (hold.mounted) setupInputs();
        };

        setupInputs();
      } catch (err) {
        console.warn('[MIDI] Initialization failed:', err);
        if (hold.mounted) {
          setIsConnected(false);
          setDeviceName('Not connected');
        }
      }
    }

    void initMidi();

    return () => {
      hold.mounted = false;
      detachMidi(hold.access);
    };
  }, [enabled, onNoteInput]);

  return { isConnected, deviceName };
}
