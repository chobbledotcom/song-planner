import type {
  NoteName,
  PitchClass,
  KeyMode,
  ChordKind,
  ScaleDegree,
  NoteLetter,
  Accidental,
  AccidentalPreference,
  ChordQuality,
  SpelledNote,
  Scale,
  NoteOption,
  ChordOption,
} from "./types";

const NOTE_TO_PC: Record<NoteName, PitchClass> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  "E#": 5,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

export function toPitchClass(note: NoteName): PitchClass {
  return NOTE_TO_PC[note];
}

export function getScaleIntervals(mode: KeyMode): number[] {
  switch (mode) {
    case "major":
      return [0, 2, 4, 5, 7, 9, 11];
    case "natural-minor":
      return [0, 2, 3, 5, 7, 8, 10];
    case "harmonic-minor":
      return [0, 2, 3, 5, 7, 8, 11];
    case "melodic-minor":
      return [0, 2, 3, 5, 7, 9, 11];
  }
}

export function getPreferredAccidentals(root: NoteName): AccidentalPreference {
  const flatRoots: NoteName[] = ["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"];
  if ((flatRoots as string[]).includes(root)) return "flats";
  return "sharps";
}

const LETTER_ORDER: NoteLetter[] = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_TO_PC: Record<NoteLetter, PitchClass> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export function spellPitchForLetter(
  pitchClass: PitchClass,
  letter: NoteLetter
): SpelledNote {
  const basePc = LETTER_TO_PC[letter];
  let diff = (pitchClass - basePc + 12) % 12;
  if (diff > 6) diff -= 12;

  let accidental: Accidental = "";
  if (diff === 1) accidental = "#";
  else if (diff === 2) accidental = "##";
  else if (diff === -1) accidental = "b";
  else if (diff === -2) accidental = "bb";
  else if (diff !== 0) {
    // Fallback for unreachable differences; shouldn't happen with valid usage
    accidental = diff > 0 ? "#" : "b";
  }

  const label = letter + accidental;
  return { letter, accidental, label, pitchClass };
}

export function buildScale(root: NoteName, mode: KeyMode): Scale {
  const rootPc = toPitchClass(root);
  const intervals = getScaleIntervals(mode);
  const notes: SpelledNote[] = [];
  const pitchClasses: PitchClass[] = [];

  // Determine starting letter index from root
  const rootLetter = root.charAt(0) as NoteLetter;
  const rootLetterIdx = LETTER_ORDER.indexOf(rootLetter);

  for (let i = 0; i < intervals.length; i++) {
    const pc = ((rootPc + intervals[i]) % 12) as PitchClass;
    const letter = LETTER_ORDER[(rootLetterIdx + i) % 7];
    const note = spellPitchForLetter(pc, letter);
    notes.push(note);
    pitchClasses.push(pc);
  }

  return { root, mode, notes, pitchClasses };
}

export function getMelodyNoteOptions(scale: Scale): NoteOption[] {
  const pref = getPreferredAccidentals(scale.root);
  const options: NoteOption[] = [];
  for (let pc = 0; pc < 12; pc++) {
    const pitchClass = pc as PitchClass;
    const scaleNote = scale.notes.find((n) => n.pitchClass === pitchClass);
    if (scaleNote) {
      options.push({ value: pitchClass, label: scaleNote.label });
      continue;
    }
    // Non-scale tone: pick a letter that's not used by scale notes if possible,
    // otherwise use preference-based spelling.
    const usedLetters = new Set(scale.notes.map((n) => n.letter));
    let best: SpelledNote | null = null;
    for (const letter of LETTER_ORDER) {
      if (usedLetters.has(letter)) continue;
      const candidate = spellPitchForLetter(pitchClass, letter);
      // Accept if accidental is simple (b or #) or natural
      if (candidate.accidental === "" || candidate.accidental === "b" || candidate.accidental === "#") {
        best = candidate;
        break;
      }
    }
    if (!best) {
      // Fallback: use preference letter from A/B/C/D/E/F/G with preference
      const fallbackLetter = pref === "sharps" ? "C" : "F";
      best = spellPitchForLetter(pitchClass, fallbackLetter);
    }
    options.push({ value: pitchClass, label: best.label });
  }
  return options;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function buildChordOptions(scale: Scale, kind: ChordKind): ChordOption[] {
  const options: ChordOption[] = [];
  const semitones = kind === "triad" ? [0, 2, 4] : [0, 2, 4, 6];

  for (let degreeIdx = 0; degreeIdx < 7; degreeIdx++) {
    const degree = (degreeIdx + 1) as ScaleDegree;
    const tones: SpelledNote[] = [];
    const pitchClasses: PitchClass[] = [];
    for (const offset of semitones) {
      const noteIdx = mod(degreeIdx + offset, 7);
      tones.push(scale.notes[noteIdx]);
      pitchClasses.push(scale.pitchClasses[noteIdx]);
    }
    const quality = getChordQuality(pitchClasses, kind);
    const degreeLabel = getDegreeLabel(degree, quality);
    const root = tones[0];
    const name = getChordName(root, quality);
    const displayLabel = `${degreeLabel} — ${name}`;
    options.push({
      degree,
      kind,
      degreeLabel,
      quality,
      name,
      tones,
      pitchClasses,
      displayLabel,
    });
  }

  return options;
}

export function getChordQuality(
  pitchClasses: PitchClass[],
  kind: ChordKind
): ChordQuality {
  if (pitchClasses.length < 2) return "major";
  const root = pitchClasses[0];
  const third = (pitchClasses[1] - root + 12) % 12;
  const fifth = pitchClasses[2] !== undefined ? (pitchClasses[2] - root + 12) % 12 : -1;
  const seventh = pitchClasses[3] !== undefined ? (pitchClasses[3] - root + 12) % 12 : -1;

  let baseQuality: "major" | "minor" | "diminished" | "augmented" = "major";
  if (third === 3) baseQuality = "minor";
  else if (third === 4) baseQuality = "major";
  if (fifth === 6) baseQuality = "diminished";
  else if (fifth === 8) baseQuality = "augmented";

  if (kind === "triad" || seventh === -1) {
    return baseQuality;
  }

  // Seventh chord qualities
  if (baseQuality === "major" && seventh === 11) return "major-seventh";
  if (baseQuality === "major" && seventh === 10) return "dominant-seventh";
  if (baseQuality === "minor" && seventh === 10) return "minor-seventh";
  if (baseQuality === "minor" && seventh === 11) return "minor-major-seventh";
  if (baseQuality === "diminished" && seventh === 9) return "diminished-seventh";
  if (baseQuality === "diminished" && seventh === 10) return "half-diminished-seventh";
  if (baseQuality === "augmented" && seventh === 11) return "augmented-major-seventh";
  if (baseQuality === "augmented" && seventh === 10) return "dominant-seventh"; // aug7 often written as dominant with augmented 5th; fallback

  // Fallbacks
  if (seventh === 11) return "major-seventh";
  if (seventh === 10) return "dominant-seventh";
  return "major";
}

export function getDegreeLabel(degree: ScaleDegree, quality: ChordQuality): string {
  const romanMajor = ["", "I", "II", "III", "IV", "V", "VI", "VII"];
  const romanMinor = ["", "i", "ii", "iii", "iv", "v", "vi", "vii"];

  const isMinor =
    quality === "minor" ||
    quality === "minor-seventh" ||
    quality === "minor-major-seventh";
  const isDim =
    quality === "diminished" ||
    quality === "diminished-seventh" ||
    quality === "half-diminished-seventh";
  const isAug = quality === "augmented" || quality === "augmented-major-seventh";

  const roman = isMinor ? romanMinor[degree] : romanMajor[degree];

  let suffix = "";
  if (quality === "dominant-seventh") suffix = "7";
  else if (quality === "major-seventh") suffix = "maj7";
  else if (quality === "minor-seventh") suffix = "7";
  else if (quality === "minor-major-seventh") suffix = "maj7";
  else if (quality === "diminished-seventh") suffix = "°7";
  else if (quality === "half-diminished-seventh") suffix = "ø7";
  else if (quality === "augmented-major-seventh") suffix = "maj7";

  if (isDim && !suffix) suffix = "°";
  if (isAug && !suffix) suffix = "+";

  return roman + suffix;
}

export function getChordName(root: SpelledNote, quality: ChordQuality): string {
  const r = root.label;
  switch (quality) {
    case "major":
      return r;
    case "minor":
      return r + "m";
    case "diminished":
      return r + "dim";
    case "augmented":
      return r + "aug";
    case "dominant-seventh":
      return r + "7";
    case "major-seventh":
      return r + "maj7";
    case "minor-seventh":
      return r + "m7";
    case "half-diminished-seventh":
      return r + "m7b5";
    case "diminished-seventh":
      return r + "dim7";
    case "minor-major-seventh":
      return r + "mmaj7";
    case "augmented-major-seventh":
      return r + "maj7#5";
    default:
      return r;
  }
}

export function filterChordOptions(
  options: ChordOption[],
  melodyPitchClass: PitchClass | null
): ChordOption[] {
  if (melodyPitchClass === null) return options;
  return options.filter((opt) => opt.pitchClasses.includes(melodyPitchClass));
}

export function findChordOption(
  options: ChordOption[],
  degree: ScaleDegree | null
): ChordOption | null {
  if (degree === null) return null;
  return options.find((opt) => opt.degree === degree) ?? null;
}
