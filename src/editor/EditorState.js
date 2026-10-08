// Модель данных редактора: пак (3 лиги x треки), история undo/redo.
export class EditorState {
  constructor(leagues = null) {
    this.packName = "New pack";
    this.author = "";
    this.leagues = leagues ?? [[], [], []];
    this.league = 0;
    this.track = 0;
    this.undoStack = [];
    this.redoStack = [];
  }
  static blankTrack() {
    const points = [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: -24 },
      { x: 300, y: 0 }, { x: 420, y: 0 },
    ];
    const last = points[points.length - 1];
    return {
      name: "Track",
      // старт — на поверхности трассы; финиш — X-порог в конце (Y=0, как в .mrg)
      start: { x: 20, y: surfaceY({ points }, 20) },
      // порог финиша должен быть СТРОГО левее последней точки, иначе флаг
      // не найдётся (initPoints ищет точку с X > finish)
      finish: { x: last.x - 1, y: 0 },
      points,
    };
  }
  // T4.3 стартовые шаблоны: flat — плоская линия, hills — плавные холмы, sine — синусоида
  static templateTrack(kind) {
    const pts = [];
    const N = 8;
    for (let i = 0; i <= N; i++) {
      const x = i * 60;
      let y = 0;
      if (kind === "hills") {
        y = Math.round(48 * Math.sin((i / N) * Math.PI * 6)); // 3 периода, амплитуда 48 — холмистый профиль
      } else if (kind === "sine") {
        y = Math.round(30 * Math.sin((i / N) * Math.PI * 3)); // 1.5 периода, амплитуда 30 — плавная синусоида
      }
      pts.push({ x, y });
    }
    const last = pts[pts.length - 1];
    return {
      name: { flat: "Flat line", hills: "Hills", sine: "Sine wave" }[kind] || "Track",
      start: { x: 20, y: surfaceY({ points: pts }, 20) },
      finish: { x: last.x - 1, y: 0 },
      points: pts,
    };
  }
  static fromParsed(leagues, packName = "Imported pack") {
    const st = new EditorState(leagues);
    st.packName = packName;
    return st;
  }
  cur() {
    return this.leagues[this.league] ? this.leagues[this.league][this.track] : null;
  }
  ensureTrack() {
    if (!this.cur()) {
      this.leagues[this.league][this.track] = EditorState.blankTrack();
    }
    return this.cur();
  }
  select(league, track) {
    this.league = league;
    this.track = track;
    this.undoStack = [];
    this.redoStack = [];
  }
  snapshot() {
    const t = this.cur();
    if (!t) {
      return;
    }
    this.undoStack.push(JSON.stringify(t));
    if (this.undoStack.length > 50) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }
  undo() {
    const t = this.cur();
    if (!t || this.undoStack.length === 0) {
      return false;
    }
    this.redoStack.push(JSON.stringify(t));
    Object.assign(t, JSON.parse(this.undoStack.pop()));
    return true;
  }
  redo() {
    const t = this.cur();
    if (!t || this.redoStack.length === 0) {
      return false;
    }
    this.undoStack.push(JSON.stringify(t));
    Object.assign(t, JSON.parse(this.redoStack.pop()));
    return true;
  }
  // ограничения формата: X не убывает, старт не правее финиша
  validate(track = this.cur()) {
    const issues = [];
    if (!track) {
      return issues;
    }
    const pts = track.points;
    if (pts.length < 4) {
      issues.push("Fewer than 4 points");
    }
    // равный X у соседних точек допустим (вертикальные сегменты);
    // полные дубликаты не считаются ошибкой интерфейса — только console.warn при экспорте
    if (track.start.x >= track.finish.x) {
      issues.push("Start must be left of finish");
    }
    // мир Y вверх: нижний край колёс = start.y - 7.5; правило срабатывает,
    // когда он погружается ниже поверхности
    if (pts.length > 1) {
      const surf = surfaceY(track, track.start.x);
      if (track.start.y - 7.5 < surf - 0.5) {
        issues.push(`Start is below the track surface (bottom=${(track.start.y - 7.5).toFixed(1)}, surface=${surf.toFixed(1)})`);
      }
    }
    // старт/финиш должны лежать в пределах трассы (флаги выбираются порогами по X)
    if (pts.length > 0) {
      if (track.start.x <= pts[0].x || track.start.x >= pts[pts.length - 1].x) {
        issues.push("Start X should be inside the track span");
      }
      if (track.finish.x <= pts[0].x || track.finish.x >= pts[pts.length - 1].x) {
        issues.push("Finish X should be inside the track span");
      }
    }
    // флаги — зеркало размещения движка (prepareLevelGeometry):
    // стартовый флаг на точку следом за первой правее start.x, финишный — на первую правее finish.x
    let sfp = 0, ffp = 0;
    for (let i = 0; i < pts.length; i++) {
      if (sfp === 0 && pts[i].x > track.start.x) sfp = i + 1;
      if (ffp === 0 && pts[i].x > track.finish.x) ffp = i;
    }
    if (sfp > 0 && ffp > 0 && sfp < pts.length && ffp < pts.length) {
      if (sfp === ffp) {
        issues.push("Start and finish flags share the same point");
      } else if (sfp > ffp) {
        issues.push("Finish flag is to the left of the start flag");
      }
    }
    return issues;
  }
}

// Y поверхности трассы в точке x (линейная интерполяция между точками)
export function surfaceY(track, x) {
  const pts = track.points;
  if (pts.length === 0) {
    return 0;
  }
  if (x <= pts[0].x) {
    return pts[0].y;
  }
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i].x) {
      const a = pts[i - 1];
      const b = pts[i];
      const k = (x - a.x) / (b.x - a.x || 1);
      return a.y + (b.y - a.y) * k;
    }
  }
  return pts[pts.length - 1].y;
}

// клемп X точки между соседями (строго возрастающая последовательность)
export function clampPointX(track, idx, x) {
  const pts = track.points;
  const prev = idx > 0 ? pts[idx - 1].x : -Infinity;
  const next = idx < pts.length - 1 ? pts[idx + 1].x : Infinity;
  return Math.min(Math.max(x, prev), next);
}
