import type { Song, BarChordChange, PitchClass } from "./types";
import {
  createDefaultSong,
  updateSongMeta,
  updateSongUi,
  addChunk,
  renameChunk,
  setChunkBarCount,
  duplicateChunk,
  deleteChunk,
  addArrangementItem,
  updateArrangementItem,
  moveArrangementItem,
  deleteArrangementItem,
  setBarLabel,
  setBarMelody,
  addChordChange,
  updateChordChange,
  deleteChordChange,
} from "./state";
import {
  saveAutosave,
  loadAutosave,
  clearAutosave,
  downloadSongJson,
  readSongFile,
} from "./storage";
import { renderApp, buildDerivedState } from "./render";
import type { AppHandlers } from "./render";
import "./styles.css";

let currentSong: Song = createDefaultSong();
let rootElement: HTMLElement | null = null;

function showError(message: string): void {
  const app = document.getElementById("app");
  if (!app) return;
  const banner = document.createElement("div");
  banner.className = "error-banner";
  banner.textContent = message;
  app.insertBefore(banner, app.firstChild);
  setTimeout(() => banner.remove(), 5000);
}

function getInitialSong(): Song {
  const result = loadAutosave();
  if (result.ok && result.value) {
    return result.value;
  }
  return createDefaultSong();
}

function setSong(nextSong: Song): void {
  currentSong = nextSong;
  saveAutosave(currentSong);
  rerender();
}

function dispatch(recipe: (song: Song) => Song): void {
  currentSong = recipe(currentSong);
  saveAutosave(currentSong);
  rerender();
}

function rerender(): void {
  if (!rootElement) return;
  const derived = buildDerivedState(currentSong);
  renderApp(rootElement, currentSong, derived, buildHandlers());
}

function buildHandlers(): AppHandlers {
  return {
    onSongMetaChange: (patch) => dispatch((song) => updateSongMeta(song, patch)),
    onUpdateUi: (patch) => dispatch((song) => updateSongUi(song, patch)),
    onAddChunk: () => dispatch((song) => addChunk(song)),
    onUpdateChunk: (chunkId, patch) =>
      dispatch((song) => {
        if (patch.name !== undefined) return renameChunk(song, chunkId, patch.name);
        if (patch.barCount !== undefined) return setChunkBarCount(song, chunkId, patch.barCount);
        return song;
      }),
    onDuplicateChunk: (chunkId) => dispatch((song) => duplicateChunk(song, chunkId)),
    onDeleteChunk: (chunkId) => dispatch((song) => deleteChunk(song, chunkId)),
    onAddArrangementItem: (chunkId) => dispatch((song) => addArrangementItem(song, chunkId)),
    onUpdateArrangementItem: (itemId, patch) =>
      dispatch((song) => updateArrangementItem(song, itemId, patch)),
    onMoveArrangementItem: (itemId, direction) =>
      dispatch((song) => moveArrangementItem(song, itemId, direction)),
    onDeleteArrangementItem: (itemId) =>
      dispatch((song) => deleteArrangementItem(song, itemId)),
    onSetBarLabel: (chunkId, barId, label) =>
      dispatch((song) => setBarLabel(song, chunkId, barId, label)),
    onSetBarMelody: (chunkId, barId, melodyPitchClass) =>
      dispatch((song) => setBarMelody(song, chunkId, barId, melodyPitchClass)),
    onAddChordChange: (chunkId, barId) =>
      dispatch((song) => addChordChange(song, chunkId, barId)),
    onUpdateChordChange: (chunkId, barId, changeId, patch) =>
      dispatch((song) => updateChordChange(song, chunkId, barId, changeId, patch)),
    onDeleteChordChange: (chunkId, barId, changeId) =>
      dispatch((song) => deleteChordChange(song, chunkId, barId, changeId)),
    onImportFile: async (file) => {
      const result = await readSongFile(file);
      if (result.ok) {
        setSong(result.value);
      } else {
        showError(result.errors.join("; "));
      }
    },
    onExport: () => downloadSongJson(currentSong),
    onResetSong: () => {
      clearAutosave();
      setSong(createDefaultSong());
    },
  };
}

export function initApp(): void {
  rootElement = document.getElementById("app");
  if (!rootElement) {
    console.error("#app not found");
    return;
  }
  currentSong = getInitialSong();
  rerender();
}

initApp();
