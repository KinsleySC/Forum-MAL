# Forum

Forum web complet développé en Node.js vanilla (sans framework) avec SQLite.

## Fonctionnalités

- **Authentification** : inscription, connexion, déconnexion avec sessions via cookies
- **Posts** : création, modification, suppression avec catégories et images
- **Commentaires** : ajout, modification, suppression
- **Like / Dislike** : sur les posts et commentaires (toggle on/off)
- **Filtrage** : par catégorie, mes posts, posts likés
- **Gestion des erreurs HTTP** : 404, 403, 500
- **Upload d'images** : JPEG, PNG, GIF, WebP (max 20 Mo)

## Stack technique

- **Backend** : Node.js (module `http` natif, aucun framework)
- **Base de données** : SQLite via `better-sqlite3`
- **Sécurité** : mots de passe hashés avec `bcryptjs`
- **Sessions** : UUID v4, stockées en BDD, cookie HttpOnly
- **Frontend** : HTML / CSS / JS pur (aucun framework)
- **Containerisation** : Docker

## Lancement avec Docker

```bash
# Build l'image
docker build -t forum .

# Lancer le conteneur
docker run -p 8080:8080 forum
```

Le forum est accessible sur **http://localhost:8080**.

## Lancement sans Docker

```bash
# Installer les dépendances
npm install

# Lancer le serveur
npm start
```

## Structure du projet

```
forum/
├── server/
│   ├── index.js        # Point d'entrée du serveur HTTP
│   ├── router.js       # Routeur URL personnalisé
│   ├── database.js     # Initialisation SQLite + schéma
│   ├── session.js      # Gestion des sessions/cookies
│   ├── auth.js         # Handlers inscription/connexion
│   ├── posts.js        # Handlers posts/commentaires/votes
│   └── utils.js        # Utilitaires (parsing, templates, etc.)
├── templates/          # Pages HTML avec template engine
├── static/
│   ├── css/style.css   # Styles
│   ├── js/app.js       # JavaScript client
│   └── uploads/        # Images uploadées
├── data/               # Base de données SQLite (auto-créé)
├── Dockerfile
├── package.json
└── README.md
```

## Schéma de la base de données

- **users** : id, email, username, password, created_at
- **sessions** : id (UUID), user_id, expires_at
- **categories** : id, name
- **posts** : id, user_id, title, content, image_path, created_at, updated_at
- **post_categories** : post_id, category_id (relation N:N)
- **comments** : id, post_id, user_id, content, created_at, updated_at
- **post_votes** : id, user_id, post_id, value (+1/-1)
- **comment_votes** : id, user_id, comment_id, value (+1/-1)
