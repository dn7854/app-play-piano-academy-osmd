import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { parseStudioView, type StudioView } from "./studioView";

export const ACOUSTIC_MIC_KEY = "d8r-acoustic-mic";
export const MIDI_TOGGLE_KEY = "d8r-midi-keyboard";
export const STUDIO_VIEW_KEY = "d8r-studio-view";

/** Stored boolean. Stays at `fallback` until the saved value has been read, so a mount cannot turn hardware on early. */
export function usePersistedBoolean(key: string, fallback: boolean) {
  const [value, setValue] = useState(fallback);
  const [hydrated, setHydrated] = useState(false);
  const touched = useRef(false);

  useEffect(() => {
    let cancel = false;
    void AsyncStorage.getItem(key)
      .then((stored) => {
        if (cancel || touched.current) return;
        if (stored === "1") setValue(true);
        else if (stored === "0") setValue(false);
        setHydrated(true);
      })
      .catch(() => {
        if (!cancel && !touched.current) setHydrated(true);
      });
    return () => {
      cancel = true;
    };
  }, [key]);

  const update = useCallback(
    (next: boolean) => {
      touched.current = true;
      setHydrated(true);
      setValue(next);
      void AsyncStorage.setItem(key, next ? "1" : "0").catch(() => undefined);
    },
    [key],
  );

  return { value: hydrated ? value : fallback, setValue: update, hydrated };
}

export function usePersistedStudioView() {
  const [mode, setMode] = useState<StudioView>("score");
  const touched = useRef(false);

  useEffect(() => {
    let cancel = false;
    void AsyncStorage.getItem(STUDIO_VIEW_KEY)
      .then((stored) => {
        if (cancel || touched.current) return;
        setMode(parseStudioView(stored));
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, []);

  const update = useCallback((next: StudioView) => {
    touched.current = true;
    setMode(next);
    void AsyncStorage.setItem(STUDIO_VIEW_KEY, next).catch(() => undefined);
  }, []);

  return [mode, update] as const;
}
