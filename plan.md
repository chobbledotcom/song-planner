# Guitar Song Planner Plan

## Goal

Build a TypeScript browser app that compiles into a single self-contained HTML file. The app lets guitar players plan songs by key, reusable chunks, arranged sections, bars, and diatonic chords. Chord selectors support triads and seventh chords, and optional melody-note filtering narrows chord choices to chords containing the selected note.

## Output

- `dist/song-planner.html`: final single HTML file containing markup, CSS, and compiled JavaScript.
- `build`: executable Nix shebang script that installs the build toolchain through Nix and produces the HTML file.
- `src/`: TypeScript source for the app.

## Proposed Files

- `src/main.ts`: app bootstrap, top-level state, dispatch, autosave, and render loop.
- `src/types.ts`: shared TypeScript types.
- `src/music.ts`: key spelling, scale generation, chord generation, and melody filtering.
- `src/state.ts`: pure song creation and update functions.
- `src/storage.ts`: autosave, import, export, and validation helpers.
- `src/render.ts`: DOM rendering functions and event binding.
- `src/styles.css`: app styling imported by the TypeScript entry point or inlined by the build.
- `src/index.html`: minimal HTML shell used by the bundler.
- `scripts/inline-build.mjs`: post-build script that inlines Vite's emitted CSS and JS.
- `build`: Nix shebang build script.
- `tsconfig.json`: TypeScript compiler settings.
- `package.json`: local build scripts and dev dependencies for TypeScript bundling.
- `dist/song-planner.html`: generated artifact, not edited by hand.

## Build Approach

Use Vite because it is simple, fast, and can bundle TypeScript. Add a small post-build step to inline the generated JavaScript and CSS into one HTML file.

The `build` script should use a Nix shebang, for example:

```bash
#!/usr/bin/env nix-shell
#!nix-shell -i bash -p nodejs_22 nodePackages.pnpm
```

Build flow:

1. Install dependencies with `pnpm install --frozen-lockfile` when a lockfile exists, otherwise `pnpm install`.
2. Run the TypeScript/Vite build.
3. Inline emitted CSS and JS into `dist/song-planner.html`.
4. Fail if the output HTML references external local assets.

Expected `package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "typecheck": "tsc --noEmit",
    "build": "vite build && node scripts/inline-build.mjs"
  }
}
```

## App Model

Represent the song as JSON-friendly data:

```ts
type NoteName =
  | "C" | "C#" | "Db" | "D" | "D#" | "Eb" | "E" | "F"
  | "F#" | "Gb" | "G" | "G#" | "Ab" | "A" | "A#" | "Bb" | "B";

type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

type KeyMode =
  | "major"
  | "natural-minor"
  | "harmonic-minor"
  | "melodic-minor";

type ChordKind = "triad" | "seventh";
type BeatPosition = 1 | 2 | 3 | 4;
type ScaleDegree = 1 | 2 | 3 | 4 | 5 | 6 | 7;

type Song = {
  schemaVersion: 1;
  title: string;
  keyRoot: NoteName;
  keyMode: KeyMode;
  chunkLibrary: SongChunk[];
  arrangement: ArrangementItem[];
  ui: SongUiState;
};

type SongChunk = {
  id: string;
  name: string;
  barCount: number;
  bars: Bar[];
};

type Bar = {
  id: string;
  label: string;
  melodyPitchClass: PitchClass | null;
  chords: BarChordChange[];
};

type BarChordChange = {
  id: string;
  beat: BeatPosition;
  chordKind: ChordKind;
  degree: ScaleDegree | null;
};

type ArrangementItem = {
  id: string;
  chunkId: string;
  label: string;
  repeatCount: number;
};

type SongUiState = {
  selectedChunkId: string | null;
  selectedArrangementItemId: string | null;
  collapsedChunkIds: string[];
  collapsedArrangementItemIds: string[];
};
```

Derive available chords from `keyRoot`, `keyMode`, `chordKind`, and `degree` instead of storing a duplicated chord list in the song JSON.

Default song:

- Title: `Untitled Song`.
- Key: `C major`.
- One reusable chunk named `Verse`.
- Four bars.
- One arrangement item that references the verse.
- Empty optional bar labels.

## Technical Skeleton

Keep `src/types.ts` as the contract between files. Use these additional derived types:

```ts
type NoteLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";
type Accidental = "bb" | "b" | "" | "#" | "##";
type AccidentalPreference = "sharps" | "flats";
type ChordQuality =
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

type SpelledNote = {
  letter: NoteLetter;
  accidental: Accidental;
  label: string;
  pitchClass: PitchClass;
};

type Scale = {
  root: NoteName;
  mode: KeyMode;
  notes: SpelledNote[];
  pitchClasses: PitchClass[];
};

type NoteOption = {
  value: PitchClass;
  label: string;
};

type ChordOption = {
  degree: ScaleDegree;
  kind: ChordKind;
  degreeLabel: string;
  quality: ChordQuality;
  name: string;
  tones: SpelledNote[];
  pitchClasses: PitchClass[];
  displayLabel: string;
};

type DerivedState = {
  scale: Scale;
  melodyNoteOptions: NoteOption[];
  triadOptions: ChordOption[];
  seventhOptions: ChordOption[];
  chunkById: Map<string, SongChunk>;
};

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };
```

Use these implementation rules:

- State update functions in `src/state.ts` should be pure and return a new `Song`.
- Rendering functions in `src/render.ts` should return DOM nodes or update a provided container; they should not read or write `localStorage`.
- `src/main.ts` owns the current `Song`, calls state functions, calls `saveAutosave`, and re-renders.
- Store selected melody notes as `PitchClass`, not text labels. Labels are derived from the current key.
- Store selected chords as `chordKind + degree`, not chord names. Chord names are derived from the current key.
- Sort chord changes inside a bar by beat after every add/update.

## Method Contracts

### `src/music.ts`

```ts
function toPitchClass(note: NoteName): PitchClass;
```

Returns the chromatic pitch class for a note name where `C` is `0`, `C#`/`Db` is `1`, and `B` is `11`.

```ts
function getScaleIntervals(mode: KeyMode): number[];
```

Returns seven semitone offsets for the mode.

```ts
function getPreferredAccidentals(root: NoteName): AccidentalPreference;
```

Returns whether non-scale chromatic note labels should prefer sharps or flats for the selected root.

```ts
function spellPitchForLetter(pitchClass: PitchClass, letter: NoteLetter): SpelledNote;
```

Returns a spelled note using the requested letter and the accidental needed to reach the pitch class. This is what allows key-correct labels such as `E#` or `B#` when a mode requires them.

```ts
function buildScale(root: NoteName, mode: KeyMode): Scale;
```

Returns seven key-spelled notes and pitch classes for the selected root and mode.

```ts
function getMelodyNoteOptions(scale: Scale): NoteOption[];
```

Returns dropdown options for all 12 pitch classes. Scale tones should use the key-spelled labels from `scale`; non-scale tones should use the key's accidental preference.

```ts
function buildChordOptions(scale: Scale, kind: ChordKind): ChordOption[];
```

Returns seven chord options by stacking thirds from the scale. For `triad`, each chord has three tones. For `seventh`, each chord has four tones.

```ts
function getChordQuality(pitchClasses: PitchClass[], kind: ChordKind): ChordQuality;
```

Returns the quality derived from intervals above the chord root.

```ts
function getDegreeLabel(degree: ScaleDegree, quality: ChordQuality): string;
```

Returns Roman numerals such as `I`, `ii`, `vii°`, or seventh-aware labels when useful.

```ts
function getChordName(root: SpelledNote, quality: ChordQuality): string;
```

Returns labels such as `C`, `Am`, `Bdim`, `G7`, `Cmaj7`, or `Bm7b5`.

```ts
function filterChordOptions(options: ChordOption[], melodyPitchClass: PitchClass | null): ChordOption[];
```

Returns all options when `melodyPitchClass` is `null`; otherwise returns only chords whose `pitchClasses` include the melody pitch class.

```ts
function findChordOption(options: ChordOption[], degree: ScaleDegree | null): ChordOption | null;
```

Returns the matching chord option or `null` if no degree is selected.

### `src/state.ts`

```ts
function createDefaultSong(): Song;
```

Returns the default `Untitled Song` in `C major` with one 4-bar `Verse` chunk and one arrangement item referencing it.

```ts
function createChunk(name: string, barCount: number): SongChunk;
```

Returns a chunk with generated IDs, `barCount` empty bars, and one default chord change on beat `1` in each bar.

```ts
function createEmptyBar(): Bar;
```

Returns a bar with an empty label, `melodyPitchClass: null`, and one default chord change.

```ts
function createChordChange(beat: BeatPosition, chordKind?: ChordKind): BarChordChange;
```

Returns a chord change with generated ID, selected beat, `chordKind` defaulting to `triad`, and `degree: null`.

```ts
function updateSongMeta(song: Song, patch: Partial<Pick<Song, "title" | "keyRoot" | "keyMode">>): Song;
```

Returns a song with updated metadata, then normalizes chord and melody selections if the key changed.

```ts
function addChunk(song: Song, name?: string, barCount?: number): Song;
function renameChunk(song: Song, chunkId: string, name: string): Song;
function setChunkBarCount(song: Song, chunkId: string, barCount: number): Song;
function duplicateChunk(song: Song, chunkId: string): Song;
function deleteChunk(song: Song, chunkId: string): Song;
```

Each returns the updated song. `deleteChunk` must also remove arrangement items that referenced the deleted chunk, unless it is the final chunk; the final chunk should be kept.

```ts
function addArrangementItem(song: Song, chunkId: string): Song;
function updateArrangementItem(song: Song, itemId: string, patch: Partial<ArrangementItem>): Song;
function moveArrangementItem(song: Song, itemId: string, direction: "up" | "down"): Song;
function deleteArrangementItem(song: Song, itemId: string): Song;
```

Each returns the updated song. `repeatCount` should be clamped to at least `1`.

```ts
function setBarLabel(song: Song, chunkId: string, barId: string, label: string): Song;
function setBarMelody(song: Song, chunkId: string, barId: string, melodyPitchClass: PitchClass | null): Song;
```

Returns the updated song with only the selected bar changed.

```ts
function addChordChange(song: Song, chunkId: string, barId: string): Song;
```

Returns the updated song with a new chord change on the first unused beat. If beats `1` through `4` are all used, return the song unchanged.

```ts
function updateChordChange(
  song: Song,
  chunkId: string,
  barId: string,
  changeId: string,
  patch: Partial<Pick<BarChordChange, "beat" | "chordKind" | "degree">>
): Song;
```

Returns the updated song, prevents duplicate beats within the same bar, and sorts changes by beat.

```ts
function deleteChordChange(song: Song, chunkId: string, barId: string, changeId: string): Song;
```

Returns the updated song. Do not allow the final chord change in a bar to be deleted; clear its `degree` instead.

```ts
function normalizeSongAfterKeyChange(song: Song): Song;
```

Returns a song where invalid melody pitch classes and invalid chord degrees are cleared. With the current model, chord degrees `1` through `7` stay valid across all supported keys and modes.

```ts
function getNextAvailableBeat(bar: Bar): BeatPosition | null;
function sortChordChanges(bar: Bar): Bar;
```

`getNextAvailableBeat` returns the first unused beat from `1` to `4`, or `null`. `sortChordChanges` returns a bar with chord changes ordered by beat.

### `src/storage.ts`

```ts
function serializeSong(song: Song): string;
```

Returns pretty-printed JSON.

```ts
function parseSongJson(json: string): ValidationResult<Song>;
function validateSong(value: unknown): ValidationResult<Song>;
```

Returns either a normalized `Song` or a list of validation errors.

```ts
function saveAutosave(song: Song): void;
function loadAutosave(): ValidationResult<Song | null>;
function clearAutosave(): void;
```

Uses a constant key such as `guitar-song-planner.autosave.v1`.

```ts
function downloadSongJson(song: Song): void;
```

Creates a browser download using a safe filename based on the song title.

```ts
function readSongFile(file: File): Promise<ValidationResult<Song>>;
```

Reads a selected JSON file and validates it.

### `src/render.ts`

```ts
type AppHandlers = {
  onSongMetaChange(patch: Partial<Pick<Song, "title" | "keyRoot" | "keyMode">>): void;
  onAddChunk(): void;
  onUpdateChunk(chunkId: string, patch: Partial<Pick<SongChunk, "name" | "barCount">>): void;
  onDuplicateChunk(chunkId: string): void;
  onDeleteChunk(chunkId: string): void;
  onAddArrangementItem(chunkId: string): void;
  onUpdateArrangementItem(itemId: string, patch: Partial<ArrangementItem>): void;
  onMoveArrangementItem(itemId: string, direction: "up" | "down"): void;
  onDeleteArrangementItem(itemId: string): void;
  onSetBarLabel(chunkId: string, barId: string, label: string): void;
  onSetBarMelody(chunkId: string, barId: string, melodyPitchClass: PitchClass | null): void;
  onAddChordChange(chunkId: string, barId: string): void;
  onUpdateChordChange(chunkId: string, barId: string, changeId: string, patch: Partial<BarChordChange>): void;
  onDeleteChordChange(chunkId: string, barId: string, changeId: string): void;
  onImportFile(file: File): void;
  onExport(): void;
  onResetSong(): void;
};
```

Rendering entry points:

```ts
function renderApp(root: HTMLElement, song: Song, derived: DerivedState, handlers: AppHandlers): void;
function buildDerivedState(song: Song): DerivedState;
function renderSongHeader(song: Song, handlers: AppHandlers): HTMLElement;
function renderArrangement(song: Song, derived: DerivedState, handlers: AppHandlers): HTMLElement;
function renderChunkLibrary(song: Song, derived: DerivedState, handlers: AppHandlers): HTMLElement;
function renderChunk(chunk: SongChunk, song: Song, derived: DerivedState, handlers: AppHandlers): HTMLElement;
function renderBar(chunk: SongChunk, bar: Bar, song: Song, derived: DerivedState, handlers: AppHandlers): HTMLElement;
function renderChordChange(
  chunk: SongChunk,
  bar: Bar,
  change: BarChordChange,
  song: Song,
  derived: DerivedState,
  handlers: AppHandlers
): HTMLElement;
```

Each render function returns an element except `renderApp`, which replaces the contents of `root`.

### `src/main.ts`

```ts
function initApp(): void;
function getInitialSong(): Song;
function setSong(nextSong: Song): void;
function dispatch(recipe: (song: Song) => Song): void;
function rerender(): void;
function showError(message: string): void;
```

`initApp` finds the root element, loads autosave or creates the default song, wires handlers, and renders. `dispatch` applies a state update, saves autosave, and re-renders.

Handler wiring should stay simple:

- UI handlers call `dispatch(song => stateFunction(song, args))`.
- Import handlers call `readSongFile`, then `setSong(importedSong)` on success.
- Export handlers call `downloadSongJson(currentSong)`.
- Reset handlers call `setSong(createDefaultSong())` and `clearAutosave()`.

### `scripts/inline-build.mjs`

```ts
async function inlineBuild(): Promise<void>;
async function inlineAssets(inputHtmlPath: string, outputHtmlPath: string): Promise<void>;
function assertSingleFileHtml(html: string): void;
```

`inlineBuild` reads Vite output, inlines generated JS and CSS, writes `dist/song-planner.html`, and fails if the HTML still contains local `<script src>` or `<link rel="stylesheet">` references.

## Music Logic

Implement note and chord helpers in TypeScript:

- Normalize note names to pitch classes.
- Spell generated scale notes according to the selected key, so users choose from dropdowns and do not type note names.
- Generate the major scale from intervals `[0, 2, 4, 5, 7, 9, 11]`.
- Generate the natural minor scale from intervals `[0, 2, 3, 5, 7, 8, 10]`.
- Generate the harmonic minor scale from intervals `[0, 2, 3, 5, 7, 8, 11]`.
- Generate the melodic minor scale from intervals `[0, 2, 3, 5, 7, 9, 11]`.
- Build diatonic triads and seventh chords for each scale degree by stacking thirds within the selected scale.
- Label major-key chords as `I`, `ii`, `iii`, `IV`, `V`, `vi`, `vii°`.
- Label minor-key chords according to the actual chord quality produced by natural, harmonic, or melodic minor.
- For melody-note filtering, keep only chords whose pitch classes include the selected note.

Each bar chord dropdown should show:

- Degree label, for example `I`.
- Chord name, for example `C`.
- Chord tones, for example `C E G` or `C E G B`.

## UI

Primary screen:

- Song title field.
- Key root dropdown.
- Mode dropdown.
- Import JSON button.
- Export JSON button.
- Add chunk button.
- Add arrangement item button.

Arrangement controls:

- Ordered list of song sections.
- Each arrangement item selects one reusable chunk from the chunk library.
- Optional arrangement item label.
- Repeat count.
- Move up/down controls.
- Delete arrangement item.

Chunk controls:

- Rename chunk.
- Set bar count.
- Duplicate chunk.
- Delete chunk.

Bar controls:

- Optional bar label.
- Optional melody note dropdown with a `None` option.
- One or more chord changes per bar.
- For each chord change:
  - Beat/subdivision selector for 4/4.
  - Chord kind selector for triad or seventh.
  - Chord dropdown filtered by the melody note when present.
  - Clear chord control.
  - Delete chord change control.
- Add chord change control.

Use dropdowns for musical selections, not text inputs:

- Key root.
- Mode.
- Bar melody note.
- Bar chord.
- Chord kind.
- Chord beat/subdivision.
- Arrangement chunk selection.

## State Behavior

- Keep app state in a single `Song` object.
- Render from state after each change.
- Autosave the full song JSON to `localStorage` after changes.
- Restore from autosave on load when present, with a reset/new-song control to return to the default song.
- Generate stable IDs with `crypto.randomUUID()` where available, with a fallback.
- When a chunk bar count changes:
  - Add empty bars when increasing.
  - Remove bars from the end when decreasing.
- When a key changes:
  - Keep existing chord degrees because degrees `1` through `7` are valid in every supported key and mode.
  - Keep melody pitch classes unchanged.
  - Recompute all displayed chord names, chord tones, and note labels from the new key.
- When a reusable chunk changes, all arrangement items that reference it show the updated bars.
- Reused chunks are identical everywhere in the arrangement for the first version; arrangement-level chord overrides are out of scope.
- When a chunk is deleted, remove or retarget arrangement items that reference it.

## JSON Import and Export

Export:

- Serialize the `Song` object with pretty formatting.
- Include musical data and UI state.
- Download as `${safeTitle || "song"}.json`.

Import:

- Read a selected `.json` file.
- Validate `schemaVersion`, key fields, chunk library shape, arrangement shape, UI state shape, and bar/chord-change shape.
- Normalize missing optional values to `null`.
- Reject malformed files with a visible error message.
- Replace autosave with the imported song after successful import.

## Accessibility and UX

- Use native labels for all dropdowns and controls.
- Keep controls keyboard-accessible.
- Avoid drag-and-drop for the first version; explicit buttons are simpler and reliable.
- Show empty states for a new song and for chunks with zero bars.
- Preserve layout on narrow screens with a responsive grid.

## Testing and Verification

Manual checks:

- Build script runs on NixOS and produces `dist/song-planner.html`.
- The generated HTML opens directly in a browser without a dev server.
- Creating chunks and changing bar counts works.
- Arrangement items can reuse the same chunk and reflect edits to that chunk.
- Reused chunks are identical everywhere they appear.
- Chord dropdowns update when changing key or mode.
- Major, natural minor, harmonic minor, and melodic minor all produce spelled chords.
- Triad and seventh chord choices are available.
- Selecting a melody note filters chords to chords containing that note.
- Multiple chord changes can be added to one bar.
- Optional bar labels persist through autosave and JSON export/import.
- Autosave restores the last song on reload.
- Exported JSON imports back to the same song.
- Invalid JSON shows an error instead of breaking the app.

Optional automated checks:

- Unit test note normalization, key-aware spelling, scale generation, diatonic triad/seventh generation, and melody-note filtering.
- Add a small Playwright smoke test that opens the built HTML and verifies basic interactions.

## Implementation Order

1. Scaffold TypeScript, Vite, `tsconfig.json`, and the Nix shebang `build` script.
2. Implement music helpers and basic song state.
3. Implement autosave and the default song.
4. Build chunk library, arrangement, bar, and chord-change controls.
5. Add melody-note filtering for chord dropdowns.
6. Add JSON import/export with validation.
7. Add styling and responsive layout.
8. Add build inlining and verify the final single HTML file.

## Resolved Decisions

1. Include seventh chords as first-version chord choices.
2. Support natural minor, harmonic minor, and melodic minor.
3. Support multiple chord changes per bar.
4. Keep chunks reusable through a separate arrangement list.
5. Include UI state in the exported JSON.
6. Spell notes according to the selected key, while still using dropdowns for note selection.
7. Autosave to browser storage.
8. Start with `Untitled Song` in `C major` with one 4-bar verse.
9. Allow optional bar labels.
10. Use 4/4 beat positions only for the first version.
11. Use a separate triad/seventh selector on each chord change.
12. Keep reused chunks identical everywhere for the first version, with no per-arrangement chord overrides.
