import type {
  Song,
  SongChunk,
  Bar,
  BarChordChange,
  PitchClass,
  BeatPosition,
  ChordKind,
  DerivedState,
  NoteOption,
  ChordOption,
} from "./types";
import {
  buildScale,
  getMelodyNoteOptions,
  buildChordOptions,
  filterChordOptions,
  findChordOption,
} from "./music";

const NOTE_NAMES: PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export type AppHandlers = {
  onSongMetaChange(patch: Partial<Pick<Song, "title" | "keyRoot" | "keyMode">>): void;
  onUpdateUi(patch: Partial<Song["ui"]>): void;
  onAddChunk(): void;
  onUpdateChunk(chunkId: string, patch: Partial<Pick<SongChunk, "name" | "barCount">>): void;
  onDuplicateChunk(chunkId: string): void;
  onDeleteChunk(chunkId: string): void;
  onAddArrangementItem(chunkId: string): void;
  onUpdateArrangementItem(itemId: string, patch: Partial<import("./types").ArrangementItem>): void;
  onMoveArrangementItem(itemId: string, direction: "up" | "down"): void;
  onDeleteArrangementItem(itemId: string): void;
  onSetBarLabel(chunkId: string, barId: string, label: string): void;
  onSetBarMelody(chunkId: string, barId: string, melodyPitchClass: PitchClass | null): void;
  onAddChordChange(chunkId: string, barId: string): void;
  onUpdateChordChange(
    chunkId: string,
    barId: string,
    changeId: string,
    patch: Partial<BarChordChange>
  ): void;
  onDeleteChordChange(chunkId: string, barId: string, changeId: string): void;
  onImportFile(file: File): void;
  onExport(): void;
  onResetSong(): void;
};

export function buildDerivedState(song: Song): DerivedState {
  const scale = buildScale(song.keyRoot, song.keyMode);
  const melodyNoteOptions = getMelodyNoteOptions(scale);
  const triadOptions = buildChordOptions(scale, "triad");
  const seventhOptions = buildChordOptions(scale, "seventh");
  const chunkById = new Map<string, SongChunk>();
  for (const chunk of song.chunkLibrary) chunkById.set(chunk.id, chunk);
  return {
    scale,
    melodyNoteOptions,
    triadOptions,
    seventhOptions,
    chunkById,
  };
}

export function renderApp(
  root: HTMLElement,
  song: Song,
  derived: DerivedState,
  handlers: AppHandlers
): void {
  const active = document.activeElement;
  let focusKey: string | null = null;
  let selectionStart: number | null = null;
  let selectionEnd: number | null = null;
  if (active && active instanceof HTMLElement) {
    focusKey = active.getAttribute("data-focus-key");
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      selectionStart = active.selectionStart;
      selectionEnd = active.selectionEnd;
    }
  }

  root.innerHTML = "";
  const header = renderSongHeader(song, handlers);
  const arrangement = renderArrangement(song, derived, handlers);
  const library = renderChunkLibrary(song, derived, handlers);
  const readOnly = renderReadOnlySong(song, derived);
  root.appendChild(header);
  root.appendChild(arrangement);
  root.appendChild(library);
  root.appendChild(readOnly);

  if (focusKey) {
    const next = root.querySelector(`[data-focus-key="${focusKey}"]`);
    if (next && next instanceof HTMLElement) {
      next.focus();
      if (
        (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) &&
        selectionStart !== null &&
        selectionEnd !== null
      ) {
        next.setSelectionRange(selectionStart, selectionEnd);
      }
    }
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Record<string, unknown>,
  children?: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (props) {
    for (const key in props) {
      const val = props[key];
      if (key === "className" && typeof val === "string") {
        element.className = val;
      } else if (key.startsWith("on") && typeof val === "function") {
        const eventName = key.slice(2).toLowerCase();
        (element as unknown as Record<string, unknown>)[`on${eventName}`] = val;
      } else if (key === "style" && typeof val === "string") {
        element.setAttribute("style", val);
      } else if (key === "textContent" && typeof val === "string") {
        element.textContent = val;
      } else if (key === "selected" && typeof val === "boolean") {
        (element as unknown as HTMLOptionElement).selected = val;
      } else if (key === "disabled" && typeof val === "boolean") {
        (element as unknown as HTMLOptionElement).disabled = val;
      } else if (key.startsWith("data-") && typeof val === "string") {
        element.setAttribute(key, val);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (element as any)[key] = val;
      }
    }
  }
  if (children) {
    for (const child of children) {
      element.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
  }
  return element;
}

export function renderSongHeader(song: Song, handlers: AppHandlers): HTMLElement {
  const container = el("div", { className: "song-header" });

  const titleInput = el("input", {
    className: "title-input",
    type: "text",
    value: song.title,
    "data-focus-key": "song-title",
    onInput: (e: Event) => {
      const target = e.target as HTMLInputElement;
      handlers.onSongMetaChange({ title: target.value });
    },
  });

  const rootSelect = el("select", { "data-focus-key": "song-keyRoot" }, [
    el("option", { value: "", textContent: "Key Root", disabled: true }),
    ...(
      ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"] as const
    ).map((n) =>
      el("option", { value: n, textContent: n, selected: song.keyRoot === n })
    ),
  ]);
  rootSelect.addEventListener("change", () => {
    handlers.onSongMetaChange({ keyRoot: rootSelect.value as Song["keyRoot"] });
  });

  const modeSelect = el("select", { "data-focus-key": "song-keyMode" }, [
    el("option", { value: "", textContent: "Mode", disabled: true }),
    el("option", { value: "major", textContent: "Major", selected: song.keyMode === "major" }),
    el("option", { value: "natural-minor", textContent: "Natural Minor", selected: song.keyMode === "natural-minor" }),
    el("option", { value: "harmonic-minor", textContent: "Harmonic Minor", selected: song.keyMode === "harmonic-minor" }),
    el("option", { value: "melodic-minor", textContent: "Melodic Minor", selected: song.keyMode === "melodic-minor" }),
  ]);
  modeSelect.addEventListener("change", () => {
    handlers.onSongMetaChange({ keyMode: modeSelect.value as Song["keyMode"] });
  });

  container.appendChild(titleInput);
  container.appendChild(rootSelect);
  container.appendChild(modeSelect);

  const actions = el("div", { className: "header-actions" });

  const importLabel = el("label", { className: "btn btn-small" }, ["Import JSON"]);
  const importInput = el("input", { type: "file", accept: ".json,application/json", style: "display:none" });
  importInput.addEventListener("change", () => {
    const file = importInput.files?.[0];
    if (file) handlers.onImportFile(file);
    importInput.value = "";
  });
  importLabel.appendChild(importInput);

  actions.appendChild(importLabel);
  actions.appendChild(el("button", { className: "btn btn-small", onClick: handlers.onExport }, ["Export JSON"]));
  actions.appendChild(el("button", { className: "btn btn-small", onClick: handlers.onAddChunk }, ["Add Chunk"]));
  actions.appendChild(el("button", { className: "btn btn-small", onClick: handlers.onResetSong }, ["New Song"]));

  const wrapper = el("div");
  wrapper.appendChild(container);
  wrapper.appendChild(actions);
  return wrapper;
}

export function renderArrangement(
  song: Song,
  derived: DerivedState,
  handlers: AppHandlers
): HTMLElement {
  const section = el("div", { className: "section" });
  section.appendChild(el("h2", { className: "section-title", textContent: "Arrangement" }));

  const list = el("div", { className: "arrangement-list" });

  if (song.arrangement.length === 0) {
    list.appendChild(el("p", { textContent: "No sections yet. Add a chunk and then add it to the arrangement." }));
  }

  for (const item of song.arrangement) {
    const chunk = derived.chunkById.get(item.chunkId);
    const itemEl = el("div", { className: "arrangement-item" });

    const labelInput = el("input", {
      type: "text",
      placeholder: "Label",
      value: item.label,
      "data-focus-key": `arr-label-${item.id}`,
      onInput: (e: Event) => {
        handlers.onUpdateArrangementItem(item.id, {
          label: (e.target as HTMLInputElement).value,
        });
      },
    });

    const chunkSelect = el("select", { "data-focus-key": `arr-chunk-${item.id}` }, [
      el("option", { value: "", textContent: "Select chunk...", disabled: true, selected: !chunk }),
      ...song.chunkLibrary.map((c) =>
        el("option", { value: c.id, textContent: c.name, selected: c.id === item.chunkId })
      ),
    ]);
    chunkSelect.addEventListener("change", () => {
      handlers.onUpdateArrangementItem(item.id, { chunkId: chunkSelect.value });
    });

    const repeatInput = el("input", {
      type: "number",
      min: "1",
      value: String(item.repeatCount),
      "data-focus-key": `arr-repeat-${item.id}`,
      onInput: (e: Event) => {
        const val = parseInt((e.target as HTMLInputElement).value, 10);
        handlers.onUpdateArrangementItem(item.id, { repeatCount: Number.isNaN(val) ? 1 : val });
      },
    });

    const upBtn = el("button", { className: "btn btn-small", textContent: "Up" });
    upBtn.addEventListener("click", () => handlers.onMoveArrangementItem(item.id, "up"));

    const downBtn = el("button", { className: "btn btn-small", textContent: "Down" });
    downBtn.addEventListener("click", () => handlers.onMoveArrangementItem(item.id, "down"));

    const delBtn = el("button", { className: "btn btn-small btn-danger", textContent: "Delete" });
    delBtn.addEventListener("click", () => handlers.onDeleteArrangementItem(item.id));

    itemEl.appendChild(labelInput);
    itemEl.appendChild(chunkSelect);
    itemEl.appendChild(repeatInput);
    itemEl.appendChild(upBtn);
    itemEl.appendChild(downBtn);
    itemEl.appendChild(delBtn);
    list.appendChild(itemEl);
  }

  section.appendChild(list);

  const addBtn = el("button", { className: "btn btn-primary btn-small", textContent: "Add Arrangement Item" });
  addBtn.addEventListener("click", () => {
    const firstChunk = song.chunkLibrary[0];
    handlers.onAddArrangementItem(firstChunk ? firstChunk.id : "");
  });
  section.appendChild(addBtn);

  return section;
}

export function renderChunkLibrary(
  song: Song,
  derived: DerivedState,
  handlers: AppHandlers
): HTMLElement {
  const section = el("div", { className: "section" });
  section.appendChild(el("h2", { className: "section-title", textContent: "Chunk Library" }));

  const library = el("div", { className: "chunk-library" });

  for (const chunk of song.chunkLibrary) {
    library.appendChild(renderChunk(chunk, song, derived, handlers));
  }

  section.appendChild(library);
  return section;
}

export function renderChunk(
  chunk: SongChunk,
  song: Song,
  derived: DerivedState,
  handlers: AppHandlers
): HTMLElement {
  const isCollapsed = song.ui.collapsedChunkIds.includes(chunk.id);
  const chunkEl = el("div", { className: `chunk${isCollapsed ? " collapsed" : ""}` });

  const header = el("div", { className: "chunk-header" });
  const toggle = el("span", { className: "chunk-toggle", textContent: isCollapsed ? "▶" : "▼" });
  toggle.addEventListener("click", () => {
    const nextCollapsed = isCollapsed
      ? song.ui.collapsedChunkIds.filter((id) => id !== chunk.id)
      : [...song.ui.collapsedChunkIds, chunk.id];
    handlers.onUpdateUi({ collapsedChunkIds: nextCollapsed });
  });

  const nameInput = el("input", {
    type: "text",
    value: chunk.name,
    "data-focus-key": `chunk-name-${chunk.id}`,
    onInput: (e: Event) => {
      handlers.onUpdateChunk(chunk.id, { name: (e.target as HTMLInputElement).value });
    },
  });

  const barCountSelect = el("select", { "data-focus-key": `chunk-bars-${chunk.id}` }, [
    ...Array.from({ length: 16 }, (_, i) => i + 1).map((n) =>
      el("option", { value: String(n), textContent: `${n} bars`, selected: n === chunk.barCount })
    ),
  ]);
  barCountSelect.addEventListener("change", () => {
    handlers.onUpdateChunk(chunk.id, { barCount: parseInt(barCountSelect.value, 10) });
  });

  const dupBtn = el("button", { className: "btn btn-small", textContent: "Duplicate" });
  dupBtn.addEventListener("click", () => handlers.onDuplicateChunk(chunk.id));

  const delBtn = el("button", { className: "btn btn-small btn-danger", textContent: "Delete" });
  delBtn.addEventListener("click", () => handlers.onDeleteChunk(chunk.id));

  header.appendChild(toggle);
  header.appendChild(nameInput);
  header.appendChild(barCountSelect);
  header.appendChild(dupBtn);
  header.appendChild(delBtn);
  chunkEl.appendChild(header);

  const body = el("div", { className: "chunk-body" });
  const barsEl = el("div", { className: "bars" });
  for (const bar of chunk.bars) {
    barsEl.appendChild(renderBar(chunk, bar, song, derived, handlers));
  }
  body.appendChild(barsEl);
  chunkEl.appendChild(body);

  return chunkEl;
}

export function renderBar(
  chunk: SongChunk,
  bar: Bar,
  song: Song,
  derived: DerivedState,
  handlers: AppHandlers
): HTMLElement {
  const barIdx = chunk.bars.findIndex((b) => b.id === bar.id);
  const barEl = el("div", { className: "bar" });

  const header = el("div", { className: "bar-header" });
  header.appendChild(el("span", { className: "bar-number", textContent: `Bar ${barIdx + 1}` }));

  const labelInput = el("input", {
    type: "text",
    placeholder: "Label",
    value: bar.label,
    "data-focus-key": `bar-label-${bar.id}`,
    onInput: (e: Event) => {
      handlers.onSetBarLabel(chunk.id, bar.id, (e.target as HTMLInputElement).value);
    },
  });

  const melodySelect = el("select", { "data-focus-key": `bar-melody-${bar.id}` }, [
    el("option", { value: "", textContent: "Melody: None", selected: bar.melodyPitchClass === null }),
    ...derived.melodyNoteOptions.map((opt) =>
      el("option", {
        value: String(opt.value),
        textContent: opt.label,
        selected: bar.melodyPitchClass === opt.value,
      })
    ),
  ]);
  melodySelect.addEventListener("change", () => {
    const val = melodySelect.value;
    handlers.onSetBarMelody(chunk.id, bar.id, val === "" ? null : (parseInt(val, 10) as PitchClass));
  });

  header.appendChild(labelInput);
  header.appendChild(melodySelect);
  barEl.appendChild(header);

  const changesEl = el("div", { className: "chord-changes" });
  for (const change of bar.chords) {
    changesEl.appendChild(renderChordChange(chunk, bar, change, song, derived, handlers));
  }
  barEl.appendChild(changesEl);

  const addBtn = el("button", { className: "btn btn-small", textContent: "+ Chord" });
  addBtn.addEventListener("click", () => handlers.onAddChordChange(chunk.id, bar.id));
  barEl.appendChild(addBtn);

  return barEl;
}

export function renderChordChange(
  chunk: SongChunk,
  bar: Bar,
  change: BarChordChange,
  song: Song,
  derived: DerivedState,
  handlers: AppHandlers
): HTMLElement {
  const options = change.chordKind === "seventh" ? derived.seventhOptions : derived.triadOptions;
  const filtered = filterChordOptions(options, bar.melodyPitchClass);
  const selected = findChordOption(options, change.degree);

  const row = el("div", { className: "chord-change" });

  const beatSelect = el("select", { "data-focus-key": `chord-beat-${change.id}` }, [
    ...([1, 2, 3, 4] as BeatPosition[]).map((b) =>
      el("option", { value: String(b), textContent: `Beat ${b}`, selected: change.beat === b })
    ),
  ]);
  beatSelect.addEventListener("change", () => {
    handlers.onUpdateChordChange(chunk.id, bar.id, change.id, {
      beat: parseInt(beatSelect.value, 10) as BeatPosition,
    });
  });

  const kindSelect = el("select", { "data-focus-key": `chord-kind-${change.id}` }, [
    el("option", { value: "triad", textContent: "Triad", selected: change.chordKind === "triad" }),
    el("option", { value: "seventh", textContent: "Seventh", selected: change.chordKind === "seventh" }),
  ]);
  kindSelect.addEventListener("change", () => {
    handlers.onUpdateChordChange(chunk.id, bar.id, change.id, {
      chordKind: kindSelect.value as ChordKind,
    });
  });

  const chordSelect = el("select", { "data-focus-key": `chord-degree-${change.id}` }, [
    el("option", { value: "", textContent: "Select chord...", disabled: true, selected: change.degree === null }),
    ...filtered.map((opt) =>
      el("option", {
        value: String(opt.degree),
        textContent: opt.displayLabel,
        selected: change.degree === opt.degree,
      })
    ),
  ]);
  chordSelect.addEventListener("change", () => {
    const val = chordSelect.value;
    handlers.onUpdateChordChange(chunk.id, bar.id, change.id, {
      degree: val === "" ? null : (parseInt(val, 10) as import("./types").ScaleDegree),
    });
  });

  const info = el("span", { className: "chord-info" });
  if (selected) {
    info.appendChild(el("span", { className: "chord-name", textContent: selected.name }));
    info.appendChild(el("span", { className: "chord-tones", textContent: selected.tones.map((t) => t.label).join(" ") }));
  } else {
    info.appendChild(el("span", { textContent: "—" }));
  }

  const clearBtn = el("button", { className: "btn btn-small", textContent: "Clear" });
  clearBtn.addEventListener("click", () => {
    handlers.onUpdateChordChange(chunk.id, bar.id, change.id, { degree: null });
  });

  const delBtn = el("button", { className: "btn btn-small btn-danger", textContent: "×" });
  delBtn.addEventListener("click", () => {
    handlers.onDeleteChordChange(chunk.id, bar.id, change.id);
  });

  row.appendChild(beatSelect);
  row.appendChild(kindSelect);
  row.appendChild(chordSelect);
  row.appendChild(info);
  row.appendChild(clearBtn);
  row.appendChild(delBtn);

  return row;
}

export function renderReadOnlySong(song: Song, derived: DerivedState): HTMLElement {
  const section = el("div", { className: "section read-only" });
  section.appendChild(el("h2", { className: "section-title", textContent: "Song View" }));

  const meta = el("div", { className: "ro-meta" });
  meta.appendChild(el("div", { className: "ro-title", textContent: song.title }));
  meta.appendChild(el("div", { className: "ro-key", textContent: `${song.keyRoot} ${song.keyMode}` }));
  section.appendChild(meta);

  if (song.arrangement.length === 0) {
    section.appendChild(el("p", { textContent: "No arrangement." }));
    return section;
  }

  const arrList = el("ol", { className: "ro-arrangement" });
  for (const item of song.arrangement) {
    const chunk = derived.chunkById.get(item.chunkId);
    const li = el("li", { className: "ro-arr-item" });
    const name = chunk ? chunk.name : "Unknown";
    const repeat = item.repeatCount > 1 ? ` (×${item.repeatCount})` : "";
    const label = item.label ? ` — ${item.label}` : "";
    li.appendChild(el("span", { className: "ro-arr-name", textContent: `${name}${repeat}${label}` }));
    arrList.appendChild(li);
  }
  section.appendChild(arrList);

  const chunksUsed = new Set(song.arrangement.map((i) => i.chunkId));
  for (const chunk of song.chunkLibrary) {
    if (!chunksUsed.has(chunk.id)) continue;

    const chunkSection = el("div", { className: "ro-chunk" });
    chunkSection.appendChild(el("h3", { className: "ro-chunk-name", textContent: chunk.name }));

    const barsGrid = el("div", { className: "ro-bars" });
    for (let i = 0; i < chunk.bars.length; i++) {
      const bar = chunk.bars[i];
      const barEl = el("div", { className: "ro-bar" });
      const num = el("span", { className: "ro-bar-num", textContent: String(i + 1) });

      const labelEl = bar.label ? el("span", { className: "ro-bar-label", textContent: bar.label }) : null;
      const melody = bar.melodyPitchClass !== null
        ? derived.melodyNoteOptions.find((o) => o.value === bar.melodyPitchClass)
        : null;
      const melodyEl = melody ? el("span", { className: "ro-bar-melody", textContent: melody.label }) : null;

      const beatsRow = el("div", { className: "ro-beats" });
      for (let beat = 1; beat <= 4; beat++) {
        const ch = bar.chords.find((c) => c.beat === beat);
        let text = "";
        if (ch) {
          const opt = findChordOption(
            ch.chordKind === "seventh" ? derived.seventhOptions : derived.triadOptions,
            ch.degree
          );
          text = opt ? opt.name : "";
        }
        beatsRow.appendChild(el("div", { className: "ro-beat-cell", textContent: text }));
      }

      barEl.appendChild(num);
      if (labelEl) barEl.appendChild(labelEl);
      if (melodyEl) barEl.appendChild(melodyEl);
      barEl.appendChild(beatsRow);
      barsGrid.appendChild(barEl);
    }
    chunkSection.appendChild(barsGrid);
    section.appendChild(chunkSection);
  }

  return section;
}
