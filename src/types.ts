export type NoteName =
  | "C" | "C#" | "Db" | "D" | "D#" | "Eb" | "E" | "E#"
  | "F" | "F#" | "Gb" | "G" | "G#" | "Ab" | "A" | "A#"
  | "Bb" | "B" | "Cb";

export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type KeyMode =
  | "major"
  | "natural-minor"
  | "harmonic-minor"
  | "melodic-minor";

export type ChordKind = "triad" | "seventh";
export type BeatPosition = 1 | 2 | 3 | 4;
export type ScaleDegree = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Song = {
  schemaVersion: 1;
  title: string;
  keyRoot: NoteName;
  keyMode: KeyMode;
  chunkLibrary: SongChunk[];
  arrangement: ArrangementItem[];
  ui: SongUiState;
};

export type SongChunk = {
  id: string;
  name: string;
  barCount: number;
  bars: Bar[];
};

export type Bar = {
  id: string;
  label: string;
  melodyPitchClass: PitchClass | null;
  chords: BarChordChange[];
};

export type BarChordChange = {
  id: string;
  beat: BeatPosition;
  chordKind: ChordKind;
  degree: ScaleDegree | null;
};

export type ArrangementItem = {
  id: string;
  chunkId: string;
  label: string;
  repeatCount: number;
};

export type SongUiState = {
  selectedChunkId: string | null;
  selectedArrangementItemId: string | null;
  collapsedChunkIds: string[];
  collapsedArrangementItemIds: string[];
};

export type NoteLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type Accidental = "bb" | "b" | "" | "#" | "##";
export type AccidentalPreference = "sharps" | "flats";
export type ChordQuality =
  | "major"
  | "minor"
  | "diminished"
  | "augmented"
  | "dominant-seventh"
  | "major-seventh"
  | "minor-seventh"
  | "half-diminished-seventh"
  | "diminished-seventh"
  | "minor-major-seventh"
  | "augmented-major-seventh";

export type SpelledNote = {
  letter: NoteLetter;
  accidental: Accidental;
  label: string;
  pitchClass: PitchClass;
};

export type Scale = {
  root: NoteName;
  mode: KeyMode;
  notes: SpelledNote[];
  pitchClasses: PitchClass[];
};

export type NoteOption = {
  value: PitchClass;
  label: string;
};

export type ChordOption = {
  degree: ScaleDegree;
  kind: ChordKind;
  degreeLabel: string;
  quality: ChordQuality;
  name: string;
  tones: SpelledNote[];
  pitchClasses: PitchClass[];
  displayLabel: string;
};

export type DerivedState = {
  scale: Scale;
  melodyNoteOptions: NoteOption[];
  triadOptions: ChordOption[];
  seventhOptions: ChordOption[];
  chunkById: Map<string, SongChunk>;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };
