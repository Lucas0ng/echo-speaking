'use strict';
/* 跟读：语调曲线对比 + 每句跟读分数存档。界面在 app.js（class Shadow）。

Pitch comes from the server (/api/pitch for the learner's recording, /api/pitch/media for the original sentence):
f0 in Hz every 10 ms, null when unvoiced. For comparing two speakers, each contour is turned into semitones around its
own median (a man and a woman then sit on the same scale) and its voiced span is stretched to 0..1.

S.shadow[path][i] = [{ t, score }]   // every Whisper match score for sentence i of a lesson file, oldest first
*/
const PITCH = new Map(); // original sentence contours, path#s
function pitchOfSegment(path, s, e) {
  const key = path + '#' + s;
  if (!PITCH.has(key)) {
    const p = api('/api/pitch/media?path=' + encodeURIComponent(path) + '&s=' + s + '&e=' + e);
    p.catch(() => PITCH.delete(key));
    PITCH.set(key, p);
  }
  return PITCH.get(key);
}
async function pitchOfBlob(blob) {
  const fd = new FormData(); fd.append('audio', blob, 'rec' + extOf(blob));
  return api('/api/pitch', { method: 'POST', body: fd });
}
/* [{ x: 0..1, y: semitones from the median }] over the voiced span; unvoiced frames inside it are y: null (gaps). */
function pitchContour(f0) {
  const idx = (f0 || []).map((v, i) => (v ? i : -1)).filter(i => i >= 0);
  if (idx.length < 5) return [];
  const st = f0.map(v => (v ? 12 * Math.log2(v) : null)), vals = idx.map(i => st[i]).sort((a, b) => a - b), med = vals[vals.length >> 1];
  const a = idx[0], b = idx[idx.length - 1];
  return f0.slice(a, b + 1).map((v, k) => ({ x: (k) / Math.max(1, b - a), y: v ? st[a + k] - med : null }));
}
/* How the sentence ends: least-squares slope over the last 30% of the voiced span, in semitones across that stretch. */
function pitchEnd(points) {
  const tail = points.filter(p => p.y != null && p.x >= 0.7);
  if (tail.length < 5) return null;
  const n = tail.length, mx = tail.reduce((s, p) => s + p.x, 0) / n, my = tail.reduce((s, p) => s + p.y, 0) / n;
  const sxx = tail.reduce((s, p) => s + (p.x - mx) ** 2, 0), sxy = tail.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const slope = sxx ? (sxy / sxx) * 0.3 : 0; // semitones over the 0.3-wide tail
  return { slope: Math.round(slope * 10) / 10, dir: slope > 2 ? 'rise' : slope < -2 ? 'fall' : 'flat' };
}
const PITCH_DIR = { rise: '上扬 ↗', fall: '下降 ↘', flat: '持平 →' };
/* One line for the learner comparing sentence endings, or null when either side has too little voiced speech. */
function pitchVerdict(orig, mine) {
  const a = pitchEnd(orig), b = pitchEnd(mine);
  if (!a || !b) return null;
  const same = a.dir === b.dir;
  return { same, text: '句末：原声' + PITCH_DIR[a.dir] + '，你' + PITCH_DIR[b.dir] + (same ? '，一致。' : '，不一样，再听一遍原声的结尾。') };
}

/* ---------- 每句跟读分数 ---------- */
const shStore = () => S.shadow || (S.shadow = {});
function shRecord(path, i, score) { const p = shStore()[path] || (shStore()[path] = {}); (p[i] || (p[i] = [])).push({ t: Date.now(), score }); save(); }
const shHistory = (path, i) => shStore()[path]?.[i] || [];
/* Sentences of a file scored at least once, with the average of first and of latest scores. */
function shFileStats(path) {
  const rows = Object.values(shStore()[path] || {}).filter(h => h.length);
  if (!rows.length) return { n: 0, first: 0, last: 0 };
  const avg = a => Math.round(a.reduce((s, x) => s + x, 0) / a.length);
  return { n: rows.length, first: avg(rows.map(h => h[0].score)), last: avg(rows.map(h => h[h.length - 1].score)) };
}
