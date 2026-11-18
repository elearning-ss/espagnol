// Outils communs à l'espace élève et à l'espace professeur.
import { MAP_HTML } from "./seed.js";
import { toast } from "./ui.js";
export { MAP_HTML };

export const $ = s => document.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const today = () => Math.floor(Date.now() / 864e5);
const sayTag = (x, t) => `<span class="say" data-say="${esc(t.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " "))}">${t}</span>`;
export const linkify = h => String(h || "").replace(/\[\[(.+?)\]\]/g, sayTag).replace(/\*\*([^*<>]+?)\*\*/g, sayTag);
export const norm = s => String(s).toLowerCase().replace(/[’`´]/g, "'").replace(/[.,!?;:«»"()¿¡]/g, " ").replace(/\s*'\s*/g, "'").replace(/\s+/g, " ").trim();
export const flat = s => norm(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
export const fmtDate = t => t ? new Date(t).toLocaleDateString("fr-BE", { day: "numeric", month: "short", year: "numeric" }) : "—";
export const typeName = t => t === "G" ? "Grammaire" : t === "T" ? "Thème" : "Autre";

/* ---------- écran ---------- */
export const ui = {
  get m() { return $("#m"); },
  backFn: null,
  setTitle(html, back) {
    $("#ttl").innerHTML = html;
    $("#back").hidden = !back;
    ui.backFn = back || null;
    window.scrollTo(0, 0);
  },
  toast(msg, ms = 2400) { toast(msg, ms);   },
};

/* ---------- voix espagnole ---------- */
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
export const voiceState = { voice: null, slow: ls.get("paso_slow") === "1" };
function pickVoice() {
  const v = speechSynthesis.getVoices();
  voiceState.voice = v.find(x => /es[-_]ES/i.test(x.lang)) || v.find(x => /^es/i.test(x.lang)) || null;
  if (voiceState.voice) $$(".novoice").forEach(w => w.remove());
}
if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
export function speak(t, keep) {
  if (!("speechSynthesis" in window) || !t) return;
  if (!keep) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(t).replace(/…/g, "").replace(/\s\/\s/g, ", "));
  u.lang = "es-ES"; if (voiceState.voice) u.voice = voiceState.voice;
  u.rate = voiceState.slow ? .65 : .95;
  speechSynthesis.speak(u);
}
export function toggleSlow() { voiceState.slow = !voiceState.slow; ls.set("paso_slow", voiceState.slow ? "1" : "0"); }
document.addEventListener("click", e => { const b = e.target.closest("[data-say]"); if (b && !b.closest(".rte")) speak(b.dataset.say); });
// Avertissement « pas de voix espagnole » : affiché seulement après un court délai
// (les navigateurs chargent leurs voix en différé), fermable et mémorisé.
export const noVoiceWarning = () => {
  if (!("speechSynthesis" in window) || ls.get("paso_novoice_ok")) return "";
  setTimeout(() => {
    const box = document.querySelector(".novoice"); if (!box) return;
    if (voiceState.voice) return box.remove();
    const ua = navigator.userAgent, how = /Windows/.test(ua)
      ? "Windows : <b>Paramètres › Heure et langue › Voix › Ajouter des voix › Español (España)</b>, puis redémarrez le navigateur. Astuce : Microsoft Edge propose directement des voix espagnoles très naturelles."
      : /Mac/.test(ua) ? "Mac : <b>Réglages Système › Accessibilité › Contenu énoncé › Voix du système › Gérer les voix › Espagnol (Espagne)</b>."
      : /iPhone|iPad/.test(ua) ? "iPhone / iPad : <b>Réglages › Accessibilité › Contenu énoncé › Voix › Espagnol</b>."
      : /Android/.test(ua) ? "Android : <b>Paramètres › Accessibilité › Synthèse vocale › Moteur préféré › Installer les données vocales › Espagnol (Espagne)</b>."
      : "Ajoutez une voix « Espagnol (Espagne) » dans les réglages de synthèse vocale de votre appareil.";
    box.innerHTML = `<div class="row" style="align-items:flex-start"><span style="flex:1">🔈 <b>Pas de voix espagnole sur cet appareil.</b> La lecture fonctionne quand même avec la voix par défaut, mais l'accent sera moins bon.<br><small>${how}</small></span>
      <span class="row tight" style="flex:none"><button class="btn ghost small" data-vt>🔊 Tester</button><button class="ib" data-vx title="Ne plus afficher">✕</button></span></div>`;
    box.classList.remove("hide");
    box.querySelector("[data-vt]").onclick = () => speak("Hola, ¿qué tal? Bienvenido a la clase de español.");
    box.querySelector("[data-vx]").onclick = () => { ls.set("paso_novoice_ok", "1"); box.remove(); };
  }, 1500);
  return `<div class="warn novoice hide"></div>`;
};

/* ---------- leçons ---------- */
export function cleanLesson(l) {
  return {
    title: l.title || "Nouvelle leçon", emoji: l.emoji || "📘", type: l.type || "T",
    goal: l.goal || "", support: l.support || "", course: l.course || "",
    vocab: Array.isArray(l.vocab) ? l.vocab : [], ex: Array.isArray(l.ex) ? l.ex : [],
    published: l.published !== false,
    passScore: l.passScore ?? 70,
  };
}

// Parcours d'un élève (ou d'un parcours type) : chapitres → éléments (leçon, fichier, dossier).
// État de chaque élément : "open" (ouvert), "locked" (visible mais verrouillé), "hidden" (préparé, invisible).
export const ikey = it => it.k + ":" + it.id;
export function buildPath(plan = {}, { lessons = [], files = [], folders = [] } = {}, progress = {}) {
  const L = Object.fromEntries(lessons.map(l => [l.id, l])), F = Object.fromEntries(files.map(f => [f.id, f])), D = Object.fromEntries(folders.map(f => [f.id, f]));
  const st = plan.state || {}, done = progress?.done || {};
  let prevOk = true;
  return (plan.chapters || []).map(ch => ({
    ...ch,
    items: (ch.items || []).map(it => {
      const key = ikey(it), obj = it.k === "l" ? L[it.id] : it.k === "f" ? F[it.id] : D[it.id];
      const state = st[key] || (it.k === "l" ? "locked" : "open");
      const row = { ...it, key, obj, state, missing: !obj };
      if (it.k === "l" && obj) {
        const pass = obj.passScore ?? 70, score = done[it.id] || 0;
        row.visible = state !== "hidden" && obj.published !== false;
        row.score = score; row.passed = score >= pass;
        row.unlocked = row.visible && (state === "open" || (plan.mode === "auto" && prevOk));
        if (row.visible) prevOk = row.passed;
      } else { row.visible = !!obj && state !== "hidden"; row.unlocked = row.visible && state !== "locked"; }
      return row;
    }),
  }));
}
// Toutes les leçons d'un parcours, dans l'ordre, à plat
export const pathLessons = chapters => chapters.flatMap(c => c.items.filter(i => i.k === "l" && i.obj && i.visible));
export const newId = () => Math.random().toString(36).slice(2, 10);

/* ---------- clavier d'accents espagnols ---------- */
const ACC = ["á", "é", "í", "ó", "ú", "ü", "ñ", "¿", "¡"];
export const accentBar = () => `<div class="accents" role="group" aria-label="Accents espagnols">${ACC.map(c => `<button type="button" class="acc" data-acc="${c}" aria-label="Insérer ${c}">${c}</button>`).join("")}<button type="button" class="acc sh" data-shift title="Majuscules" aria-label="Majuscules" aria-pressed="false">⇧</button></div>`;
// Insère le caractère dans le champ (au curseur) sans lui faire perdre le focus
export function bindAccents(root, getInput) {
  root.querySelectorAll(".accents").forEach(bar => {
    let up = false;
    bar.addEventListener("mousedown", e => { if (e.target.closest(".acc")) e.preventDefault(); });
    bar.addEventListener("click", e => {
      const b = e.target.closest(".acc"); if (!b) return;
      if (b.dataset.shift !== undefined) { up = !up; b.setAttribute("aria-pressed", up); b.classList.toggle("on", up); bar.querySelectorAll("[data-acc]").forEach(k => k.textContent = up ? k.dataset.acc.toUpperCase() : k.dataset.acc); return; }
      const el = getInput(); if (!el || el.disabled) return;
      const c = up ? b.dataset.acc.toUpperCase() : b.dataset.acc, a = el.selectionStart ?? el.value.length, z = el.selectionEnd ?? a;
      el.value = el.value.slice(0, a) + c + el.value.slice(z); el.focus(); el.setSelectionRange(a + c.length, a + c.length);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      if (up) { up = false; const sh = bar.querySelector("[data-shift]"); sh.classList.remove("on"); sh.setAttribute("aria-pressed", "false"); bar.querySelectorAll("[data-acc]").forEach(k => k.textContent = k.dataset.acc); }
    });
  });
}

/* ---------- moteur d'exercices ---------- */
/* Sons des exercices d'écoute : un fichier audio de la bibliothèque (x.f) ou la voix de synthèse (texte). */
let audioResolver = null, clip = null;
export function setAudioResolver(fn) { audioResolver = fn; }
async function playClip(x, slow) {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  if (clip) { clip.pause(); clip = null; }
  if (x.f && audioResolver) {
    try { const blob = await audioResolver(x.f); clip = new Audio(URL.createObjectURL(blob)); clip.playbackRate = slow ? .75 : 1; await clip.play(); return; }
    catch (e) { /* fichier indisponible : on se rabat sur la voix de synthèse si un texte existe */ }
  }
  const t = x.s || (Array.isArray(x.a) ? x.a[0] : x.a) || "";
  if (!t) return;
  const was = voiceState.slow; voiceState.slow = !!slow || was; speak(t); voiceState.slow = was;
}
// « Yo [tengo] (tener) dos hermanos. » → morceaux de texte et trous (réponses séparées par |)
export function parseGaps(s) {
  const parts = []; let last = 0; const re = /\[([^\]]+)\]/g; let m;
  while ((m = re.exec(String(s || "")))) { parts.push({ t: s.slice(last, m.index) }); parts.push({ gap: m[1].split("|").map(z => z.trim()).filter(Boolean) }); last = re.lastIndex; }
  parts.push({ t: String(s || "").slice(last) });
  return parts;
}
export const gapsFull = s => parseGaps(s).map(p => p.gap ? p.gap[0] : p.t).join("");

let Q;
export function runQuiz(o) { Q = { ...o, list: o.list.map(x => ({ ...x })), i: 0, ok: 0, log: [] }; ask(); }
const answerInput = (ph = "En espagnol…") => `<input type="text" id="inp" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${ph}">${accentBar()}<p><button class="btn full" id="chk">Vérifier</button></p>`;
function ask() {
  const m = ui.m;
  ui.setTitle(Q.title, Q.back);
  if (Q.i >= Q.list.length) return finish();
  const x = Q.list[Q.i];
  let h = `<div class="prog"><i style="width:${Q.i / Q.list.length * 100}%"></i></div><div class="card">`;
  if (x.mine) h += `<span class="tag OK">✍️ Exercice de votre professeur</span>`;
  if (x.map) h += MAP_HTML;
  const listenBtns = `<div class="row tight" style="margin:0 0 14px"><button class="btn" id="pl1">🔊 Écouter</button><button class="btn ghost" id="pl2">🐢 Plus lentement</button></div>`;
  if (x.t === "q" || x.t === "l") {
    if (!x.sh) x.sh = shuf((x.o || []).filter(Boolean).map((t, k) => ({ t, k })));
    const q = x.t === "l" ? (x.q || "Écoutez : que signifie ce que vous entendez ?") : x.q;
    h += `<div class="q">${esc(q)}</div>${x.t === "l" ? listenBtns : x.listen ? `<p><button class="btn ghost" data-say="${esc(x.listen)}">🔊 Écouter</button></p>` : ""}<div class="opts">${x.sh.map((o, j) => `<button class="opt" data-j="${j}">${esc(o.t)}</button>`).join("")}</div>`;
  } else if (x.t === "w") {
    h += `<div class="q">${esc(x.q)}</div>${answerInput()}`;
  } else if (x.t === "n") {
    if (x.num == null) x.num = Math.floor(Math.random() * ((+x.max || 20) + 1));
    h += `<div class="q">Écoutez et écrivez le nombre en chiffres.</div><p><button class="btn ghost" data-say="${x.num}">🔊 Écouter</button></p><input type="text" id="inp" autocomplete="off" inputmode="numeric"><p><button class="btn full" id="chk">Vérifier</button></p>`;
  } else if (x.t === "d") {
    h += `<div class="q">${esc(x.q || "Dictée : écoutez et écrivez ce que vous entendez.")}</div>${listenBtns}${answerInput("Écrivez ce que vous entendez…")}`;
  } else if (x.t === "g") {
    let g = 0;
    const line = parseGaps(x.s).map(p => p.gap ? `<input type="text" class="gap" data-g="${g++}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Trou ${g}" style="width:${Math.max(4, Math.max(...p.gap.map(a => a.length)) + 2)}ch">` : esc(p.t)).join("");
    h += `<div class="q">${esc(x.q || "Complétez la phrase.")}</div><div class="gapline">${line}</div>${accentBar()}<p><button class="btn full" id="chk">Vérifier</button></p>`;
  } else if (x.t === "p") {
    const pairs = (x.pairs || []).filter(p => p && p[0] && p[1]);
    if (!x.L) { x.L = shuf(pairs.map((p, k) => ({ t: p[0], k }))); x.R = shuf(pairs.map((p, k) => ({ t: p[1], k }))); x.done = []; x.err = 0; x.selL = null; }
    h += `<div class="q">${esc(x.q || "Associez chaque mot espagnol à sa traduction.")}</div><div class="pairs"><div class="pcol" id="pl">${x.L.map(o => `<button class="pbtn" data-k="${o.k}">${esc(o.t)}</button>`).join("")}</div><div class="pcol" id="pr">${x.R.map(o => `<button class="pbtn" data-k="${o.k}">${esc(o.t)}</button>`).join("")}</div></div><p class="mute" id="pinfo">Touchez un mot à gauche, puis sa traduction à droite.</p>`;
  } else if (x.t === "o") {
    if (!x.w) x.w = shuf(String(x.a).split(" ").filter(Boolean).map((t, k) => ({ t, k })));
    x.pick = [];
    h += `<div class="mute">Remettez les mots dans l'ordre :</div><div class="q">${esc(x.q)}</div><div class="chips ans" id="ans"></div><div class="chips" id="pool">${x.w.map((c, j) => `<button class="chip" data-c="${j}">${esc(c.t)}</button>`).join("")}</div><p><button class="btn full" id="chk">Vérifier</button></p>`;
  }
  h += `<div id="fb"></div></div>`;
  m.innerHTML = h;
  if (x.listen) speak(x.listen);
  if (x.t === "n") setTimeout(() => speak(String(x.num)), 200);
  if (x.t === "d" || x.t === "l") {
    $("#pl1").onclick = () => playClip(x, false); $("#pl2").onclick = () => playClip(x, true);
    setTimeout(() => playClip(x, false), 250);
  }
  if (x.t === "q" || x.t === "l") $$(".opt", m).forEach(b => b.onclick = () => {
    if ($(".opt.ok", m) || $(".opt.ko", m)) return;
    const good = x.sh[b.dataset.j].k === 0;
    b.classList.add(good ? "ok" : "ko");
    if (!good) $$(".opt", m).forEach(c => { if (x.sh[c.dataset.j].k === 0) c.classList.add("ok"); });
    result(good, x.t === "l" ? (x.s || "") : x.o[0], x.x, x.t === "l" && x.s ? `${x.s} = ${x.o[0]}` : null);
  });
  if (x.t === "w" || x.t === "n" || x.t === "d") {
    const inp = $("#inp"); inp.focus(); if (x.t !== "n") bindAccents(m, () => inp);
    const chk = () => {
      if ($("#fb").innerHTML) return; const v = inp.value; if (!v.trim()) return; inp.disabled = true;
      if (x.t === "n") return result(parseInt(v, 10) === x.num, String(x.num));
      const ans = (Array.isArray(x.a) ? x.a : [x.a]).filter(Boolean);
      const ok = ans.some(a => norm(a) === norm(v)), near = !ok && ans.some(a => flat(a) === flat(v));
      result(ok || near, ans[0] || "", (near ? "Presque parfait : attention aux accents ! " : "") + (x.x || ""));
    };
    $("#chk").onclick = chk; inp.onkeydown = e => { if (e.key === "Enter") chk(); };
  }
  if (x.t === "g") {
    const gaps = $$(".gap", m); let cur = gaps[0]; if (cur) cur.focus();
    gaps.forEach((g, i) => { g.onfocus = () => cur = g; g.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); if (gaps[i + 1]) gaps[i + 1].focus(); else $("#chk").click(); } }; });
    bindAccents(m, () => cur);
    $("#chk").onclick = () => {
      if ($("#fb").innerHTML) return;
      if (gaps.some(g => !g.value.trim())) return toast("Complétez tous les trous.");
      const want = parseGaps(x.s).filter(p => p.gap).map(p => p.gap);
      let near = false;
      const res = gaps.map((g, i) => { const v = g.value; if (want[i].some(a => norm(a) === norm(v))) return true; if (want[i].some(a => flat(a) === flat(v))) { near = true; return true; } return false; });
      gaps.forEach((g, i) => { g.disabled = true; g.classList.add(res[i] ? "ok" : "ko"); });
      result(res.every(Boolean), gapsFull(x.s), (near ? "Presque parfait : attention aux accents ! " : "") + (x.x || ""));
    };
  }
  if (x.t === "p") {
    const pairs = x.pairs || [];
    const paint = () => {
      $$("#pl .pbtn", m).forEach(b => { const k = +b.dataset.k; b.classList.toggle("done", x.done.includes(k)); b.disabled = x.done.includes(k); b.classList.toggle("sel", x.selL === k); });
      $$("#pr .pbtn", m).forEach(b => { const k = +b.dataset.k; b.classList.toggle("done", x.done.includes(k)); b.disabled = x.done.includes(k); });
    };
    $("#pl").onclick = e => { const b = e.target.closest(".pbtn"); if (!b || b.disabled) return; x.selL = +b.dataset.k; speak(pairs[x.selL][0]); paint(); };
    $("#pr").onclick = e => {
      const b = e.target.closest(".pbtn"); if (!b || b.disabled) return;
      if (x.selL == null) { $("#pinfo").textContent = "Choisissez d'abord un mot à gauche."; return; }
      const k = +b.dataset.k;
      if (k === x.selL) { x.done.push(k); x.selL = null; paint(); }
      else { x.err++; if (Q.onMiss) Q.onMiss({ it: pairs[x.selL][0], fr: pairs[x.selL][1] }); b.classList.add("ko"); setTimeout(() => b.classList.remove("ko"), 500); }
      if (x.done.length === pairs.length) result(x.err <= 1, "", x.err ? `${x.err} erreur${x.err > 1 ? "s" : ""} d'association.${x.err <= 1 ? " Réussi quand même (1 erreur tolérée)." : ""}` : "Sans aucune erreur !", null, true);
    };
    paint();
  }
  if (x.t === "o") {
    const draw = () => {
      $("#ans").innerHTML = x.pick.map((j, p) => `<button class="chip" data-p="${p}">${esc(x.w[j].t)}</button>`).join("");
      $$("#pool .chip", m).forEach(b => b.classList.toggle("used", x.pick.includes(+b.dataset.c)));
    };
    $("#pool").onclick = e => { const b = e.target.closest(".chip"); if (!b || $("#fb").innerHTML) return; const j = +b.dataset.c; if (!x.pick.includes(j)) { x.pick.push(j); speak(x.w[j].t); draw(); } };
    $("#ans").onclick = e => { const b = e.target.closest(".chip"); if (!b || $("#fb").innerHTML) return; x.pick.splice(+b.dataset.p, 1); draw(); };
    $("#chk").onclick = () => { if ($("#fb").innerHTML || !x.pick.length) return; const s = x.pick.map(j => x.w[j].t).join(" "); result(flat(s) === flat(x.a), x.a, x.x); };
  }
}
// Ce qu'un exercice raté ajoute aux « mots à revoir » de l'élève
function missOf(x) {
  if (x.voc) return { it: x.voc[0], fr: x.voc[1], ph: x.voc[2] || "" };
  const clean = q => String(q || "").replace(/^(traduisez|traduire|écrivez)\s*:?\s*/i, "").trim();
  if (x.t === "w") return { it: (Array.isArray(x.a) ? x.a[0] : x.a) || "", fr: clean(x.q) };
  if (x.t === "o") return { it: x.a, fr: x.q };
  if (x.t === "d") return { it: (Array.isArray(x.a) ? x.a[0] : x.a) || "", fr: "Dictée" + (x.x ? " · " + x.x : "") };
  if (x.t === "g") return { it: gapsFull(x.s), fr: x.q && !/^complétez/i.test(x.q) ? x.q : "Phrase à compléter" };
  if (x.t === "l" && x.s) return { it: x.s, fr: x.o?.[0] || "" };
  return null;
}
function result(good, answer, expl, shown, noMiss) {
  if (good) Q.ok++;
  Q.log.push(good ? 1 : 0);
  const x = Q.list[Q.i];
  if (!good && !noMiss && Q.onMiss) { const w = missOf(x); if (w && w.it && w.fr) Q.onMiss(w); }
  const disp = shown || answer;
  $("#fb").innerHTML = `<div class="fb ${good ? "ok" : "ko"}"><b>${good ? "✅ ¡Correcto!" : "❌ Pas tout à fait."}</b> ${good || !disp ? "" : `Réponse : <span class="say" data-say="${esc(answer || disp)}">${esc(disp)}</span>`}${expl ? `<div>${esc(expl)}</div>` : ""}${!good && Q.onMiss && missOf(x) ? `<div class="mute" style="font-size:13px;margin-top:4px">➕ Ajouté à vos mots à revoir.</div>` : ""}</div><p><button class="btn full" id="nx">Continuer →</button></p>`;
  const c = $("#chk"); if (c) c.style.display = "none";
  if (answer && /[a-záéíóúñ]/i.test(answer) && !/^\d+$/.test(answer) && x.t !== "d") speak(answer);
  if (x.t === "d" && !good) playClip(x, true);
  $("#nx").onclick = () => { if (clip) clip.pause(); Q.i++; ask(); }; $("#nx").focus();
}
async function finish() {
  const pct = Q.list.length ? Math.round(Q.ok / Q.list.length * 100) : 0;
  const pass = pct >= (Q.pass ?? 70), gain = Q.ok * 10;
  const extra = await Q.end(pct, pass, gain);
  ui.m.innerHTML = `<div class="card center"><div class="big">${pct >= 90 ? "🏆" : pass ? "🎉" : "💪"}</div><h2 style="margin:0">${pct} %</h2><p>${Q.ok} / ${Q.list.length} bonnes réponses</p>${extra}</div>`;
}

// Petits exercices automatiques tirés du vocabulaire
export function autoVocabEx(vocab, n = 3) {
  const pool = (vocab || []).filter(v => v && v[0] && v[1]);
  if (pool.length < 4) return [];
  return shuf(pool).slice(0, n).map((v, k) => {
    const wrong = shuf(pool.filter(w => w !== v)).slice(0, 3).map(w => w[1]);
    return k === 1 ? { t: "q", listen: v[0], q: "Écoutez : que veut dire ce mot ou cette phrase ?", o: [v[1], ...wrong], voc: v }
      : { t: "q", q: `« ${v[0]} » veut dire…`, o: [v[1], ...wrong], voc: v };
  });
}
