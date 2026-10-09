// Прямые файлы данных: паки и скины лежат отдельными файлами в data/,
// имена строгие — "<id>.mrg" / "<id>.zip", манифест не нужен.
// Миниатюры скинов — из папки data/thumbs по манифесту data/thumbs.json (см. SkinGallery).
const DATA_DIR = new URL("../data/", import.meta.url).href;

async function fetchFile(url, onProgress) {
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(url.slice(url.lastIndexOf("/") + 1) + ": HTTP " + r.status);
  }
  if (onProgress && r.body) {
    const total = Number(r.headers.get("content-length")) || 0;
    const reader = r.body.getReader();
    const chunks = [];
    let loaded = 0;
    for (;;) {
      const step = await reader.read();
      if (step.done) {
        break;
      }
      chunks.push(step.value);
      loaded += step.value.length;
      onProgress(loaded, total);
    }
    const out = new Uint8Array(loaded);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    return new Blob([out]);
  }
  return r.blob();
}

// единая коллекция паков: data/packs/<id>.mrg
export function fetchPackFile(id, onProgress) {
  return fetchFile(`${DATA_DIR}packs/${id}.mrg`, onProgress);
}

export function fetchSkinFile(id, onProgress) {
  return fetchFile(`${DATA_DIR}skins/${id}.zip`, onProgress);
}
