# Savoir — encyclopédie collaborative

Ce dossier contient une première version visuelle et interactive du site.

## Lancer la démo sur ton Mac

1. Décompresse `encyclopedie-collaborative.zip`.
2. Ouvre le dossier.
3. Double-clique sur `index.html` (ou ouvre-le dans Firefox).

La recherche, les catégories, la lecture des articles et le formulaire de publication fonctionnent en mode démonstration. Les articles créés sont sauvegardés dans le navigateur utilisé (`localStorage`). Ils ne sont donc PAS partagés entre plusieurs élèves.

## Passer à un vrai site collaboratif

Pour que tous les élèves voient les mêmes articles et puissent créer un compte, il faut connecter le site à Supabase.

### 1. Créer le projet Supabase

- Crée un compte sur https://supabase.com/
- Crée un projet (Free).
- Dans **SQL Editor**, exécute le contenu du fichier `supabase.sql`.
- Dans **Project Settings → API**, récupère l'URL du projet et la clé `anon` / publishable.

### 2. Connecter le frontend

Le fichier `supabase-config.example.js` donne le modèle de configuration. La prochaine étape de développement consiste à remplacer le stockage local de `app.js` par les appels Supabase et à activer l'inscription / connexion. Ne mets JAMAIS une clé `service_role` dans le navigateur.

### 3. Publier gratuitement

- Mets le dossier dans un dépôt GitHub.
- Connecte ce dépôt à Vercel : https://vercel.com/
- Déploie le projet. Pour cette version HTML/CSS/JS, les réglages de build peuvent rester vides et le dossier racine est le dossier du site.
- Tu obtiendras une adresse publique en `vercel.app`.

**À savoir :** les offres gratuites ont des quotas et conditions. Vercel Hobby est prévu pour des projets personnels/non commerciaux. Supabase Free peut mettre en pause un projet inactif pendant une semaine. Consulte les pages officielles avant de publier pour vérifier les conditions en vigueur.

## Fichiers

- `index.html` : structure des pages et fenêtres.
- `style.css` : design responsive.
- `app.js` : recherche, filtres, lecture et création locale d'articles.
- `supabase.sql` : structure de départ de la base distante.
- `supabase-config.example.js` : exemple de configuration (à compléter).
