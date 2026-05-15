import type { Song, ValidationResult } from "./types";

const AUTOSAVE_KEY = "guitar-song-planner.autosave.v1";

export function serializeSong(song: Song): string {
  return JSON.stringify(song, null, 2);
}

export function parseSongJson(json: string): ValidationResult<Song> {
  try {
    const parsed = JSON.parse(json);
    return validateSong(parsed);
  } catch {
    return { ok: false, errors: ["Invalid JSON"] };
  }
}

export function validateSong(value: unknown): ValidationResult<Song> {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null) {
    return { ok: false, errors: ["Expected an object"] };
  }
  const obj = value as Record<string, unknown>;

  if (obj.schemaVersion !== 1) {
    errors.push(`Expected schemaVersion 1, got ${obj.schemaVersion}`);
  }
  if (typeof obj.title !== "string") errors.push("Missing or invalid title");
  if (typeof obj.keyRoot !== "string") errors.push("Missing or invalid keyRoot");
  if (typeof obj.keyMode !== "string") errors.push("Missing or invalid keyMode");

  const validModes = ["major", "natural-minor", "harmonic-minor", "melodic-minor"];
  if (typeof obj.keyMode === "string" && !validModes.includes(obj.keyMode)) {
    errors.push(`Invalid keyMode: ${obj.keyMode}`);
  }

  if (!Array.isArray(obj.chunkLibrary)) {
    errors.push("Missing chunkLibrary array");
  } else {
    for (const chunk of obj.chunkLibrary as unknown[]) {
      if (typeof chunk !== "object" || chunk === null) {
        errors.push("Invalid chunk in chunkLibrary");
        continue;
      }
      const c = chunk as Record<string, unknown>;
      if (typeof c.id !== "string") errors.push("Chunk missing id");
      if (typeof c.name !== "string") errors.push("Chunk missing name");
      if (typeof c.barCount !== "number") errors.push("Chunk missing barCount");
      if (!Array.isArray(c.bars)) {
        errors.push("Chunk missing bars array");
      } else {
        for (const bar of c.bars as unknown[]) {
          if (typeof bar !== "object" || bar === null) {
            errors.push("Invalid bar");
            continue;
          }
          const b = bar as Record<string, unknown>;
          if (typeof b.id !== "string") errors.push("Bar missing id");
          if (typeof b.label !== "string") b.label = "";
          if (b.melodyPitchClass !== null && typeof b.melodyPitchClass !== "number") {
            errors.push("Bar has invalid melodyPitchClass");
          }
          if (!Array.isArray(b.chords)) {
            errors.push("Bar missing chords array");
          } else {
            for (const ch of b.chords as unknown[]) {
              if (typeof ch !== "object" || ch === null) {
                errors.push("Invalid chord change");
                continue;
              }
              const cc = ch as Record<string, unknown>;
              if (typeof cc.id !== "string") errors.push("Chord change missing id");
              if (typeof cc.beat !== "number") errors.push("Chord change missing beat");
              if (cc.chordKind !== "triad" && cc.chordKind !== "seventh") {
                errors.push("Chord change has invalid chordKind");
              }
              if (cc.degree !== null && typeof cc.degree !== "number") {
                errors.push("Chord change has invalid degree");
              }
            }
          }
        }
      }
    }
  }

  if (!Array.isArray(obj.arrangement)) {
    errors.push("Missing arrangement array");
  } else {
    for (const item of obj.arrangement as unknown[]) {
      if (typeof item !== "object" || item === null) {
        errors.push("Invalid arrangement item");
        continue;
      }
      const a = item as Record<string, unknown>;
      if (typeof a.id !== "string") errors.push("Arrangement item missing id");
      if (typeof a.chunkId !== "string") errors.push("Arrangement item missing chunkId");
      if (typeof a.label !== "string") a.label = "";
      if (typeof a.repeatCount !== "number") errors.push("Arrangement item missing repeatCount");
    }
  }

  if (typeof obj.ui !== "object" || obj.ui === null) {
    errors.push("Missing ui object");
  } else {
    const ui = obj.ui as Record<string, unknown>;
    if (ui.selectedChunkId !== null && typeof ui.selectedChunkId !== "string") {
      errors.push("Invalid ui.selectedChunkId");
    }
    if (ui.selectedArrangementItemId !== null && typeof ui.selectedArrangementItemId !== "string") {
      errors.push("Invalid ui.selectedArrangementItemId");
    }
    if (!Array.isArray(ui.collapsedChunkIds)) errors.push("Invalid ui.collapsedChunkIds");
    if (!Array.isArray(ui.collapsedArrangementItemIds)) errors.push("Invalid ui.collapsedArrangementItemIds");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: obj as Song };
}

export function saveAutosave(song: Song): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, serializeSong(song));
  } catch {
    // storage may be full or unavailable
  }
}

export function loadAutosave(): ValidationResult<Song | null> {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return { ok: true, value: null };
    return parseSongJson(raw);
  } catch {
    return { ok: false, errors: ["Failed to read autosave"] };
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    // ignore
  }
}

function toSafeFileName(title: string): string {
  return title.trim().replace(/[^a-zA-Z0-9\-_. ]+/g, " ").replace(/\s+/g, " ").trim() || "song";
}

export function downloadSongJson(song: Song): void {
  const blob = new Blob([serializeSong(song)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${toSafeFileName(song.title)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function readSongFile(file: File): Promise<ValidationResult<Song>> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      resolve(parseSongJson(text));
    };
    reader.onerror = () => {
      resolve({ ok: false, errors: ["Failed to read file"] });
    };
    reader.readAsText(file);
  });
}
