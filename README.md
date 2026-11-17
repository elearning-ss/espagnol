# Paso a paso — votre application de cours d'espagnol

Application web (ordinateur, tablette, téléphone) hébergée sur **GitHub Pages**, avec les données dans **Firebase** (gratuit, sans carte bancaire).

**Espace professeur**
- 🏠 **Accueil** : la liste « À faire » (débloquer la suite pour un élève qui a réussi, élève en difficulté, élève inactif, invitation sans réponse) et l'activité récente.
- 👥 **Élèves** : vous les invitez par e-mail. Chaque élève a son **parcours en chapitres**, que vous construisez par glisser-déposer : des leçons, des documents et des dossiers. Vous pouvez aussi lui laisser une note, lui donner des exercices perso et suivre ses scores.
- 🧭 **Parcours types** : des modèles que vous appliquez en un clic à un ou plusieurs élèves, puis que vous ajustez au cas par cas.
- 🎓 **Leçons** : les 14 leçons interactives, entièrement modifiables. Un Word ou un PDF glissé ici devient une leçon.
- 🗂️ **Bibliothèque** : un explorateur de fichiers façon Windows pour vos supports de cours (PDF, Word, images, audio, vidéo…), avec dossiers, glisser-déposer et clic droit. Vous attribuez un support à un ou plusieurs élèves.

**Espace élève** : 📚 Leçons (son parcours, avec ses documents) · ✏️ Exercices · 👤 Mon compte.

---

## 0. Essayer tout de suite (mode démo)

Tant que `public/config.js` contient `firebaseConfig = null`, l'application tourne en **mode démo** : les données restent dans votre navigateur, rien n'est envoyé.

```bash
cd public
python3 -m http.server 8000
```

Ouvrez http://localhost:8000, puis cliquez sur **Entrer comme professeur**.

---

## 1. Firebase (10 minutes, une seule fois)

Sur https://console.firebase.google.com, ouvrez votre projet. Le plan gratuit **Spark** suffit : pas de carte bancaire.

**a) Authentication**
1. **Créer › Authentication › Commencer**.
2. **Mode de connexion** : activez **Adresse e-mail/Mot de passe** (premier interrupteur seulement).
3. **Utilisateurs › Ajouter un utilisateur** : créez votre compte professeur (votre e-mail et un mot de passe).
4. **Modèles › Réinitialisation du mot de passe** : passez la langue en **français** et mettez par exemple l'objet `Votre accès à Paso a paso`. C'est cet e-mail qui sert d'**invitation** à vos élèves.
5. **Paramètres › Domaines autorisés › Ajouter un domaine** : `VOTRE-PSEUDO.github.io` (sans `https://`).

**b) Firestore**
1. **Créer › Firestore Database › Créer une base de données**. Emplacement : `eur3 (europe)`. Mode : **production**.
2. Onglet **Règles** : collez tout le fichier `firestore.rules`, **remplacez `votre.email@exemple.com` par votre e-mail**, puis **Publier**.

**c) Brancher l'application**
1. ⚙️ **Paramètres du projet › Vos applications › </> (Web)** : donnez un nom, puis Enregistrer.
2. Copiez l'objet `firebaseConfig` affiché.
3. Dans `public/config.js` :
   - collez cet objet à la place de `null` ;
   - mettez votre e-mail dans `ADMIN_EMAIL`, le même que dans les règles.

> Les clés de `firebaseConfig` peuvent être publiques sans risque : c'est le fonctionnement normal de Firebase. La sécurité vient des **règles Firestore** (étape b).

---

## 2. GitHub Pages

1. Sur GitHub, créez un dépôt (par exemple `espanol`) et envoyez-y **tout le contenu** de ce dossier, y compris le dossier caché `.github`.
   - Sans ligne de commande : **Add file › Upload files**, puis glissez le contenu du dossier.
   - Avec git :
     ```bash
     git init && git add . && git commit -m "Paso a paso"
     git branch -M main
     git remote add origin https://github.com/VOTRE-PSEUDO/espanol.git
     git push -u origin main
     ```
2. Dans le dépôt : **Settings › Pages › Build and deployment › Source : GitHub Actions**.
3. Attendez environ une minute (onglet **Actions**, coche verte). Votre application est en ligne à l'adresse :
   **https://VOTRE-PSEUDO.github.io/espanol/**

Chaque fois que vous modifiez un fichier sur GitHub, le site se met à jour tout seul.

> Un dépôt **public** suffit et ne pose pas de problème : le code ne contient aucune donnée d'élève. Les leçons, documents et scores sont dans Firebase, protégés par les règles.

---

## 3. Premier lancement

1. Ouvrez votre adresse GitHub Pages et connectez-vous avec votre compte professeur.
2. **🎓 Leçons › Installer les 14 leçons de départ**. Un parcours type « Débutant » (4 chapitres) est créé en même temps.
3. **🗂️ Bibliothèque** : créez vos dossiers et glissez-y vos supports.
4. **👥 Élèves › Inviter un élève** : son prénom, son e-mail et un parcours de départ.
5. Dans la fiche de l'élève, ajustez son parcours, puis **Enregistrer** (ou Ctrl+S).

---

## Mode d'emploi express

### Bibliothèque (comme l'explorateur Windows)
| Action | Comment |
|---|---|
| Importer des fichiers | glissez-les depuis votre ordinateur dans la fenêtre, ou sur un dossier |
| Créer un dossier | **📁 Nouveau dossier**, ou clic droit dans le vide |
| Ouvrir | double-clic (un dossier s'ouvre, un fichier s'affiche) |
| Sélectionner plusieurs | Ctrl/⌘ + clic, Maj + clic, ou Ctrl+A |
| Déplacer | glissez les éléments sur un dossier (dans la liste, l'arborescence ou le fil d'Ariane), ou clic droit › Déplacer |
| Renommer / supprimer | F2 / Suppr, ou clic droit |
| Donner à des élèves | clic droit › **Attribuer aux élèves…** |
| Transformer un Word/PDF en leçon interactive | clic droit › **Créer une leçon depuis ce fichier** |

Un **dossier attribué** donne accès à tout son contenu, y compris les fichiers que vous y ajoutez plus tard.

### Parcours d'un élève
- Glissez une leçon ou un document du panneau **➕ Ajouter** (à gauche) vers un chapitre. Sur téléphone, utilisez le bouton **＋** du chapitre.
- Glissez ⠿ pour réordonner les éléments, ou pour les faire passer d'un chapitre à l'autre.
- Glissez ⠿ sur l'en-tête d'un chapitre pour réordonner les chapitres. Cliquez sur le titre pour le renommer.
- L'état de chaque élément : 🔓 **ouvert**, 🔒 **verrouillé** (l'élève le voit mais ne peut pas encore l'ouvrir) ou 🙈 **caché** (préparé, invisible).
- Le bouton ✍️ d'une leçon : une note et des exercices réservés à cet élève.
- Le menu **⋯** d'une leçon › **Ouvrir jusqu'ici** déverrouille d'un coup tout ce qui précède.
- Le menu **⋯** de la fiche : appliquer un parcours type, copier le parcours d'un autre élève, enregistrer comme parcours type, désactiver, supprimer.
- **👁️ Voir comme l'élève** montre exactement ce que l'élève voit.
- **Réglages** : déblocage manuel ou automatique, et message pour l'élève.

---

## Bon à savoir

- **Stockage des documents** : vos fichiers sont rangés dans Firestore, découpés en morceaux. C'est gratuit jusqu'à **1 Go** au total, avec **15 Mo maximum par fichier**. Pour une vidéo lourde, mettez-la sur YouTube ou Google Drive et collez le lien dans une leçon (Infos › Lien externe).
- **Invitations** : jusqu'à 150 e-mails par jour sur le plan gratuit. Si un élève ne reçoit rien, faites-lui vérifier ses spams, puis utilisez **⋯ › Renvoyer l'invitation**.
- **Leçons** : 1 Mo maximum par leçon. Les images importées sont compressées automatiquement.
- **Ancien format .doc** : réenregistrez-le en `.docx` dans Word.
- **Supprimer un élève** efface son parcours et sa progression. Pour supprimer aussi son identifiant de connexion : Firebase › Authentication. Pour couper simplement son accès : **⏸️ Désactiver**.
- **Confidentialité** : un élève ne peut lire que **ses** documents (vérifié par les règles Firestore), son parcours et ses scores. Le texte des leçons interactives publiées reste lisible par tout élève connecté.
- **Sauvegarde** : ⚙️ Compte › Télécharger la sauvegarde (leçons et parcours types).

## Fichiers

```
.github/workflows/pages.yml   publication automatique sur GitHub Pages
firestore.rules               règles de sécurité (mettez votre e-mail)
firebase.json                 (facultatif) si vous préférez Firebase Hosting
public/
  index.html, style.css       la page et son apparence
  config.js                   ← vos clés Firebase + votre e-mail
  main.js                     connexion, aiguillage professeur / élève
  admin.js                    espace professeur : menu et compte
  adm-students.js             élèves, parcours types, tableau de bord
  adm-path.js                 constructeur de parcours (glisser-déposer)
  adm-library.js              bibliothèque (explorateur)
  adm-lessons.js              leçons et exercices
  adm-state.js                données partagées, droits d'accès aux documents
  student.js                  espace élève
  core.js, ui.js, files.js    outils communs (voix, exercices, fenêtres, fichiers)
  fb.js                       accès aux données (Firebase ou démo)
  seed.js                     les 14 leçons de départ et le parcours type
```
