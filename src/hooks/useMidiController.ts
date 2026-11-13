// src/hooks/useMidiController.ts

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export interface MidiNoteEvent {
  noteNumber: number;
  velocity: number;
  type: 'note-on' | 'note-off';
}

export function useMidiController(onNoteInput: (event: MidiNoteEvent) => void) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [deviceName, setDeviceName] = useState<string>('Disconnected');

  useEffect(() => {
    let midiAccessRef: any = null;
    let isMounted = true;

    async function initMidi() {
      try {
        let reqMIDI;

        if (Platform.OS === 'web') {
          if (!('requestMIDIAccess' in navigator)) {
            if (isMounted) setDeviceName('MIDI Not Supported');
            return;
          }
          reqMIDI = navigator.requestMIDIAccess.bind(navigator);
        } else {
          // Native iOS/Android: Import the modern Expo Module polyfill dynamically
          const NativeMidi = require('@motiz88/react-native-midi');
          reqMIDI = NativeMidi.requestMIDIAccess;
        }

        if (typeof reqMIDI !== 'function') {
          if (isMounted) setDeviceName('MIDI Not Supported');
          return;
        }

        const midiAccess = await reqMIDI();
        if (!midiAccess?.inputs || typeof midiAccess.inputs.values !== 'function') {
          if (isMounted) setDeviceName('Disconnected');
          return;
        }
        midiAccessRef = midiAccess;

        const setupInputs = () => {
          const inputs = Array.from(midiAccess.inputs.values());
          if (inputs.length > 0) {
            const firstInput: any = inputs[0];
            if (isMounted) {
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
            if (isMounted) {
              setDeviceName('Disconnected');
              setIsConnected(false);
            }
          }
        };

        // Listen for hardware keyboards plugging in or unplugging in real-time
        midiAccess.onstatechange = () => {
          if (isMounted) setupInputs();
        };

        setupInputs();
      } catch (err) {
        console.warn('[MIDI] Initialization failed:', err);
      }
    }

    initMidi();

    return () => {
      isMounted = false;
      if (midiAccessRef) {
        try {
          midiAccessRef.onstatechange = null;
          Array.from(midiAccessRef.inputs.values()).forEach((input: any) => {
            input.onmidimessage = null;
          });
        } catch (e) {
          // Fallback cleanup if references are already disposed
        }
      }
    };
  }, [onNoteInput]);

  return { isConnected, deviceName };
}
