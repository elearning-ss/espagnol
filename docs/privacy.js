// Confidentialité (RGPD) : texte de la politique, affichage, accord de l'élève.
//   settings/privacy : { text, v, updatedAt }  — lisible sans connexion (écran d'accueil)
//   users/{uid}      : { consentAt, consentV }
import { $, esc, mdLite } from "./core.js";
import { modal } from "./ui.js";

export const DEFAULT_PRIVACY = `# Politique de confidentialité

Cette application sert aux cours particuliers d'espagnol donnés par Stéphanie Sirimarco. Elle vous permet de suivre vos leçons, de faire vos exercices et d'échanger avec votre professeure. Cette page explique quelles données sont utilisées, pourquoi, et quels sont vos droits.

## Qui est responsable de vos données ?
Stéphanie Sirimarco, professeure d'espagnol, Belgique.
Contact pour toute question sur vos données : ste_ss@hotmail.com

## Quelles données ?
- Votre adresse e-mail et votre prénom (pour créer votre compte et vous connecter).
- Votre parcours : leçons ouvertes, scores, essais, mots révisés, devoirs.
- Ce que vous écrivez dans l'application : messages, rédactions, mots de votre carnet.
- Les dates de vos connexions et de vos activités.
- Si vous le souhaitez, une photo de profil (facultative). Elle n'est visible que par vous et vos professeurs, jamais par les autres élèves, et vous pouvez la retirer à tout moment dans « Mon compte ».

Aucune donnée bancaire, aucune géolocalisation, aucune publicité. Votre mot de passe n'est jamais visible par la professeure.

## Pourquoi ?
Uniquement pour organiser et suivre vos cours : adapter votre parcours, corriger vos exercices et vos rédactions, préparer les séances et répondre à vos messages. Ce traitement est nécessaire à l'exécution des cours que vous avez demandés (article 6.1.b du RGPD). Vos données ne sont ni vendues, ni cédées, ni utilisées à d'autres fins.

## Qui y a accès ?
- Votre professeure (et, le cas échéant, un autre professeur qu'elle a désigné comme administrateur).
- Les autres élèves n'y ont pas accès.
- Hébergement : les données sont stockées chez Google (service Firebase), qui agit comme sous-traitant. Selon l'emplacement du serveur, elles peuvent être traitées en dehors de l'Union européenne ; Google encadre ces transferts par les garanties prévues par le RGPD (clauses contractuelles types de la Commission européenne, cadre de protection des données UE–États-Unis).
- Le site lui-même est publié par GitHub Pages ; comme tout site web, les serveurs techniques peuvent enregistrer temporairement votre adresse IP.

## Cookies et stockage sur votre appareil
L'application n'utilise aucun cookie publicitaire ni outil de mesure d'audience. Elle garde seulement sur votre appareil ce qui est nécessaire à son fonctionnement : votre session de connexion, une copie des données pour fonctionner hors ligne, et vos préférences d'affichage.

## Combien de temps ?
Pendant la durée de vos cours, puis au plus 12 mois après votre dernier cours, sauf si vous demandez la suppression avant. Les sauvegardes faites par la professeure sont conservées au plus 12 mois.

## Vos droits
Vous pouvez à tout moment demander l'accès à vos données, leur correction, leur suppression, leur portabilité, ou vous opposer à leur traitement. Dans « Mon compte », vous pouvez télécharger vos données et demander la suppression de votre compte. Vous pouvez aussi écrire à ste_ss@hotmail.com : une réponse vous sera donnée dans un délai d'un mois.

Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une plainte auprès de l'Autorité de protection des données, rue de la Presse 35, 1000 Bruxelles, https://www.autoriteprotectiondonnees.be

## Âge
L'application est réservée aux personnes de 18 ans ou plus.`;

let cache = null;
export async function loadPrivacy(api, fresh = false) {
  if (cache && !fresh) return cache;
  try { const d = await api.get("settings/privacy"); cache = { text: d?.text || DEFAULT_PRIVACY, v: d?.v || 1, updatedAt: d?.updatedAt || 0 }; }
  catch (e) { cache = { text: DEFAULT_PRIVACY, v: 1, updatedAt: 0 }; }
  return cache;
}
export const privacyHtml = p => `<div class="policy">${mdLite(p.text)}${p.updatedAt ? `<p class="mute">Dernière mise à jour : ${new Date(p.updatedAt).toLocaleDateString("fr-BE")}</p>` : ""}</div>`;
export async function showPrivacy(api) {
  const p = await loadPrivacy(api);
  return modal({ title: "🔒 Confidentialité", wide: true, body: privacyHtml(p), buttons: [{ label: "Fermer", primary: true }] }).result;
}
export const needsConsent = async (api, profile) => !profile.consentAt || (profile.consentV || 1) < (await loadPrivacy(api)).v;

/* Écran d'accord à la première connexion (ou après une mise à jour importante de la politique). */
export function consentScreen(api, user, profile) {
  return new Promise(async res => {
    const p = await loadPrivacy(api), again = !!profile.consentAt;
    const m = $("#m");
    m.innerHTML = `<div class="login"><div class="card"><div class="center"><div class="big">🔒</div><h2 style="margin:0">${again ? "La politique de confidentialité a changé" : "Bienvenue !"}</h2></div>
      <p>${again ? "Merci de relire la politique de confidentialité mise à jour avant de continuer." : "Avant de commencer, voici comment vos données sont utilisées : uniquement pour vos cours d'espagnol, par votre professeure, sans publicité ni revente."}</p>
      <details class="pol"><summary>📄 Lire la politique de confidentialité</summary>${privacyHtml(p)}</details>
      <label class="ck"><input type="checkbox" id="cs1"> J'ai lu la politique de confidentialité et j'accepte que mes données soient utilisées pour le suivi de mes cours.</label>
      <label class="ck"><input type="checkbox" id="cs2"> Je confirme avoir 18 ans ou plus.</label>
      <p><button class="btn full" id="csok" disabled>Continuer</button></p>
      <p class="center"><a href="#" id="csno" class="mute">Je refuse (me déconnecter)</a></p></div></div>`;
    const upd = () => $("#csok").disabled = !($("#cs1").checked && $("#cs2").checked);
    $("#cs1").onchange = upd; $("#cs2").onchange = upd;
    $("#csok").onclick = async () => {
      $("#csok").disabled = true;
      const d = { consentAt: Date.now(), consentV: p.v };
      try { await api.set("users/" + user.uid, d); Object.assign(profile, d); res(true); }
      catch (e) { $("#csok").disabled = false; m.insertAdjacentHTML("afterbegin", `<div class="warn">Enregistrement impossible : ${esc(e.message || e)}</div>`); }
    };
    $("#csno").onclick = e => { e.preventDefault(); res(false); };
  });
}
