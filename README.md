# Savoir — encyclopédie collaborative

Savoir est une encyclopédie collaborative en français. Les membres peuvent consulter les articles et proposer leurs propres connaissances. Les contributions sont examinées par un administrateur avant leur publication.

## Fonctionnalités

- Recherche d’articles, filtres par thème et tri.
- Sélection d’articles recommandés selon l’historique de lecture.
- Création de compte, connexion et récupération du mot de passe.
- Profil membre et gestion du compte.
- Propositions de nouveaux articles et de modifications.
- Modération obligatoire : les contributions restent en attente jusqu’à leur approbation par un administrateur.
- Espace d’administration réservé aux administrateurs : validation ou refus des contributions, gestion des comptes et des permissions.
- Thèmes clair, sombre, OLED et Noël.
- Interface responsive.

## Modération des contributions

1. Un membre connecté envoie un nouvel article ou une modification.
2. La proposition est enregistrée avec le statut « en attente » ; elle n’est pas publiée immédiatement.
3. Un administrateur ouvre **Menu → Administration → Contributions à valider**.
4. Il peut consulter la proposition, puis choisir **Approuver et publier** ou **Refuser**.
5. Une modification approuvée remplace le contenu publié ; une proposition refusée n’est pas publiée.

L’accès aux fonctions d’administration doit rester réservé aux comptes ayant le rôle administrateur.

## Technologies

- HTML, CSS et JavaScript côté interface.
- Supabase pour l’authentification, la base de données et les fonctions serveur.
- GitHub pour le versionnement du code et le déploiement du site.

## Structure du projet

- `index.html` : structure de l’interface et des fenêtres.
- `style.css` : styles, thèmes et mise en page responsive.
- `app-supabase.js` : logique de l’application, authentification, articles et administration.
- `supabase.sql` : scripts SQL de référence pour la base de données.
- `supabase-config.js` : configuration locale du projet Supabase (fichier de configuration à ne pas publier avec des secrets).

## Développement

1. Clone le dépôt.
2. Configure le projet Supabase et les paramètres nécessaires dans `supabase-config.js`.
3. Ouvre le site avec un serveur HTTP local pour tester les fonctionnalités.
4. Publie les modifications sur la branche principale pour déclencher le déploiement configuré dans le dépôt.

**Sécurité :** ne place jamais une clé Supabase `service_role`, un mot de passe ou un secret privé dans le code frontend ou dans un dépôt public. Seule une clé publique destinée au navigateur peut être utilisée côté client, avec les politiques RLS et les contrôles serveur correctement configurés.
