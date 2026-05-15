import type {
  Song,
  SongChunk,
  Bar,
  BarChordChange,
  ArrangementItem,
  PitchClass,
  BeatPosition,
  ScaleDegree,
  ChordKind,
} from "./types";

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback
  const arr = new Uint8Array(16);
  if (typeof crypto !== "undefined" && "getRandomValues" in (crypto as Crypto)) {
    (crypto as Crypto).getRandomValues(arr);
  } else {
    for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function createDefaultSong(): Song {
  const chunk = createChunk("Verse", 4);
  return {
    schemaVersion: 1,
    title: "Untitled Song",
    keyRoot: "C",
    keyMode: "major",
    chunkLibrary: [chunk],
    arrangement: [
      {
        id: generateId(),
        chunkId: chunk.id,
        label: "",
        repeatCount: 1,
      },
    ],
    ui: {
      selectedChunkId: null,
      selectedArrangementItemId: null,
      collapsedChunkIds: [],
      collapsedArrangementItemIds: [],
    },
  };
}

export function createChunk(name: string, barCount: number): SongChunk {
  const id = generateId();
  const bars: Bar[] = [];
  for (let i = 0; i < barCount; i++) {
    bars.push(createEmptyBar());
  }
  return { id, name, barCount, bars };
}

export function createEmptyBar(): Bar {
  return {
    id: generateId(),
    label: "",
    melodyPitchClass: null,
    chords: [createChordChange(1)],
  };
}

export function createChordChange(
  beat: BeatPosition,
  chordKind: ChordKind = "triad"
): BarChordChange {
  return {
    id: generateId(),
    beat,
    chordKind,
    degree: null,
  };
}

export function updateSongMeta(
  song: Song,
  patch: Partial<Pick<Song, "title" | "keyRoot" | "keyMode">>
): Song {
  const next: Song = {
    ...song,
    ...patch,
  };
  if (patch.keyRoot !== undefined || patch.keyMode !== undefined) {
    return normalizeSongAfterKeyChange(next);
  }
  return next;
}

export function updateSongUi(song: Song, patch: Partial<Song["ui"]>): Song {
  return { ...song, ui: { ...song.ui, ...patch } };
}

export function addChunk(
  song: Song,
  name?: string,
  barCount?: number
): Song {
  const chunk = createChunk(name ?? "New Chunk", barCount ?? 4);
  return {
    ...song,
    chunkLibrary: [...song.chunkLibrary, chunk],
  };
}

export function renameChunk(song: Song, chunkId: string, name: string): Song {
  return {
    ...song,
    chunkLibrary: song.chunkLibrary.map((c) =>
      c.id === chunkId ? { ...c, name } : c
    ),
  };
}

export function setChunkBarCount(
  song: Song,
  chunkId: string,
  barCount: number
): Song {
  return {
    ...song,
    chunkLibrary: song.chunkLibrary.map((c) => {
      if (c.id !== chunkId) return c;
      if (barCount < 1) barCount = 1;
      let bars = c.bars.slice();
      if (barCount > bars.length) {
        while (bars.length < barCount) bars.push(createEmptyBar());
      } else if (barCount < bars.length) {
        bars = bars.slice(0, barCount);
      }
      return { ...c, barCount, bars };
    }),
  };
}

export function duplicateChunk(song: Song, chunkId: string): Song {
  const source = song.chunkLibrary.find((c) => c.id === chunkId);
  if (!source) return song;
  const newChunk: SongChunk = {
    id: generateId(),
    name: source.name + " Copy",
    barCount: source.barCount,
    bars: source.bars.map((b) => ({
      id: generateId(),
      label: b.label,
      melodyPitchClass: b.melodyPitchClass,
      chords: b.chords.map((ch) => ({
        id: generateId(),
        beat: ch.beat,
        chordKind: ch.chordKind,
        degree: ch.degree,
      })),
    })),
  };
  return {
    ...song,
    chunkLibrary: [...song.chunkLibrary, newChunk],
  };
}

export function deleteChunk(song: Song, chunkId: string): Song {
  if (song.chunkLibrary.length <= 1) return song;
  const kept = song.chunkLibrary.filter((c) => c.id !== chunkId);
  const remainingIds = new Set(kept.map((c) => c.id));
  const arrangement = song.arrangement.filter((a) =>
    remainingIds.has(a.chunkId)
  );
  return {
    ...song,
    chunkLibrary: kept,
    arrangement,
  };
}

export function addArrangementItem(song: Song, chunkId: string): Song {
  const item: ArrangementItem = {
    id: generateId(),
    chunkId,
    label: "",
    repeatCount: 1,
  };
  return {
    ...song,
    arrangement: [...song.arrangement, item],
  };
}

export function updateArrangementItem(
  song: Song,
  itemId: string,
  patch: Partial<ArrangementItem>
): Song {
  return {
    ...song,
    arrangement: song.arrangement.map((item) => {
      if (item.id !== itemId) return item;
      const next = { ...item, ...patch };
      if (next.repeatCount < 1) next.repeatCount = 1;
      return next;
    }),
  };
}

export function moveArrangementItem(
  song: Song,
  itemId: string,
  direction: "up" | "down"
): Song {
  const idx = song.arrangement.findIndex((i) => i.id === itemId);
  if (idx === -1) return song;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= song.arrangement.length) return song;
  const next = song.arrangement.slice();
  const temp = next[idx];
  next[idx] = next[swapIdx];
  next[swapIdx] = temp;
  return { ...song, arrangement: next };
}

export function deleteArrangementItem(song: Song, itemId: string): Song {
  return {
    ...song,
    arrangement: song.arrangement.filter((i) => i.id !== itemId),
  };
}

export function setBarLabel(
  song: Song,
  chunkId: string,
  barId: string,
  label: string
): Song {
  return {
    ...song,
    chunkLibrary: song.chunkLibrary.map((c) => {
      if (c.id !== chunkId) return c;
      return {
        ...c,
        bars: c.bars.map((b) =>
          b.id === barId ? { ...b, label } : b
        ),
      };
    }),
  };
}

export function setBarMelody(
  song: Song,
  chunkId: string,
  barId: string,
  melodyPitchClass: PitchClass | null
): Song {
  return {
    ...song,
    chunkLibrary: song.chunkLibrary.map((c) => {
      if (c.id !== chunkId) return c;
      return {
        ...c,
        bars: c.bars.map((b) =>
          b.id === barId ? { ...b, melodyPitchClass } : b
        ),
      };
    }),
  };
}

export function addChordChange(
  song: Song,
  chunkId: string,
  barId: string
): Song {
  return {
    ...song,
    chunkLibrary: song.chunkLibrary.map((c) => {
      if (c.id !== chunkId) return c;
      return {
        ...c,
        bars: c.bars.map((b) => {
          if (b.id !== barId) return b;
          const nextBeat = getNextAvailableBeat(b);
          if (nextBeat === null) return b;
          const changes = [
            ...b.chords,
            createChordChange(nextBeat),
          ];
          return sortChordChanges({ ...b, chords: changes });
        }),
      };
    }),
  };
}

export function updateChordChange(
  song: Song,
  chunkId: string,
  barId: string,
  changeId: string,
  patch: Partial<Pick<BarChordChange, "beat" | "chordKind" | "degree">>
): Song {
  return {
    ...song,
    chunkLibrary: song.chunkLibrary.map((c) => {
      if (c.id !== chunkId) return c;
      return {
        ...c,
        bars: c.bars.map((b) => {
          if (b.id !== barId) return b;
          const updated = b.chords.map((ch) => {
            if (ch.id !== changeId) return ch;
            return { ...ch, ...patch };
          });
          // Prevent duplicate beats
          const beats = new Set<BeatPosition>();
          const deduped: BarChordChange[] = [];
          for (const ch of updated) {
            if (beats.has(ch.beat)) {
              // Keep existing beat for this change if it would duplicate
              if (ch.id === changeId) {
                const original = b.chords.find((x) => x.id === changeId);
                if (original) {
                  deduped.push({ ...ch, beat: original.beat });
                  continue;
                }
              }
              // Otherwise skip? Better to keep first occurrence
              continue;
            }
            beats.add(ch.beat);
            deduped.push(ch);
          }
          return sortChordChanges({ ...b, chords: deduped });
        }),
      };
    }),
  };
}

export function deleteChordChange(
  song: Song,
  chunkId: string,
  barId: string,
  changeId: string
): Song {
  return {
    ...song,
    chunkLibrary: song.chunkLibrary.map((c) => {
      if (c.id !== chunkId) return c;
      return {
        ...c,
        bars: c.bars.map((b) => {
          if (b.id !== barId) return b;
          if (b.chords.length <= 1) {
            // Clear degree instead of deleting last chord
            return {
              ...b,
              chords: b.chords.map((ch) =>
                ch.id === changeId ? { ...ch, degree: null } : ch
              ),
            };
          }
          return {
            ...b,
            chords: b.chords.filter((ch) => ch.id !== changeId),
          };
        }),
      };
    }),
  };
}

export function normalizeSongAfterKeyChange(song: Song): Song {
  // Degrees 1-7 stay valid across all supported keys and modes.
  // Melody pitch classes are always valid (0-11).
  return song;
}

export function getNextAvailableBeat(bar: Bar): BeatPosition | null {
  const used = new Set(bar.chords.map((ch) => ch.beat));
  for (let b = 1; b <= 4; b++) {
    if (!used.has(b as BeatPosition)) return b as BeatPosition;
  }
  return null;
}

export function sortChordChanges(bar: Bar): Bar {
  return {
    ...bar,
    chords: bar.chords.slice().sort((a, b) => a.beat - b.beat),
  };
}
