import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

function keyFor(tablet: boolean) {
  return tablet ? "d8r-pitch-sensitivity-tablet" : "d8r-pitch-sensitivity-phone";
}

/** iPad starts much more sensitive. The tuner barely hears a piano there. */
export function defaultSensitivity(tablet: boolean) {
  return tablet ? 0.78 : 0.22;
}

export function usePitchSensitivity(tablet: boolean) {
  const [value, setValue] = useState(defaultSensitivity(tablet));
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(keyFor(tablet)).then((stored) => {
      if (cancelled || stored == null) return;
      const n = Number(stored);
      if (Number.isFinite(n)) setValue(Math.min(1, Math.max(0, n)));
    });
    return () => {
      cancelled = true;
    };
  }, [tablet]);

  function update(next: number) {
    const clamped = Math.min(1, Math.max(0, next));
    setValue(clamped);
    void AsyncStorage.setItem(keyFor(tablet), String(clamped));
  }

  return [value, update] as const;
}
