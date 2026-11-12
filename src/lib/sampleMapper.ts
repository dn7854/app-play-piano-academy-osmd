// src/lib/sampleMapper.ts

export interface SampleInfo {
  source: number;
  rate: number;
}

// Map the specific flat-naming convention output by the downloader
const audioFiles: Record<number, number> = {
  21: require('../../assets/audio/piano/A0.mp3'),
  22: require('../../assets/audio/piano/Bb0.mp3'),
  23: require('../../assets/audio/piano/B0.mp3'),
  24: require('../../assets/audio/piano/C1.mp3'),
  25: require('../../assets/audio/piano/Db1.mp3'),
  26: require('../../assets/audio/piano/D1.mp3'),
  27: require('../../assets/audio/piano/Eb1.mp3'),
  28: require('../../assets/audio/piano/E1.mp3'),
  29: require('../../assets/audio/piano/F1.mp3'),
  30: require('../../assets/audio/piano/Gb1.mp3'),
  31: require('../../assets/audio/piano/G1.mp3'),
  32: require('../../assets/audio/piano/Ab1.mp3'),
  33: require('../../assets/audio/piano/A1.mp3'),
  34: require('../../assets/audio/piano/Bb1.mp3'),
  35: require('../../assets/audio/piano/B1.mp3'),
  36: require('../../assets/audio/piano/C2.mp3'),
  37: require('../../assets/audio/piano/Db2.mp3'),
  38: require('../../assets/audio/piano/D2.mp3'),
  39: require('../../assets/audio/piano/Eb2.mp3'),
  40: require('../../assets/audio/piano/E2.mp3'),
  41: require('../../assets/audio/piano/F2.mp3'),
  42: require('../../assets/audio/piano/Gb2.mp3'),
  43: require('../../assets/audio/piano/G2.mp3'),
  44: require('../../assets/audio/piano/Ab2.mp3'),
  45: require('../../assets/audio/piano/A2.mp3'),
  46: require('../../assets/audio/piano/Bb2.mp3'),
  47: require('../../assets/audio/piano/B2.mp3'),
  48: require('../../assets/audio/piano/C3.mp3'),
  49: require('../../assets/audio/piano/Db3.mp3'),
  50: require('../../assets/audio/piano/D3.mp3'),
  51: require('../../assets/audio/piano/Eb3.mp3'),
  52: require('../../assets/audio/piano/E3.mp3'),
  53: require('../../assets/audio/piano/F3.mp3'),
  54: require('../../assets/audio/piano/Gb3.mp3'),
  55: require('../../assets/audio/piano/G3.mp3'),
  56: require('../../assets/audio/piano/Ab3.mp3'),
  57: require('../../assets/audio/piano/A3.mp3'),
  58: require('../../assets/audio/piano/Bb3.mp3'),
  59: require('../../assets/audio/piano/B3.mp3'),
  60: require('../../assets/audio/piano/C4.mp3'),
  61: require('../../assets/audio/piano/Db4.mp3'),
  62: require('../../assets/audio/piano/D4.mp3'),
  63: require('../../assets/audio/piano/Eb4.mp3'),
  64: require('../../assets/audio/piano/E4.mp3'),
  65: require('../../assets/audio/piano/F4.mp3'),
  66: require('../../assets/audio/piano/Gb4.mp3'),
  67: require('../../assets/audio/piano/G4.mp3'),
  68: require('../../assets/audio/piano/Ab4.mp3'),
  69: require('../../assets/audio/piano/A4.mp3'),
  70: require('../../assets/audio/piano/Bb4.mp3'),
  71: require('../../assets/audio/piano/B4.mp3'),
  72: require('../../assets/audio/piano/C5.mp3'),
  73: require('../../assets/audio/piano/Db5.mp3'),
  74: require('../../assets/audio/piano/D5.mp3'),
  75: require('../../assets/audio/piano/Eb5.mp3'),
  76: require('../../assets/audio/piano/E5.mp3'),
  77: require('../../assets/audio/piano/F5.mp3'),
  78: require('../../assets/audio/piano/Gb5.mp3'),
  79: require('../../assets/audio/piano/G5.mp3'),
  80: require('../../assets/audio/piano/Ab5.mp3'),
  81: require('../../assets/audio/piano/A5.mp3'),
  82: require('../../assets/audio/piano/Bb5.mp3'),
  83: require('../../assets/audio/piano/B5.mp3'),
  84: require('../../assets/audio/piano/C6.mp3'),
  85: require('../../assets/audio/piano/Db6.mp3'),
  86: require('../../assets/audio/piano/D6.mp3'),
  87: require('../../assets/audio/piano/Eb6.mp3'),
  88: require('../../assets/audio/piano/E6.mp3'),
  89: require('../../assets/audio/piano/F6.mp3'),
  90: require('../../assets/audio/piano/Gb6.mp3'),
  91: require('../../assets/audio/piano/G6.mp3'),
  92: require('../../assets/audio/piano/Ab6.mp3'),
  93: require('../../assets/audio/piano/A6.mp3'),
  94: require('../../assets/audio/piano/Bb6.mp3'),
  95: require('../../assets/audio/piano/B6.mp3'),
  96: require('../../assets/audio/piano/C7.mp3'),
  97: require('../../assets/audio/piano/Db7.mp3'),
  98: require('../../assets/audio/piano/D7.mp3'),
  99: require('../../assets/audio/piano/Eb7.mp3'),
  100: require('../../assets/audio/piano/E7.mp3'),
  101: require('../../assets/audio/piano/F7.mp3'),
  102: require('../../assets/audio/piano/Gb7.mp3'),
  103: require('../../assets/audio/piano/G7.mp3'),
  104: require('../../assets/audio/piano/Ab7.mp3'),
  105: require('../../assets/audio/piano/A7.mp3'),
  106: require('../../assets/audio/piano/Bb7.mp3'),
  107: require('../../assets/audio/piano/B7.mp3'),
  108: require('../../assets/audio/piano/C8.mp3'),
};

export const getSampleDetails = (targetMidi: number): SampleInfo => {
  const fallbackMidi = 60; // Default fallback to C4 if out of bounds
  const source = audioFiles[targetMidi] || audioFiles[fallbackMidi];

  if (__DEV__) {
    // Mirroring downloader nomenclature for explicit console transparency
    const noteNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const octave = Math.floor((targetMidi - 12) / 12);
    const noteIndex = (targetMidi - 12) % 12;
    const targetNoteName = `${noteNames[noteIndex] || '?'}${octave}`;
    
    // console.log(`[sampleMapper] Direct Fetch MIDI ${targetMidi} (${targetNoteName})`);
  }

  return {
    source,
    rate: 1.0 // 1:1 playback rate with zero pitch-shifting distortion
  };
};
