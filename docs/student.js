// Espace élève : Leçons · Exercices · Mon compte
import { $, $$, esc, shuf, today, linkify, ui, speak, voiceState, toggleSlow, noVoiceWarning, buildPath, pathLessons, runQuiz, autoVocabEx, typeName } from "./core.js";
import { previewFile, fileKind, kindIcon, fmtSize, mountAudio } from "./files.js";
import { passwordBox } from "./ui.js";
import { authError } from "./fb.js";

// préférences d'affichage du vocabulaire (mémorisées sur l'appareil)
const VP = { get: k => { try { return localStorage.getItem("paso_voc_" + k) === "1"; } catch (e) { return false; } }, set: (k, v) => { try { localStorage.setItem("paso_voc_" + k, v ? "1" : "0"); } catch (e) {} } };
let C; // contexte : { api, user, profile, lessons, files, folders, plan, progress, preview, onExit }

export function startStudent(ctx) {
  C = ctx;
  C.progress = Object.assign({ done: {}, attempts: {}, xp: 0, cards: {}, seen: {} }, C.progress || {});
  C.plan = Object.assign({ chapters: [], state: {}, notes: {}, extra: {} }, C.plan || {});
  C.files = C.files || []; C.folders = C.folders || [];
  document.body.classList.remove("admin");
  $("#nav").className = "bottom";
  $("#nav").innerHTML = `<button data-nav="lessons"><b>📚</b>Leçons</button><button data-nav="exercises"><b>✏️</b>Exercices</button><button data-nav="account"><b>👤</b>Mon compte</button>`;
  $$("#nav [data-nav]").forEach(b => b.onclick = () => go(b.dataset.nav));
  $("#hdr-right").innerHTML = `${C.preview ? `<button class="pill" id="exitprev">✕ Quitter l'aperçu</button>` : ""}<button class="pill" id="spd">${voiceState.slow ? "🐢 lent" : "🔊 normal"}</button>`;
  $("#spd").onclick = () => { toggleSlow(); $("#spd").textContent = voiceState.slow ? "🐢 lent" : "🔊 normal"; };
  if (C.preview) $("#exitprev").onclick = () => C.onExit();
  go("lessons");
}
const chapters = () => buildPath(C.plan, { lessons: C.lessons, files: C.files, folders: C.folders }, C.progress).map(c => ({ ...c, items: c.items.filter(i => i.visible) })).filter(c => c.items.length);
// leçons visibles, à plat, au format attendu par le reste du code : { l, unlocked, score, passed }
const path = () => pathLessons(chapters()).map(i => ({ l: i.obj, unlocked: i.unlocked, score: i.score, passed: i.passed }));
function go(v) { $$("#nav [data-nav]").forEach(b => b.classList.toggle("on", b.dataset.nav === v)); ({ lessons, exercises, account })[v](); }
async function saveProgress() {
  if (C.preview) return;
  C.progress.last = Date.now();
  try { await C.api.replace("progress/" + C.user.uid, C.progress); } catch (e) { ui.toast("Sauvegarde impossible : " + authError(e)); }
}
const prevBanner = () => C.preview ? `<div class="note" style="margin-bottom:12px">👁️ Aperçu de l'espace de <b>${esc(C.profile.name || C.profile.email)}</b>. Rien n'est enregistré.</div>` : "";

/* ======================= LEÇONS ======================= */
const collapsedCh = new Set();
function lessons() {
  ui.setTitle(`<span class="flag"></span>Paso a paso`);
  const CH = chapters(), P = path(), passed = P.filter(p => p.passed).length;
  const next = P.find(p => p.unlocked && !p.passed);
  const name = (C.profile.name || "").split(" ")[0];
  let h = prevBanner() + `<div class="card hero"><h2>¡Hola${name ? " " + esc(name) : ""}! 👋</h2>
   <div>${P.length ? `${passed} leçon${passed > 1 ? "s" : ""} réussie${passed > 1 ? "s" : ""} sur ${P.length}.` : CH.length ? "Vos documents sont prêts ci-dessous." : "Votre professeur prépare votre parcours."}</div>
   ${P.length ? `<div class="bar"><i style="width:${passed / P.length * 100}%"></i></div>` : ""}
   ${next ? `<button class="btn" style="background:#fff;color:var(--g)" data-open="${next.l.id}">${C.progress.seen[next.l.id] ? "Continuer" : "Commencer"} : ${esc(next.l.emoji)} ${esc(next.l.title)}</button>` : (P.length && passed === P.length ? "<b>Parcours terminé, ¡enhorabuena! 🎉</b>" : "")}</div>`;
  h += noVoiceWarning();
  if (C.plan.message) h += `<div class="prof">💬 <b>Message de votre professeur</b>\n${esc(C.plan.message)}</div>`;
  let n = 0;
  CH.forEach(c => {
    const ls = c.items.filter(i => i.k === "l"), ok = ls.filter(i => i.passed).length, col = collapsedCh.has(c.id);
    h += `<div class="sch"><button class="sch-h" data-ch="${c.id}"><span>${col ? "▸" : "▾"}</span><b>${esc(c.title)}</b>${ls.length ? `<span class="mute">${ok}/${ls.length}</span>` : ""}</button>`;
    if (!col) c.items.forEach(it => {
      if (it.k === "l") {
        n++;
        const l = it.obj, lock = !it.unlocked;
        h += `<div class="card step ${it.passed ? "done" : ""} ${next && next.l.id === l.id ? "next" : ""} ${lock ? "locked" : ""}" ${lock ? "" : `data-open="${l.id}"`}>
         <div class="n">${lock ? "🔒" : it.passed ? "✓" : esc(l.emoji)}</div>
         <div class="t"><span class="tag ${l.type}">${typeName(l.type)}</span> <span class="mute">Leçon ${n}</span><b>${esc(l.title)}</b>
         ${lock ? `<span class="mute">Votre professeur ouvrira cette leçon.</span>` : it.score ? `<span class="mute">Meilleur score : ${it.score} %</span>` : ""}</div>${lock ? "" : "›"}</div>`;
      } else {
        const o = it.obj, lock = !it.unlocked, isD = it.k === "d";
        h += `<div class="card step doc ${lock ? "locked" : ""}" ${lock ? "" : isD ? `data-dir="${o.id}"` : `data-file="${o.id}"`}><div class="n">${lock ? "🔒" : isD ? "📁" : kindIcon(fileKind(o.name, o.type))}</div>
          <div class="t"><span class="mute">${isD ? "Dossier" : "Document"}${isD ? "" : " · " + fmtSize(o.size)}</span><b>${esc(o.name)}</b>${lock ? `<span class="mute">Bientôt disponible.</span>` : ""}</div>${lock ? "" : "›"}</div>`;
      }
    });
    h += `</div>`;
  });
  if (!CH.length) h += `<div class="card center mute">Aucune leçon pour l'instant.</div>`;
  ui.m.innerHTML = h;
  $$("[data-open]", ui.m).forEach(b => b.onclick = () => lesson(b.dataset.open));
  $$("[data-ch]", ui.m).forEach(b => b.onclick = () => { const id = b.dataset.ch; collapsedCh.has(id) ? collapsedCh.delete(id) : collapsedCh.add(id); lessons(); });
  $$("[data-file]", ui.m).forEach(b => b.onclick = () => openFile(b.dataset.file));
  $$("[data-dir]", ui.m).forEach(b => b.onclick = () => folder(b.dataset.dir, b.dataset.dir));
}
function openFile(id) {
  const f = C.files.find(x => x.id === id); if (!f) return;
  if (!C.progress.opened) C.progress.opened = {};
  if (!C.preview && !C.progress.opened[id]) { C.progress.opened[id] = Date.now(); saveProgress(); }
  previewFile(C.api, f);
}
// Dossier partagé par le professeur : petit explorateur en lecture seule
function folder(id, root) {
  const d = C.folders.find(x => x.id === id); if (!d) return lessons();
  const trail = []; let cur = d; while (cur) { trail.unshift(cur); if (cur.id === root) break; cur = C.folders.find(x => x.id === cur.parent); }
  ui.setTitle(`📁 ${esc(d.name)}`, () => id === root ? go("lessons") : folder(d.parent, root));
  const subs = C.folders.filter(x => x.parent === id).sort((a, b) => a.name.localeCompare(b.name)), fs = C.files.filter(x => x.folder === id).sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
  ui.m.innerHTML = `<div class="crumbs" style="margin-bottom:10px">${trail.map((t, i) => `${i ? '<span class="crs">›</span>' : ""}<span class="cr" data-dir="${t.id}">📁 ${esc(t.name)}</span>`).join("")}</div>
    ${subs.map(s => `<div class="card step" data-dir="${s.id}"><div class="n">📁</div><div class="t"><b>${esc(s.name)}</b></div>›</div>`).join("")}
    ${fs.map(f => `<div class="card step" data-file="${f.id}"><div class="n">${kindIcon(fileKind(f.name, f.type))}</div><div class="t"><b>${esc(f.name)}</b><span class="mute">${fmtSize(f.size)}</span></div>›</div>`).join("")}
    ${subs.length || fs.length ? "" : `<div class="card center mute">Ce dossier est vide.</div>`}`;
  $$("[data-dir]", ui.m).forEach(b => b.onclick = () => folder(b.dataset.dir, root));
  $$("[data-file]", ui.m).forEach(b => b.onclick = () => openFile(b.dataset.file));
}

function lesson(id, tab = "c") {
  const p = path().find(x => x.l.id === id); if (!p || !p.unlocked) return lessons();
  const l = p.l;
  if (!C.progress.seen[id]) { C.progress.seen[id] = 1; saveProgress(); }
  ui.setTitle(`${esc(l.emoji)} ${esc(l.title)}`, () => go("lessons"));
  const tabs = [["c", "📘 Cours"], ["v", "🗣️ Vocabulaire"]];
  const n = path().findIndex(x => x.l.id === id) + 1;
  let h = `<div class="tabs">${tabs.map(t => `<button class="${tab === t[0] ? "on" : ""}" data-t="${t[0]}">${t[1]}</button>`).join("")}</div>`;
  const note = C.plan.notes?.[id];
  if (note) h += `<div class="prof">✍️ <b>Note de votre professeur</b>\n${esc(note)}</div>`;
  if (tab === "c") {
    h += `<div class="card"><span class="tag ${l.type}">Leçon ${n} · ${typeName(l.type)}</span>${l.goal ? `<p><b>Objectif :</b> ${esc(l.goal)}</p>` : ""}
      ${l.support ? `<p><a class="btn ghost small" href="${esc(l.support)}" target="_blank" rel="noopener">📎 Ouvrir le support de cours</a></p>` : ""}</div>
      <div class="card course">${linkify(l.course) || '<p class="mute">Pas encore de cours pour cette étape.</p>'}</div>
      ${l.vocab.length ? `<button class="btn full" data-t="v">Voir le vocabulaire →</button>` : `<button class="btn full" id="doex">Faire les exercices →</button>`}`;
  } else {
    const fr = VP.get("fr"), hide = VP.get("hide");
    h += `<div class="row tight vocbar"><button class="btn ghost small" id="vdir" title="Inverser l'ordre des langues">🔁 ${fr ? "Français → Espagnol" : "Espagnol → Français"}</button><button class="btn ${hide ? "" : "ghost"} small" id="vhide">${hide ? "👁️ Montrer les traductions" : "🙈 Cacher la traduction"}</button></div>
      <p class="mute">${hide ? "Essayez de trouver la traduction, puis touchez la ligne pour vérifier." : "Touchez une ligne pour l'entendre. Répétez à voix haute."}</p>
      <div class="card">${l.vocab.map(v => {
        const es = `<div class="it">${esc(v[0])}</div>${v[2] ? `<div class="ph">[${esc(v[2])}]</div>` : ""}`, frl = `<div class="${fr ? "it" : "mute"}">${esc(v[1])}</div>`;
        const first = fr ? frl : es, second = fr ? es : frl;
        return `<div class="voc" ${fr && hide ? "" : `data-say="${esc(v[0])}"`} data-es="${esc(v[0])}"><div>${first}<div class="${hide ? "veil" : ""}">${hide ? `<span class="veil-t">••• toucher pour voir</span><div class="veil-a">${second}</div>` : second}</div></div><span class="sp">🔊</span></div>`;
      }).join("") || '<p class="mute">Pas de vocabulaire.</p>'}</div>
      <button class="btn full" id="doex">Faire les exercices →</button>`;
  }
  ui.m.innerHTML = h;
  mountAudio(ui.m, C.api, fid => C.files.find(f => f.id === fid));
  $$("[data-t]", ui.m).forEach(b => b.onclick = () => lesson(id, b.dataset.t));
  const vd = $("#vdir"); if (vd) { vd.onclick = () => { VP.set("fr", !VP.get("fr")); lesson(id, "v"); }; $("#vhide").onclick = () => { VP.set("hide", !VP.get("hide")); lesson(id, "v"); }; }
  $$(".veil", ui.m).forEach(v => v.closest(".voc").addEventListener("click", () => { if (!v.classList.contains("open")) { v.classList.add("open"); const r = v.closest(".voc"); if (!r.dataset.say) speak(r.dataset.es); } }));
  const d = $("#doex"); if (d) d.onclick = () => { go("exercises"); exQuiz(id); };
}

/* ======================= EXERCICES ======================= */
function exercises() {
  ui.setTitle("✏️ Exercices");
  const P = path().filter(p => p.unlocked);
  const cards = deck(), dueN = cards.filter(due).length;
  let h = prevBanner() + `<div class="card step" id="rev"><div class="n">🃏</div><div class="t"><b>Réviser le vocabulaire</b><span class="mute">${cards.length ? `${dueN} carte${dueN > 1 ? "s" : ""} à revoir aujourd'hui sur ${cards.length}` : "Ouvrez une leçon pour ajouter ses mots"}</span></div>›</div>
  <p class="mute" style="margin:16px 4px 8px">Exercices par leçon</p>`;
  P.forEach(p => {
    const l = p.l, extra = (C.plan.extra?.[l.id] || []).length, n = l.ex.length + extra + (l.vocab.length >= 4 ? 3 : 0);
    const att = (C.progress.attempts[l.id] || []).length;
    h += `<div class="card step ${p.passed ? "done" : ""}" data-q="${l.id}"><div class="n">${p.passed ? "✓" : esc(l.emoji)}</div>
      <div class="t"><b>${esc(l.title)}</b><span class="mute">${n} question${n > 1 ? "s" : ""}${extra ? ` · <span class="badge">${extra}</span> de votre professeur` : ""}${p.score ? ` · meilleur ${p.score} %` : ""}${att ? ` · ${att} essai${att > 1 ? "s" : ""}` : ""}</span>
      ${p.score ? `<div class="minibar"><i style="width:${p.score}%"></i></div>` : ""}</div>›</div>`;
  });
  if (!P.length) h += `<div class="card center mute">Les exercices apparaîtront quand votre professeur aura ouvert une leçon.</div>`;
  ui.m.innerHTML = h;
  $("#rev").onclick = () => review();
  $$("[data-q]", ui.m).forEach(b => b.onclick = () => exQuiz(b.dataset.q));
}

function exQuiz(id) {
  const p = path().find(x => x.l.id === id); if (!p || !p.unlocked) return exercises();
  const l = p.l, mine = (C.plan.extra?.[id] || []).map(x => ({ ...x, mine: true }));
  const list = [...autoVocabEx(l.vocab), ...l.ex, ...mine];
  if (!list.length) { ui.toast("Pas encore d'exercice pour cette étape."); return exercises(); }
  C.progress.seen[id] = 1;
  const pass = l.passScore ?? 70;
  runQuiz({
    title: `${esc(l.emoji)} ${esc(l.title)}`, back: () => exercises(), list, pass, preview: C.preview,
    end: async (pct, ok, gain) => {
      if (!C.preview) {
        C.progress.done[id] = Math.max(C.progress.done[id] || 0, pct);
        (C.progress.attempts[id] = C.progress.attempts[id] || []).push({ pct, at: Date.now() });
        C.progress.attempts[id] = C.progress.attempts[id].slice(-20);
        await saveProgress();
      }
      const all = path(), k = all.findIndex(x => x.l.id === id), nx = all[k + 1];
      setTimeout(() => {
        $$("[data-act]", ui.m).forEach(b => b.onclick = () => ({ again: () => exQuiz(id), course: () => { go("lessons"); lesson(id); }, next: () => { go("lessons"); lesson(nx.l.id); }, list: () => exercises() })[b.dataset.act]());
      });
      return `<p>${ok ? `Leçon réussie, ¡muy bien! (il faut ${pass} %)` : `Il faut ${pass} % pour réussir la leçon. Relisez le cours, puis réessayez : <i>equivocándose se aprende</i>.`}</p>
        ${ok && nx && nx.unlocked ? `<button class="btn full" data-act="next">Leçon suivante : ${esc(nx.l.emoji)} ${esc(nx.l.title)}</button><p></p>` : ""}
        ${ok && nx && !nx.unlocked && C.plan.mode !== "auto" ? `<p class="mute">Votre professeur ouvrira la leçon suivante.</p>` : ""}
        <div class="row"><button class="btn ghost" data-act="again">Recommencer</button><button class="btn ghost" data-act="course">Revoir le cours</button></div><p></p>
        <button class="btn ghost full" data-act="list">Retour aux exercices</button>`;
    }
  });
}

/* ---------- révision (boîtes de Leitner) ---------- */
const GAPS = [0, 1, 2, 4, 8, 16, 32];
const deck = () => path().filter(p => p.unlocked && C.progress.seen[p.l.id]).flatMap(p => p.l.vocab.filter(v => v[0] && v[1]).map(v => ({ it: v[0], fr: v[1], ph: v[2], src: p.l.title })));
const due = c => { const k = C.progress.cards[c.it]; return !k || k.d <= today(); };
let R;
function review() {
  ui.setTitle("🃏 Réviser", () => exercises());
  const d = deck().filter(due);
  if (!d.length) { ui.m.innerHTML = `<div class="card center"><div class="big">☕</div><p>${deck().length ? "Rien à réviser aujourd'hui. ¡Hasta mañana!" : "Aucune carte : ouvrez d'abord une leçon."}</p><button class="btn" id="bk">Retour</button></div>`; $("#bk").onclick = exercises; return; }
  R = { list: shuf(d).slice(0, 20), i: 0, flip: false, ok: 0 };
  ui.m.innerHTML = `<div class="card"><label><input type="checkbox" id="dir" ${C.progress.frFirst ? "checked" : ""}> Afficher d'abord le français (plus difficile)</label></div><button class="btn full" id="go">Commencer (${R.list.length} cartes)</button>`;
  $("#dir").onchange = e => { C.progress.frFirst = e.target.checked; saveProgress(); };
  $("#go").onclick = card;
}
function card() {
  if (R.i >= R.list.length) { ui.m.innerHTML = `<div class="card center"><div class="big">✨</div><p>Session terminée : ${R.ok} / ${R.list.length} connues du premier coup.</p><button class="btn" id="bk">Retour</button></div>`; $("#bk").onclick = exercises; return; }
  const c = R.list[R.i], fr = C.progress.frFirst;
  ui.m.innerHTML = `<div class="prog"><i style="width:${R.i / R.list.length * 100}%"></i></div>
  <div class="card flash" id="fl"><div class="mute" style="font-size:13px;font-weight:400">${esc(c.src)}</div><div>${esc(fr ? c.fr : c.it)}</div>
  ${R.flip ? `<div class="ans">${esc(fr ? c.it : c.fr)}${c.ph ? `<br><span style="color:var(--o);font-size:14px">[${esc(c.ph)}]</span>` : ""}</div>` : `<div class="ans">Touchez pour retourner</div>`}</div>
  <p><button class="btn ghost full" data-say="${esc(c.it)}">🔊 Écouter</button></p>
  ${R.flip ? `<div class="row"><button class="btn danger" id="no">Pas encore</button><button class="btn okb" id="yes">Je savais ✓</button></div>` : ""}`;
  if (!fr && !R.flip) speak(c.it);
  $("#fl").onclick = () => { if (!R.flip) { R.flip = true; if (fr) speak(c.it); card(); } };
  if (R.flip) {
    $("#yes").onclick = () => { const k = C.progress.cards[c.it] || { b: 0 }; k.b = Math.min(k.b + 1, GAPS.length - 1); k.d = today() + GAPS[k.b]; C.progress.cards[c.it] = k; if (!c.retry) R.ok++; saveProgress(); R.i++; R.flip = false; card(); };
    $("#no").onclick = () => { C.progress.cards[c.it] = { b: 0, d: today() }; saveProgress(); R.list.push({ ...c, retry: 1 }); R.i++; R.flip = false; card(); };
  }
}

/* ======================= MON COMPTE ======================= */
function account() {
  ui.setTitle("👤 Mon compte");
  const P = path(), passed = P.filter(p => p.passed).length, att = Object.values(C.progress.attempts).reduce((a, b) => a + b.length, 0);
  ui.m.innerHTML = prevBanner() + `<div class="card"><h2 style="margin:0">${esc(C.profile.name || "Mon compte")}</h2><div class="mute">${esc(C.profile.email)}</div></div>
  <div class="kpi"><div><b>${passed} / ${P.length}</b><span class="mute">leçons réussies</span></div><div><b>${att}</b><span class="mute">séries d'exercices</span></div></div>
  ${C.plan.message ? `<div class="prof">💬 <b>Message de votre professeur</b>\n${esc(C.plan.message)}</div>` : ""}
  <div class="card"><b>Mes scores</b>${P.filter(p => p.unlocked).map(p => `<div class="vrow"><div class="row" style="align-items:center"><span>${esc(p.l.emoji)} ${esc(p.l.title)}</span><span class="mute" style="flex:none">${p.score ? p.score + " %" : "—"}</span></div><div class="minibar"><i style="width:${p.score || 0}%"></i></div></div>`).join("") || '<p class="mute">Pas encore de score.</p>'}</div>
  <div class="card"><b>Mon prénom</b><div class="row" style="margin-top:6px"><input type="text" id="nm" value="${esc(C.profile.name || "")}"><button class="btn" style="flex:none" id="svn">Enregistrer</button></div></div>
  <div class="card" id="pwbox"></div>
  <div class="card"><b>Voix</b><p class="mute">Vitesse de lecture de l'espagnol.</p><button class="btn ghost" id="spd2">${voiceState.slow ? "🐢 Lente (toucher pour normale)" : "🔊 Normale (toucher pour lente)"}</button></div>
  ${C.preview ? "" : `<button class="btn ghost full" id="out">Se déconnecter</button>`}`;
  $("#svn").onclick = async () => { if (C.preview) return; C.profile.name = $("#nm").value.trim(); try { await C.api.set("users/" + C.user.uid, { name: C.profile.name }); ui.toast("Prénom enregistré"); } catch (e) { ui.toast(authError(e)); } };
  passwordBox($("#pwbox"), async pw => { if (C.preview) { ui.toast("Aperçu : rien n'est modifié."); return false; } try { await C.api.changePassword(pw); ui.toast("Mot de passe changé ✓"); return true; } catch (e) { ui.toast(authError(e), 5000); return false; } });
  $("#spd2").onclick = () => { toggleSlow(); $("#spd").textContent = voiceState.slow ? "🐢 lent" : "🔊 normal"; account(); };
  const o = $("#out"); if (o) o.onclick = () => C.api.logout();
}
