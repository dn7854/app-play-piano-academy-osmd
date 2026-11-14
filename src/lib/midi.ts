import type { TimedNote } from "./notes";

export type MidiNote = TimedNote & { velocity: number; track: number; channel: number };

function u32(data: Uint8Array, offset: number) {
  return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
}

function u16(data: Uint8Array, offset: number) {
  return (data[offset] << 8) | data[offset + 1];
}

function vlq(data: Uint8Array, pos: { i: number }) {
  let value = 0;
  for (let k = 0; k < 5; k++) {
    const byte = data[pos.i++];
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return value;
  }
  return value;
}

/**
 * Standard MIDI file → note events in score-seconds at `pieceBpm`.
 * The file's embedded tempo is ignored - notes are forced to the given BPM.
 */
export function parseMidi(data: Uint8Array, pieceBpm: number): { notes: MidiNote[]; duration: number; midiBpm: number } {
  if (data.length < 14 || String.fromCharCode(data[0], data[1], data[2], data[3]) !== "MThd") {
    return { notes: [], duration: 0, midiBpm: pieceBpm || 120 };
  }
  const division = u16(data, 12);
  const tpq = division & 0x8000 ? 480 : division || 480;
  const trackCount = u16(data, 10);
  let offset = 14;
  const raw: { tick: number; end: number; note: number; velocity: number; track: number; channel: number }[] = [];

  for (let track = 0; track < trackCount && offset + 8 <= data.length; track++) {
    if (String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]) !== "MTrk") break;
    const length = u32(data, offset + 4);
    const end = offset + 8 + length;
    const pos = { i: offset + 8 };
    let tick = 0;
    let running = 0;
    const open = new Map<number, { tick: number; velocity: number }>();
    while (pos.i < end && pos.i < data.length) {
      tick += vlq(data, pos);
      if (pos.i >= data.length) break;
      let status = data[pos.i];
      if (status < 0x80) {
        status = running;
      } else {
        pos.i++;
        if (status < 0xf0) running = status;
      }
      if (status === 0xff) {
        pos.i++;
        const size = vlq(data, pos);
        pos.i += size;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        const size = vlq(data, pos);
        pos.i += size;
        continue;
      }
      const kind = status & 0xf0;
      const channel = status & 0x0f;
      const dataBytes = kind === 0xc0 || kind === 0xd0 ? 1 : 2;
      const a = data[pos.i] ?? 0;
      const b = dataBytes === 2 ? (data[pos.i + 1] ?? 0) : 0;
      pos.i += dataBytes;
      if (channel === 9) continue;
      const key = channel * 128 + a;
      if (kind === 0x90 && b > 0) {
        open.set(key, { tick, velocity: b });
      } else if (kind === 0x80 || (kind === 0x90 && b === 0)) {
        const started = open.get(key);
        open.delete(key);
        if (started && a >= 21 && a <= 108) {
          raw.push({ tick: started.tick, end: tick, note: a, velocity: started.velocity, track, channel });
        }
      }
    }
    offset = end;
  }

  const bpm = pieceBpm > 0 ? pieceBpm : 120;
  const secondsPerTick = (60 / bpm) / tpq;
  const notes: MidiNote[] = raw
    .map((note) => {
      const start = note.tick * secondsPerTick;
      const stop = note.end * secondsPerTick;
      return {
        time: start,
        duration: Math.max(0.05, stop - start),
        note: note.note,
        velocity: note.velocity,
        track: note.track,
        channel: note.channel,
      };
    })
    .sort((a, b) => a.time - b.time || a.note - b.note);
  const duration = notes.reduce((max, note) => Math.max(max, note.time + note.duration), 0);
  return { notes, duration, midiBpm: bpm };
}

export function bytesFromBase64(b64: string) {
  const clean = b64.replace(/\s/g, "");
  const table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    if (char === "=") break;
    const value = table.indexOf(char);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}
