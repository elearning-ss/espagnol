// État partagé de l'espace professeur + règles de synchronisation des accès.
import { cleanLesson, ikey, newId, esc } from "./core.js";
import { modal, toast } from "./ui.js";
import { authError } from "./fb.js";

export const S = { C: null, lessons: [], order: [], students: [], admins: [], plans: {}, progress: {}, files: [], folders: [], templates: [] };
export const clone = o => JSON.parse(JSON.stringify(o ?? null));
export const fail = e => { console.error(e); toast("❌ " + authError(e), 5000); };
export const api = () => S.C.api;

export async function reload() {
  const a = api();
  const [ls, us, pls, prs, st, fs, ds, ts] = await Promise.all([a.list("lessons"), a.list("users"), a.list("plans"), a.list("progress"), a.get("settings/main"), a.list("files"), a.list("folders"), a.list("templates")]);
  S.order = st?.order || [];
  S.lastBackup = st?.lastBackup || 0;
  S.lessons = ls.map(l => ({ id: l.id, ...cleanLesson(l), createdAt: l.createdAt, updatedAt: l.updatedAt, source: l.source }));
  sortLessons();
  S.students = us.filter(u => u.role !== "admin").sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  S.admins = us.filter(u => u.role === "admin").sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  S.plans = Object.fromEntries(pls.map(p => [p.id, normPlan(p)]));
  S.progress = Object.fromEntries(prs.map(p => [p.id, p]));
  S.files = fs; S.folders = ds;
  S.templates = ts.map(t => ({ ...t, ...normPlan(t) })).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}
export function sortLessons() { const i = id => { const k = S.order.indexOf(id); return k < 0 ? 1e6 : k; }; S.lessons.sort((a, b) => i(a.id) - i(b.id)); }
export function normPlan(p = {}) {
  const { id, ...rest } = p;
  return { mode: "manual", chapters: [], state: {}, notes: {}, extra: {}, message: "", vocab: [], ...rest };
}
export const lessonById = id => S.lessons.find(l => l.id === id);
export const fileById = id => S.files.find(f => f.id === id);
export const folderById = id => S.folders.find(f => f.id === id);
export const studentById = id => S.students.find(s => s.id === id);
export const sName = s => s ? (s.name || s.email) : "?";
export const lib = () => ({ lessons: S.lessons, files: S.files, folders: S.folders });
export async function saveOrder() { S.order = S.lessons.map(l => l.id); await api().set("settings/main", { order: S.order }); }

/* ---------- arborescence ---------- */
export const subFolders = pid => S.folders.filter(f => (f.parent || null) === (pid || null)).sort((a, b) => a.name.localeCompare(b.name));
export const folderFiles = pid => S.files.filter(f => (f.folder || null) === (pid || null)).sort((a, b) => a.name.localeCompare(b.name));
export function descendants(fid) { const out = []; const walk = id => subFolders(id).forEach(f => { out.push(f); walk(f.id); }); walk(fid); return out; }
export function folderPath(fid) { const p = []; let f = folderById(fid); while (f) { p.unshift(f); f = folderById(f.parent); } return p; }
export const isInside = (fid, ancestor) => folderPath(fid).some(f => f.id === ancestor);

/* ---------- accès aux documents ----------
   Source de vérité : les parcours. Un élève a accès à un fichier s'il est dans son
   parcours, ou s'il se trouve (même en profondeur) dans un dossier de son parcours.
   On recalcule le champ `students` de chaque fichier/dossier et on n'écrit que les différences. */
export async function syncAccess() {
  const want = new Map();
  const add = (id, uid) => { if (!want.has(id)) want.set(id, new Set()); want.get(id).add(uid); };
  for (const s of S.students) {
    const p = S.plans[s.id]; if (!p || s.disabled) continue;
    for (const ch of p.chapters) for (const it of ch.items) {
      if (it.k === "f") add("f:" + it.id, s.id);
      if (it.k === "l") { // audios des leçons : dans le cours, les exercices, et les exercices perso de l'élève
        const l = lessonById(it.id);
        if (l && l.course) for (const m of String(l.course).matchAll(/data-file="([^"]+)"/g)) add("f:" + m[1], s.id);
        for (const x of [...(l?.ex || []), ...(p.extra?.[it.id] || [])]) if (x && x.f) add("f:" + x.f, s.id);
      }
      if (it.k === "d" && folderById(it.id)) {
        const all = [folderById(it.id), ...descendants(it.id)];
        all.forEach(d => { add("d:" + d.id, s.id); folderFiles(d.id).forEach(f => add("f:" + f.id, s.id)); });
      }
    }
  }
  const same = (a = [], b) => a.length === b.length && a.every(x => b.includes(x));
  const writes = [];
  for (const f of S.files) { const w = [...(want.get("f:" + f.id) || [])].sort(); if (!same(f.students, w)) { f.students = w; writes.push(api().set("files/" + f.id, { students: w })); } }
  for (const d of S.folders) { const w = [...(want.get("d:" + d.id) || [])].sort(); if (!same(d.students, w)) { d.students = w; writes.push(api().set("folders/" + d.id, { students: w })); } }
  await Promise.all(writes);
}

export async function savePlan(uid, plan) {
  // nettoyage : notes / exercices vides
  Object.keys(plan.notes || {}).forEach(k => { if (!String(plan.notes[k]).trim()) delete plan.notes[k]; });
  Object.keys(plan.extra || {}).forEach(k => { if (!plan.extra[k]?.length) delete plan.extra[k]; });
  plan.vocab = (plan.vocab || []).filter(v => v && v[0] && v[1]);
  await api().replace("plans/" + uid, plan);
  S.plans[uid] = clone(plan);
  await syncAccess();
}

// Ajoute des éléments au parcours d'élèves (dans un chapitre « Documents » si besoin)
export function addItemsToPlan(plan, items, chapterId) {
  const has = new Set(plan.chapters.flatMap(c => c.items.map(ikey)));
  let ch = chapterId ? plan.chapters.find(c => c.id === chapterId) : plan.chapters.find(c => /documents/i.test(c.title));
  if (!ch) { ch = { id: newId(), title: "📎 Documents", items: [] }; plan.chapters.push(ch); }
  let n = 0;
  items.forEach(it => { if (!has.has(ikey(it))) { ch.items.push({ k: it.k, id: it.id }); n++; } });
  return n;
}
export function removeItemsFromPlan(plan, keys) {
  const set = new Set(keys); let n = 0;
  plan.chapters.forEach(c => { const b = c.items.length; c.items = c.items.filter(i => !set.has(ikey(i))); n += b - c.items.length; });
  return n;
}
export const planHas = (uid, key) => !!S.plans[uid]?.chapters.some(c => c.items.some(i => ikey(i) === key));

/* ---------- choisir des élèves ---------- */
export function pickStudents({ title = "Choisir les élèves", intro = "", selected = [], ok = "Valider" } = {}) {
  if (!S.students.length) { toast("Aucun élève pour l'instant : invitez-en depuis l'onglet Élèves."); return Promise.resolve(null); }
  const sel = new Set(selected);
  const body = document.createElement("div");
  body.innerHTML = `${intro ? `<p class="mute">${intro}</p>` : ""}<input type="text" placeholder="🔎 Rechercher un élève" class="pk-q" style="margin-bottom:8px">
    <div class="row tight" style="margin-bottom:8px"><button class="btn ghost small" data-all>Tout cocher</button><button class="btn ghost small" data-none>Tout décocher</button></div>
    <div class="pk-list scrolly" style="max-height:50vh;overflow:auto">${S.students.map(s => `<label class="pk"><input type="checkbox" value="${s.id}" ${sel.has(s.id) ? "checked" : ""}><span class="av">${esc(initials(s))}</span><span><b>${esc(sName(s))}</b><br><small class="mute">${esc(s.email)}</small></span></label>`).join("")}</div>`;
  body.querySelector(".pk-q").oninput = e => { const q = e.target.value.toLowerCase(); body.querySelectorAll(".pk").forEach(l => l.style.display = l.textContent.toLowerCase().includes(q) ? "" : "none"); };
  body.querySelector("[data-all]").onclick = () => body.querySelectorAll(".pk input").forEach(i => { if (i.closest(".pk").style.display !== "none") i.checked = true; });
  body.querySelector("[data-none]").onclick = () => body.querySelectorAll(".pk input").forEach(i => i.checked = false);
  return modal({ title, body, buttons: [{ label: "Annuler", value: null }, { label: ok, primary: true, act: () => [...body.querySelectorAll(".pk input:checked")].map(i => i.value) }] }).result;
}
export const initials = s => sName(s).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
