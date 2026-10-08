// Кодек .mrg — точное зеркало GameLevel.load / LevelLoader.create.
// Координаты файла = пиксели × 8192 (addPointSimple: v << 16 >> 3), значения signed.
//
// Трек:   int8 version (50 -> пропуск 20 байт) | i32 startX, startY | i32 finishX, finishY
//         | i16 pointsCount | точка[0]: i32 x, i32 y | далее: i8 dx, i8 dy (накопительные)
//         или i8(-1) + i32 x, i32 y (absolute).
// Пак:    по каждой из 3 лиг: i32 trackCount | per-track: i32 offset + 40 байт имени
//         (ASCII, пробелы <-> "_", NUL-дополнение); данные треков по offset.
//
// Писатель хранит точки >= 1 всегда как -1+absolute: дельта-кодирование формата
// покрывает ~0.015 px (бесполезно), а absolute валиден всегда и тривиально корректен.

const PX = 8192; // пиксель -> единица файла

class ByteReader {
  constructor(bytes, pos = 0) {
    this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = pos;
  }
  i8() { const v = this.dv.getInt8(this.pos); this.pos += 1; return v; }
  i16() { const v = this.dv.getInt16(this.pos); this.pos += 2; return v; }
  i32() { const v = this.dv.getInt32(this.pos); this.pos += 4; return v; }
  skip(n) { this.pos += n; }
  seek(p) { this.pos = p; }
  tell() { return this.pos; }
}

class ByteWriter {
  constructor() { this.parts = []; }
  i8(v) { const b = new Uint8Array(1); new DataView(b.buffer).setInt8(0, v); this.parts.push(b); return this; }
  i16(v) { const b = new Uint8Array(2); new DataView(b.buffer).setInt16(0, v); this.parts.push(b); return this; }
  i32(v) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, v); this.parts.push(b); return this; }
  bytes(arr) { this.parts.push(Uint8Array.from(arr)); return this; }
  length() { return this.parts.reduce((s, p) => s + p.length, 0); }
  toBytes() {
    const out = new Uint8Array(this.length());
    let off = 0;
    for (const p of this.parts) { out.set(p, off); off += p.length; }
    return out;
  }
}

// ЕДИНИЦЫ ФАЙЛА (подтверждено прогоном движка на дефолтном паке):
//  - точки трассы хранятся в ОБЫЧНЫХ пикселях (raw = px);
//  - start/finish хранятся как px*8192.
const toFile = (px) => Math.round(px * PX);
const toFilePoint = (px) => Math.round(px);

function encodeName(name) {
  const ascii = (name ?? "Track").replace(/ /g, "_");
  const out = [];
  for (let i = 0; i < Math.min(39, ascii.length); i++) {
    out.push(ascii.charCodeAt(i) & 0x7f);
  }
  out.push(0); // NUL-терминатор, без дополнения до 40 байт (как LevelLoader)
  return out;
}
const toPx = (file) => file / PX;

// ---------- трек ----------

export function parseTrack(bytes, offset = 0) {
  const r = new ByteReader(bytes, offset);
  const version = r.i8();
  if (version === 50) {
    r.skip(20);
  }
  // как getStartPosX/getFinishPosX: raw << 3 >> 16 (32-бит, truncation)
  const start = { x: r.i32() << 3 >> 16, y: r.i32() << 3 >> 16 };
  const finish = { x: r.i32() << 3 >> 16, y: r.i32() << 3 >> 16 };
  const count = r.i16();
  // count === 0 — пустая заглушка трека (такие пишут некоторые пак-генераторы);
  // движок грузит их без ошибок (цикл 0 раз) — не падаем, отдаём пустой трек
  if (count < 0 || count > 4096) {
    throw new Error("parseTrack: bad pointsCount " + count + " at " + offset);
  }
  // Игровой пайплайн (GameLevel.addPointSimple/getPointX) пропускает raw-значения
  // через 32-битные сдвиги <<16>>3 / <<3>>16: px = ((raw<<16>>3)<<3>>16).
  // Зеркалим посимпвольно — иначе absolute-точки с большими raw (паки GDTR)
  // редактор показывает мусором, хотя игра рендерит их корректно.
  // GameLevel.addPoint: движок молча выбрасывает точки, чей F16-X не строго
  // больше предыдущей сохранённой (prev < x). Зеркалим посимпвольно, иначе
  // редактор показывает точки, которых в игре не существует.
  const points = [];
  let accX = 0;
  let accY = 0;
  let prevSX = 0;
  for (let i = 0; i < count; i++) {
    if (i === 0) {
      accX = r.i32() | 0;
      accY = r.i32() | 0;
    } else {
      const b = r.i8();
      if (b === -1) {
        accX = r.i32() | 0;
        accY = r.i32() | 0;
      } else {
        accX = (accX + b) | 0;
        accY = (accY + r.i8()) | 0;
      }
    }
    const sX = (accX << 16 >> 3) | 0; // F16, как в addPointSimple
    const sY = (accY << 16 >> 3) | 0;
    if (points.length === 0 || prevSX < sX) {
      points.push({ x: (sX << 3 >> 16), y: (sY << 3 >> 16) });
      prevSX = sX;
    }
  }
  return { version, start, finish, points, end: r.tell() };
}

export function serializeTrack(track) {
  const w = new ByteWriter();
  w.i8(1); // version != 50 -> без расширенного заголовка
  w.i32(toFile(track.start.x));
  w.i32(toFile(track.start.y));
  w.i32(toFile(track.finish.x));
  w.i32(toFile(track.finish.y));
  const pts = track.points;
  w.i16(pts.length);
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) {
      w.i32(toFilePoint(pts[i].x));
      w.i32(toFilePoint(pts[i].y));
    } else {
      w.i8(-1);
      w.i32(toFilePoint(pts[i].x));
      w.i32(toFilePoint(pts[i].y));
    }
  }
  return w.toBytes();
}

// ---------- пак ----------

export function parsePack(bytes) {
  const r = new ByteReader(bytes);
  const leagues = [];
  for (let league = 0; league < 3; league++) {
    const count = r.i32();
    const entries = [];
    for (let i = 0; i < count; i++) {
      const offset = r.i32();
      // как в LevelLoader: имя читается ДО первого NUL, остаток 40-байтового
      // поля НЕ потребляется (фиксированного шага таблицы нет!)
      let name = "";
      for (let b = 0; b < 40; b++) {
        const c = r.i8();
        if (c === 0) {
          break;
        }
        name += String.fromCharCode(c & 0x7f);
      }
      name = name.replace(/_/g, " ");
      entries.push({ offset, name });
    }
    // Таблица может врать о числе записей (некоторые генераторы пишут count
    // больше реального и добивают нулями): идём, пока записи валидны,
    // на первой битой — обрезаем лигу (движок в таком месте десинхронится).
    const tracks = [];
    for (const e of entries) {
      try {
        const t = parseTrack(bytes, e.offset);
        tracks.push({ name: e.name, start: t.start, finish: t.finish, points: t.points });
      } catch {
        break;
      }
    }
    leagues.push(tracks);
  }
  return leagues;
}

export function serializePack(leagues) {
  // таблицы лиг идут первыми, данные треков — после; offset абсолютный
  const header = new ByteWriter();
  const bodies = [];
  for (let league = 0; league < 3; league++) {
    const tracks = leagues[league] ?? [];
    header.i32(tracks.length);
    for (const tr of tracks) {
      bodies.push(serializeTrack(tr));
      header.i32(0); // offset — заполним вторым проходом
      header.bytes(encodeName(tr.name));
    }
  }
  // второй проход: вычисляем offset'ы и пересобираем таблицу
  const headerLen = header.length();
  const offsets = [];
  let off = headerLen;
  for (const b of bodies) {
    offsets.push(off);
    off += b.length;
  }
  const w = new ByteWriter();
  let bodyIdx = 0;
  for (let league = 0; league < 3; league++) {
    const tracks = leagues[league] ?? [];
    w.i32(tracks.length);
    for (const tr of tracks) {
      w.i32(offsets[bodyIdx]);
      bodyIdx++;
      w.bytes(encodeName(tr.name));
    }
  }
  for (const b of bodies) {
    w.bytes(b);
  }
  return w.toBytes();
}
