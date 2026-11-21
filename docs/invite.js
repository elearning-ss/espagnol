// Invitation envoyée depuis la propre messagerie du professeur (plus de mail Firebase qui fait peur).
// Le compte est créé avec un mot de passe provisoire lisible ; l'élève choisit le sien à la première connexion.
import { $, esc } from "./core.js";
import { modal, toast } from "./ui.js";

const W1 = ["Playa", "Sol", "Luna", "Mar", "Casa", "Gato", "Flor", "Río", "Pan", "Tren", "Nube", "Lago", "Toro", "Vino"];
const W2 = ["Azul", "Rojo", "Verde", "Feliz", "Alto", "Claro", "Dulce", "Nuevo", "Bueno", "Libre"];
const pick = a => a[crypto.getRandomValues(new Uint32Array(1))[0] % a.length];
export const tempPassword = () => `${pick(W1)}-${pick(W2)}-${10 + crypto.getRandomValues(new Uint32Array(1))[0] % 90}`;
export const siteUrl = () => location.origin + location.pathname.replace(/index\.html$/, "");

export function inviteText({ name, email, pw, teacher, role }) {
  const first = (name || "").trim().split(/\s+/)[0];
  const subject = role === "admin" ? "Ton accès professeur à Paso a paso" : "Vos cours d'espagnol : votre accès à Paso a paso";
  const body = role === "admin"
    ? `Bonjour${first ? " " + first : ""},

Je t'ai créé un accès professeur à Paso a paso, l'application de nos cours d'espagnol.

👉 Adresse : ${siteUrl()}
Identifiant : ${email}
Mot de passe provisoire : ${pw}

À ta première connexion, l'application te demandera de choisir ton propre mot de passe.

À bientôt,
${teacher}`
    : `Bonjour${first ? " " + first : ""},

Voici votre accès à Paso a paso, l'application de nos cours d'espagnol : vous y retrouverez vos leçons, vos exercices et vos devoirs.

👉 Adresse : ${siteUrl()}
Identifiant : ${email}
Mot de passe provisoire : ${pw}

À votre première connexion, vous choisirez votre propre mot de passe.
Astuce : sur téléphone, vous pouvez l'installer comme une application (menu du navigateur › « Ajouter à l'écran d'accueil »).

¡Hasta pronto!
${teacher}`;
  return { subject, body };
}

/* Fenêtre « Envoyer l'invitation » : texte modifiable + ouverture dans la messagerie du professeur. */
export function sendInviteDialog({ name, email, pw, teacher, role, again = false }) {
  const t = inviteText({ name, email, pw, teacher, role });
  const enc = encodeURIComponent;
  const body = `<p>${again ? "Voici à nouveau son invitation" : `✅ Le compte de <b>${esc(name || email)}</b> est créé`}. <b>Envoyez-lui maintenant ce message depuis votre propre messagerie</b> : il viendra de vous, sans avertissement de sécurité.</p>
    <div class="invpw">Mot de passe provisoire : <b>${esc(pw)}</b></div>
    <label class="f">Objet</label><input type="text" id="iv_s" value="${esc(t.subject)}">
    <label class="f">Message <small class="mute">(modifiable)</small></label><textarea id="iv_b" rows="13">${esc(t.body)}</textarea>
    <div class="invbtn">
      <button class="btn" id="iv_mail">✉️ Ouvrir dans ma messagerie</button>
      <button class="btn ghost" id="iv_out">Outlook / Hotmail (web)</button>
      <button class="btn ghost" id="iv_gm">Gmail (web)</button>
      <button class="btn ghost" id="iv_cp">📋 Copier le message</button>
    </div>
    <p class="mute" style="font-size:13px">Vous pouvez aussi l'envoyer par WhatsApp ou SMS : copiez le message et collez-le. Tant qu'il n'a pas choisi son mot de passe, vous retrouvez cette invitation dans sa fiche (⋯ › Renvoyer l'invitation).</p>`;
  return modal({ title: "✉️ Envoyer l'invitation", wide: false, body, buttons: [{ label: "Terminé", primary: true }],
    onOpen: a => {
      const B = a.body, S = () => $("#iv_s", B).value, M = () => $("#iv_b", B).value;
      // nouvel onglet ; l'application reste ouverte (si le navigateur bloque l'onglet, on le signale au lieu de quitter l'appli)
      const open = url => { const w = window.open(url, "_blank"); if (w) { try { w.opener = null; } catch (e) {} } else toast("Votre navigateur a bloqué l'ouverture : utilisez « Copier le message ».", 5000); };
      $("#iv_mail", B).onclick = () => { location.href = `mailto:${enc(email)}?subject=${enc(S())}&body=${enc(M())}`; };
      $("#iv_out", B).onclick = () => open(`https://outlook.live.com/mail/0/deeplink/compose?to=${enc(email)}&subject=${enc(S())}&body=${enc(M())}`);
      $("#iv_gm", B).onclick = () => open(`https://mail.google.com/mail/?view=cm&fs=1&to=${enc(email)}&su=${enc(S())}&body=${enc(M())}`);
      $("#iv_cp", B).onclick = async () => {
        try { await navigator.clipboard.writeText(`${S()}\n\n${M()}`); toast("Message copié ✓"); }
        catch (e) { const ta = $("#iv_b", B); ta.select(); document.execCommand("copy"); toast("Message copié ✓"); }
      };
    } }).result;
}

/* Première connexion : l'élève (ou le professeur invité) remplace son mot de passe provisoire. */
export function firstPasswordScreen(api, user, profile) {
  return new Promise(res => {
    const m = $("#m");
    m.innerHTML = `<div class="login"><div class="card"><div class="center"><div class="big">🔑</div><h2 style="margin:0">Choisissez votre mot de passe</h2></div>
      <p class="mute center">Vous vous êtes connecté avec un mot de passe provisoire. Choisissez maintenant le vôtre : c'est celui que vous utiliserez ensuite.</p>
      <div id="fp_box"></div></div></div>`;
    import("./ui.js").then(({ passwordBox }) => passwordBox($("#fp_box"), async pw => {
      try {
        await api.changePassword(pw);
        await api.set("users/" + user.uid, { mustChange: false, tempPw: null, pwSetAt: Date.now() });
        Object.assign(profile, { mustChange: false, tempPw: null });
        toast("Mot de passe enregistré ✓"); setTimeout(() => res(true), 400); return true;
      } catch (e) {
        if (/recent-login/.test(e?.code || "")) { toast("Par sécurité, reconnectez-vous avec le mot de passe provisoire, puis recommencez.", 6000); setTimeout(() => res(false), 1500); return false; }
        toast("Erreur : " + (e?.message || e), 5000); return false;
      }
    }));
  });
}
