// Fichiers de la bibliothèque : stockés dans Firestore, découpés en morceaux de 512 Ko
// (gratuit, sans carte bancaire). Aperçu, téléchargement, import Word/PDF.
import { esc } from "./core.js";
import { modal } from "./ui.js";

export const MAX_FILE = 15 * 1024 * 1024;
const CHUNK = 512 * 1024;

export const fmtSize = n => n == null ? "" : n < 1024 ? n + " o" : n < 1048576 ? Math.round(n / 1024) + " Ko" : (n / 1048576).toFixed(1).replace(".", ",") + " Mo";
export function fileKind(name = "", type = "") {
  const e = name.split(".").pop().toLowerCase();
  if (e === "pdf" || type === "application/pdf") return "pdf";
  if (/^(docx?|odt|rtf)$/.test(e)) return "doc";
  if (/^(xlsx?|ods|csv)$/.test(e)) return "sheet";
  if (/^(pptx?|odp|key)$/.test(e)) return "slides";
  if (/^image\//.test(type) || /^(png|jpe?g|gif|webp|svg|heic)$/.test(e)) return "image";
  if (/^audio\//.test(type) || /^(mp3|m4a|wav|ogg|aac)$/.test(e)) return "audio";
  if (/^video\//.test(type) || /^(mp4|mov|webm|m4v)$/.test(e)) return "video";
  if (/^(txt|md)$/.test(e)) return "text";
  if (/^(zip|rar|7z)$/.test(e)) return "zip";
  return "other";
}
export const kindIcon = k => ({ pdf: "📕", doc: "📘", sheet: "📗", slides: "📙", image: "🖼️", audio: "🎧", video: "🎬", text: "📄", zip: "🗜️", other: "📎", folder: "📁", lesson: "🎓" }[k] || "📎");
export const kindName = k => ({ pdf: "PDF", doc: "Document Word", sheet: "Tableur", slides: "Présentation", image: "Image", audio: "Audio", video: "Vidéo", text: "Texte", zip: "Archive", other: "Fichier", folder: "Dossier" }[k] || "Fichier");

const toB64 = blob => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => ko(r.error); r.readAsDataURL(blob); });

// Envoie un fichier. meta = { name, folder, students }. onProgress(0..1)
export async function uploadFile(api, file, meta, onProgress = () => {}) {
  if (file.size > MAX_FILE) throw new Error(`« ${file.name} » dépasse ${fmtSize(MAX_FILE)}. Compressez-le ou mettez-le sur Google Drive (lien dans une leçon).`);
  const id = api.newId("files");
  const n = Math.max(1, Math.ceil(file.size / CHUNK));
  for (let i = 0; i < n; i++) {
    await api.set(`files/${id}/chunks/${i}`, { d: await toB64(file.slice(i * CHUNK, (i + 1) * CHUNK)) }, false);
    onProgress((i + 1) / n);
  }
  const doc = { name: meta.name || file.name, folder: meta.folder || null, type: file.type || "", size: file.size, chunks: n, students: meta.students || [], createdAt: Date.now(), updatedAt: Date.now() };
  await api.set("files/" + id, doc, false);
  return { id, ...doc };
}
export async function deleteFile(api, f) {
  for (let i = 0; i < (f.chunks || 0); i++) await api.del(`files/${f.id}/chunks/${i}`);
  await api.del("files/" + f.id);
}
const cache = new Map();
export async function fileBlob(api, f) {
  if (cache.has(f.id)) return cache.get(f.id);
  const parts = await Promise.all(Array.from({ length: f.chunks || 0 }, (_, i) => api.get(`files/${f.id}/chunks/${i}`)));
  const bins = parts.map(p => Uint8Array.from(atob(p?.d || ""), c => c.charCodeAt(0)));
  const blob = new Blob(bins, { type: f.type || "application/octet-stream" });
  if (cache.size > 12) cache.delete(cache.keys().next().value);
  cache.set(f.id, blob);
  return blob;
}
export async function downloadFile(api, f) {
  const url = URL.createObjectURL(await fileBlob(api, f));
  const a = document.createElement("a"); a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Ouvre un fichier dans une visionneuse plein écran.
export async function previewFile(api, f) {
  const k = fileKind(f.name, f.type);
  const m = modal({ title: `${kindIcon(k)} ${esc(f.name)}`, wide: true, body: `<p class="mute center" style="padding:40px 0">Ouverture…</p>`, buttons: [{ label: "⬇️ Télécharger", act: () => { downloadFile(api, f); return false; } }, { label: "Fermer", primary: true }] });
  try {
    const blob = await fileBlob(api, f), url = URL.createObjectURL(blob);
    m.onClose(() => setTimeout(() => URL.revokeObjectURL(url), 1000));
    let h;
    if (k === "pdf") h = await pdfPages(blob);
    else if (k === "image") h = `<img src="${url}" style="max-width:100%;display:block;margin:auto">`;
    else if (k === "audio") h = `<audio controls src="${url}" style="width:100%"></audio>`;
    else if (k === "video") h = `<video controls src="${url}" style="width:100%;max-height:70vh"></video>`;
    else if (k === "text") h = `<pre style="white-space:pre-wrap">${esc(await blob.text())}</pre>`;
    else if (k === "doc" && /\.docx$/i.test(f.name)) h = `<div class="course">${await docxToHtml(blob)}</div>`;
    else h = `<div class="center" style="padding:30px 0"><div class="big">${kindIcon(k)}</div><p>Ce type de fichier (${kindName(k)}) ne s'affiche pas ici.</p><p>Téléchargez-le pour l'ouvrir avec l'application habituelle.</p></div>`;
    m.setBody(h);
  } catch (e) { m.setBody(`<div class="warn">Impossible d'ouvrir le fichier : ${esc(e.message || e)}</div>`); }
}
// PDF affiché page par page (fonctionne aussi sur iPhone/iPad, contrairement à un cadre PDF)
async function pdfPages(blob) {
  const pdfjs = await pdfLib();
  const doc = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
  const wrap = document.createElement("div");
  const max = Math.min(doc.numPages, 60);
  for (let n = 1; n <= max; n++) {
    const page = await doc.getPage(n), vp0 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: Math.min(2, 1400 / vp0.width) });
    const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
    c.style.cssText = "width:100%;height:auto;display:block;margin:0 auto 10px;box-shadow:0 1px 6px rgba(0,0,0,.15);background:#fff";
    await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    wrap.appendChild(c);
  }
  if (doc.numPages > max) wrap.insertAdjacentHTML("beforeend", `<p class="mute center">… ${doc.numPages - max} pages de plus : téléchargez le fichier pour tout voir.</p>`);
  return wrap;
}

/* ---------- conversion Word / PDF en leçon ---------- */
const loadScript = src => new Promise((ok, ko) => { if ([...document.scripts].some(s => s.src === src)) return ok(); const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => ko(new Error("Impossible de charger un outil en ligne (connexion internet ?)")); document.head.appendChild(s); });
let _pdf;
async function pdfLib() {
  if (_pdf) return _pdf;
  const base = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/";
  _pdf = await import(base + "pdf.min.mjs");
  try {
    // Le « worker » passe par une adresse blob: pour fonctionner partout
    const src = await (await fetch(base + "pdf.worker.min.mjs")).text();
    _pdf.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
  } catch (e) { _pdf.GlobalWorkerOptions.workerSrc = base + "pdf.worker.min.mjs"; }
  return _pdf;
}
export async function fileToHtml(f) {
  const ext = (f.name || "").split(".").pop().toLowerCase();
  if (ext === "docx") return docxToHtml(f);
  if (ext === "pdf") return pdfToHtml(f);
  if (ext === "html" || ext === "htm") return cleanHtml(await f.text());
  if (ext === "txt" || ext === "md") return (await f.text()).split(/\n\s*\n/).map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  if (ext === "doc") throw new Error("Ancien format .doc : ouvrez-le dans Word et enregistrez-le en .docx.");
  throw new Error("Format non pris en charge pour une leçon : ." + ext + " (utilisez .docx ou .pdf)");
}
export async function docxToHtml(f) {
  await loadScript("https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js");
  const mm = window.mammoth;
  const res = await mm.convertToHtml({ arrayBuffer: await f.arrayBuffer() }, {
    styleMap: ["p[style-name='Title'] => h3:fresh", "p[style-name='Titre'] => h3:fresh", "p[style-name='Heading 1'] => h3:fresh", "p[style-name='Heading 2'] => h3:fresh", "p[style-name='Titre 1'] => h3:fresh", "p[style-name='Titre 2'] => h3:fresh"],
    convertImage: mm.images.imgElement(async img => {
      try { const b64 = await img.read("base64"); const blob = await (await fetch(`data:${img.contentType};base64,${b64}`)).blob(); return { src: await compressImage(blob) }; }
      catch (e) { return { src: "" }; }
    }),
  });
  return cleanHtml(res.value);
}
export async function pdfToHtml(f, askScan) {
  const pdfjs = await pdfLib();
  const doc = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
  let html = "", chars = 0;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n), tc = await page.getTextContent();
    const lines = [];
    for (const it of tc.items) {
      if (!it.str) continue;
      const y = Math.round(it.transform[5]), h = Math.abs(it.transform[3]) || 10;
      let L = lines.find(l => Math.abs(l.y - y) < h * .5);
      if (!L) lines.push(L = { y, h, parts: [] });
      L.parts.push({ x: it.transform[4], s: it.str }); L.h = Math.max(L.h, h);
    }
    lines.sort((a, b) => b.y - a.y);
    const hs = lines.map(l => l.h).sort((a, b) => a - b), med = hs[hs.length >> 1] || 10;
    let para = [], prevY = null;
    const flush = () => { if (para.length) { html += `<p>${esc(para.join(" ")).replace(/\s+/g, " ")}</p>`; para = []; } };
    for (const l of lines) {
      const txt = l.parts.sort((a, b) => a.x - b.x).map(p => p.s).join(" ").replace(/\s+/g, " ").trim(); if (!txt) continue;
      chars += txt.length;
      if (l.h > med * 1.25 && txt.length < 90) { flush(); html += `<h3>${esc(txt)}</h3>`; prevY = l.y; continue; }
      if (prevY != null && prevY - l.y > l.h * 1.8) flush();
      if (/^[•\-–▪●]\s/.test(txt)) { flush(); html += `<p>• ${esc(txt.replace(/^[•\-–▪●]\s*/, ""))}</p>`; }
      else para.push(txt);
      prevY = l.y;
    }
    flush();
  }
  if (chars < 20) {
    html = "";
    for (let n = 1; n <= Math.min(doc.numPages, 6); n++) {
      const page = await doc.getPage(n), vp0 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: Math.min(2, 850 / vp0.width) });
      const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      html += `<p><img src="${c.toDataURL("image/jpeg", .6)}" alt="Page ${n}"></p>`;
    }
  }
  return html;
}
export async function compressImage(blob, max = 900) {
  const url = URL.createObjectURL(blob), img = new Image();
  try {
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = url; });
    const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", .72);
  } finally { URL.revokeObjectURL(url); }
}
// Nettoie le HTML (Word, collage…) : garde la structure, retire scripts, styles et attributs inutiles.
export function cleanHtml(h) {
  const d = document.createElement("div"); d.innerHTML = h;
  d.querySelectorAll("script,style,meta,link,iframe,object,embed,o\\:p").forEach(e => e.remove());
  d.querySelectorAll("h1,h2").forEach(e => { const n = document.createElement("h3"); n.innerHTML = e.innerHTML; e.replaceWith(n); });
  const keepAttr = { A: ["href", "target"], IMG: ["src", "alt"], TD: ["colspan", "rowspan"], TH: ["colspan", "rowspan"], BUTTON: ["data-say"], SPAN: ["data-say"], DIV: ["data-file", "data-name"] };
  const keepClass = ["say", "note", "model", "fr", "letters", "map", "road", "sq", "you", "scroll", "small", "aplayer"];
  d.querySelectorAll("*").forEach(e => {
    for (const a of [...e.attributes]) {
      if (a.name === "class") { const k = a.value.split(/\s+/).filter(c => keepClass.includes(c)); k.length ? e.setAttribute("class", k.join(" ")) : e.removeAttribute("class"); continue; }
      if (!(keepAttr[e.tagName] || []).includes(a.name)) e.removeAttribute(a.name);
    }
    if (e.tagName === "A") { if (!/^https?:|^mailto:/.test(e.getAttribute("href") || "")) e.removeAttribute("href"); e.setAttribute("target", "_blank"); }
    if (e.tagName === "IMG" && !/^data:image\/|^https:/.test(e.getAttribute("src") || "")) e.remove();
  });
  d.querySelectorAll("p").forEach(p => { if (!p.textContent.trim() && !p.querySelector("img")) p.remove(); });
  return d.innerHTML.trim();
}

/* ---------- vocabulaire : lecture d'une liste collée ou d'un fichier ---------- */
// Séparateurs reconnus, du plus fiable au moins fiable
const SEPS = [/\t+/, /\s*;\s*/, /\s*\|\s*/, /\s+=\s+|\s*=\s*/, /\s+[–—]\s+/, /\s+-\s+/, /\s+:\s+/];
const HEADER = /^(espagnol|español|espanol|spanish|mot|fran[cç]ais|french|traduction)\b/i;
export function parseVocabText(text) {
  const rows = [], bad = [];
  String(text || "").split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/^\s*(?:[•●▪◦\-*]|\d+[.)])\s+/, "").trim(); // puces et numéros
    if (!line) return;
    let cells = null;
    for (const s of SEPS) { const c = line.split(s).map(x => x.trim()).filter(Boolean); if (c.length >= 2) { cells = c; break; } }
    if (!cells) { bad.push(raw.trim()); return; }
    if (i === 0 && HEADER.test(cells[0]) && HEADER.test(cells[1] || "")) return; // ligne d'en-tête
    const ph = (cells[2] || "").replace(/^\[|\]$/g, "");
    rows.push([cells[0], cells[1], ph]);
  });
  return { rows, bad };
}
// Excel / CSV / Word / texte → lignes séparées par des tabulations
export async function vocabFileToText(f) {
  const ext = (f.name || "").split(".").pop().toLowerCase();
  if (/^(xlsx|xls|ods)$/.test(ext)) {
    await loadScript("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js");
    const wb = window.XLSX.read(await f.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return window.XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }).map(r => r.map(c => String(c ?? "").trim()).join("\t")).join("\n");
  }
  if (ext === "csv") { const t = await f.text(); const sep = (t.split("\n")[0].match(/;/g) || []).length > (t.split("\n")[0].match(/,/g) || []).length ? ";" : ","; return t.split(/\r?\n/).map(l => l.split(sep).map(c => c.replace(/^"|"$/g, "").trim()).join("\t")).join("\n"); }
  if (ext === "docx") {
    await loadScript("https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js");
    const html = (await window.mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() })).value;
    const d = document.createElement("div"); d.innerHTML = html;
    const trs = [...d.querySelectorAll("tr")];
    if (trs.length) return trs.map(tr => [...tr.children].map(td => td.textContent.trim()).join("\t")).join("\n");
    return [...d.querySelectorAll("p,li")].map(p => p.textContent.trim()).filter(Boolean).join("\n");
  }
  if (ext === "txt" || ext === "md") return f.text();
  throw new Error("Format non pris en charge : utilisez un fichier Excel (.xlsx), CSV, Word (.docx) ou texte.");
}

/* ---------- lecteur audio intégré aux leçons ----------
   Dans le cours : <div class="aplayer" data-file="ID" data-name="dialogue.mp3">dialogue.mp3</div>
   mountAudio() le transforme en lecteur : lecture/pause, barre, −5 s, réécouter, vitesse. */
const IC = {
  play: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
  pause: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
  re: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4.5h4.5"/></svg>',
  wait: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur=".8s" repeatCount="indefinite"/></path></svg>',
};
let currentAudio = null;
const fmtT = s => isFinite(s) && s >= 0 ? Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0") : "0:00";
export function mountAudio(root, api, getFile) {
  root.querySelectorAll(".aplayer").forEach(el => {
    if (el.dataset.mounted) return; el.dataset.mounted = "1";
    const id = el.dataset.file, name = el.dataset.name || "Audio";
    el.innerHTML = `<button type="button" class="ap-play" aria-label="Lecture">${IC.play}</button>
      <div class="ap-mid"><div class="ap-name">🎧 ${esc(name)}</div><input type="range" class="ap-bar" min="0" max="1000" value="0" aria-label="Position dans l'audio"><div class="ap-time">0:00</div></div>
      <div class="ap-tools"><button type="button" class="ap-btn" data-a="back" title="Reculer de 5 secondes">−5 s</button><button type="button" class="ap-btn" data-a="re" title="Réécouter depuis le début" aria-label="Réécouter">${IC.re}</button><button type="button" class="ap-btn" data-a="sp" title="Vitesse de lecture">1×</button></div>`;
    const play = el.querySelector(".ap-play"), bar = el.querySelector(".ap-bar"), time = el.querySelector(".ap-time"), sp = el.querySelector('[data-a="sp"]');
    let audio = null, rate = 1;
    const ensure = async () => {
      if (audio) return audio;
      const f = getFile(id); if (!f) throw new Error("introuvable");
      play.innerHTML = IC.wait;
      const blob = await fileBlob(api, f);
      audio = new Audio(URL.createObjectURL(blob)); audio.playbackRate = rate;
      const tick = () => { bar.value = audio.duration ? audio.currentTime / audio.duration * 1000 : 0; time.textContent = fmtT(audio.currentTime) + " / " + fmtT(audio.duration); };
      audio.ontimeupdate = audio.onloadedmetadata = tick;
      audio.onplay = () => { if (currentAudio && currentAudio !== audio) currentAudio.pause(); currentAudio = audio; play.innerHTML = IC.pause; play.setAttribute("aria-label", "Pause"); el.classList.add("on"); };
      audio.onpause = audio.onended = () => { play.innerHTML = IC.play; play.setAttribute("aria-label", "Lecture"); el.classList.remove("on"); };
      return audio;
    };
    const fail = () => { play.innerHTML = IC.play; time.textContent = "Audio indisponible"; el.classList.add("err"); };
    play.onclick = async () => { try { if ("speechSynthesis" in window) speechSynthesis.cancel(); const a = await ensure(); a.paused ? a.play() : a.pause(); } catch (e) { fail(); } };
    el.querySelector('[data-a="re"]').onclick = async () => { try { const a = await ensure(); a.currentTime = 0; a.play(); } catch (e) { fail(); } };
    el.querySelector('[data-a="back"]').onclick = async () => { try { const a = await ensure(); a.currentTime = Math.max(0, a.currentTime - 5); } catch (e) { fail(); } };
    sp.onclick = () => { rate = rate === 1 ? .75 : rate === .75 ? .5 : 1; sp.textContent = String(rate).replace(".", ",") + "×"; if (audio) audio.playbackRate = rate; };
    bar.oninput = async () => { try { const a = await ensure(); if (a.duration) a.currentTime = bar.value / 1000 * a.duration; } catch (e) { fail(); } };
  });
}
export const isAudioFile = f => /^audio\//.test(f.type || "") || /\.(mp3|m4a|wav|ogg|aac|oga|opus|webm)$/i.test(f.name || "");
