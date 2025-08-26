# 🤖 Facebook Automation Platform

Une plateforme complète permettant à chaque utilisateur d'automatiser ses pages Facebook avec des chatbots intelligents combinant réponses prédéfinies et IA.

## 📋 Fonctionnalités

### 🔐 Gestion des utilisateurs
- Inscription/connexion sécurisée
- Chaque utilisateur a son espace isolé
- Configuration personnalisée des identifiants Facebook
- Stockage sécurisé des tokens et clés API

### 📱 Gestion des pages Facebook  
- Connexion OAuth Facebook pour chaque page
- Support multi-pages par utilisateur
- Activation/désactivation des automatisations
- Tokens long-lived gérés automatiquement

### 💬 Chatbot à réponses prédéfinies
- Système de mots-clés avec priorités
- Réponses programmées personnalisables
- Interface de gestion intuitive
- Testeur de réponses intégré

### 🧠 IA optionnelle en fallback
- Support OpenAI (GPT), Mistral AI, Claude
- Configuration personnalisable (ton, style, instructions)
- Clés API gérées par l'utilisateur
- Réponses générées quand aucun mot-clé ne correspond

### 📊 Dashboard et analytics
- Vue d'ensemble des statistiques
- Historique des messages traités
- Suivi des performances (réponses auto vs IA)
- Interface responsive et moderne

## 🛠 Installation

### Prérequis
- Node.js >= 16.0.0
- MySQL >= 8.0
- Compte Facebook Developer

### 1. Cloner le projet
```bash
git clone <url-du-projet>
cd facebook-automation-platform
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configuration de la base de données
1. Créer une base de données MySQL :
```sql
CREATE DATABASE facebook_automation;
```

2. Configurer la connexion dans `server.js` :
```javascript
const dbConfig = {
    host: 'localhost',
    user: 'votre_utilisateur_mysql',
    password: 'votre_mot_de_passe_mysql',
    database: 'facebook_automation'
};
```

3. Importer la structure de la base :
```bash
mysql -u votre_utilisateur -p facebook_automation < database.sql
```

### 4. Configuration Facebook (par utilisateur)

Chaque utilisateur doit configurer ses propres identifiants Facebook lors de l'inscription :

#### Créer une application Facebook
1. Aller sur https://developers.facebook.com/apps
2. Cliquer sur "Créer une app" → "Entreprise" 
3. Remplir les informations de l'app
4. Noter l'**App ID** et l'**App Secret**

#### Configurer les webhooks
1. Dans l'app Facebook, ajouter le produit "Webhooks"
2. Configurer l'URL : `https://votre-domaine.com/api/webhook`
3. Créer un token de vérification personnalisé

#### Obtenir les tokens de page
1. Utiliser l'explorateur d'API Graph Facebook
2. Générer un token d'accès pour chaque page
3. Échanger contre un token long-lived (60 jours)

### 5. Démarrage du serveur
```bash
# Mode développement
npm run dev

# Mode production
npm start
```

Le serveur démarre sur http://localhost:3000

## 📁 Structure du projet

```
facebook-automation-platform/
├── server.js              # Serveur principal
├── api.js                 # Routes API
├── package.json           # Configuration npm
├── database.sql           # Structure base de données
├── README.md             # Ce fichier
└── public/
    ├── login.html        # Page de connexion/inscription  
    └── dashboard.html    # Interface utilisateur
```

## 🔧 Configuration avancée

### Variables d'environnement (optionnel)
Créer un fichier `.env` pour la configuration globale :
```env
PORT=3000
SESSION_SECRET=votre_secret_session_aleatoire
MYSQL_HOST=localhost
MYSQL_USER=votre_utilisateur
MYSQL_PASSWORD=votre_mot_de_passe
MYSQL_DATABASE=facebook_automation
```

### Sécurité
- Les mots de passe sont hashés avec bcrypt
- Les sessions sont sécurisées
- Les tokens Facebook sont chiffrés en base
- Chaque utilisateur accède uniquement à ses données

## 🚀 Utilisation

### 1. Inscription
1. Accéder à la plateforme
2. Créer un compte avec vos identifiants Facebook
3. Remplir App ID, App Secret et token webhook

### 2. Connexion d'une page
1. Aller dans le dashboard
2. Cliquer "Ajouter une page"
3. Saisir l'ID, nom et token de la page

### 3. Configuration du chatbot
1. **Réponses prédéfinies** : Ajouter mots-clés → réponses
2. **Configuration IA** : Choisir fournisseur, ajouter clé API
3. **Test** : Utiliser les testeurs intégrés

### 4. Activation
1. Configurer les webhooks Facebook sur votre page
2. S'abonner aux événements "messages"
3. Les réponses automatiques sont actives !

## 🔍 API Endpoints

### Authentification
- `POST /api/register` - Inscription
- `POST /api/login` - Connexion  
- `POST /api/logout` - Déconnexion
- `GET /api/user` - Infos utilisateur

### Pages Facebook
- `GET /api/pages` - Liste des pages
- `POST /api/pages/connect` - Connecter une page
- `DELETE /api/pages/:pageId` - Supprimer une page

### Réponses prédéfinies  
- `GET /api/responses/:pageId` - Liste des réponses
- `POST /api/responses` - Ajouter une réponse
- `PUT /api/responses/:id` - Modifier une réponse
- `DELETE /api/responses/:id` - Supprimer une réponse

### Configuration IA
- `GET /api/ai-config/:pageId` - Config IA d'une page
- `POST /api/ai-config` - Sauvegarder config IA

### Historique et stats
- `GET /api/history/:pageId` - Historique des messages
- `GET /api/stats/:pageId` - Statistiques d'une page

### Tests
- `POST /api/test/predefined` - Tester réponse prédéfinie
- `POST /api/test/ai` - Tester réponse IA

### Webhooks Facebook
- `GET /api/webhook` - Vérification webhook
- `POST /api/webhook` - Réception messages

## 🤖 Fournisseurs IA supportés

### OpenAI
- Modèles : GPT-3.5-turbo, GPT-4, GPT-4-turbo
- Configuration : clé API, température, instructions

### Mistral AI  
- Modèles : Tiny, Small, Medium
- Configuration similaire à OpenAI

### Claude (Anthropic)
- Modèles : Claude 3 Haiku, Sonnet, Opus  
- Interface adaptée aux spécificités Claude

## 📊 Exemples d'utilisation

### Chatbot e-commerce
```
Mot-clé: "prix" → "Voici notre catalogue de prix : [lien]"
Mot-clé: "livraison" → "Livraison gratuite dès 50€ !"
IA fallback: Répondre de manière commerciale et engageante
```

### Support client
```
Mot-clé: "problème" → "Je vous mets en relation avec un conseiller"
Mot-clé: "horaires" → "Nous sommes ouverts du lundi au vendredi 9h-18h"
IA fallback: Répondre de manière professionnelle et utile
```

### Community manager
```
Mot-clé: "événement" → "Retrouvez tous nos événements sur [lien]"
IA fallback: Répondre de manière amicale avec des emojis
```

## 🐛 Résolution de problèmes

### Erreurs fréquentes

**"Token Facebook expiré"**
- Générer un nouveau token long-lived
- Mettre à jour dans les paramètres de la page

**"Webhook non vérifié"**  
- Vérifier que l'URL webhook est accessible
- Contrôler que le token de vérification correspond

**"Erreur IA"**
- Vérifier la validité de la clé API
- Contrôler les quotas du fournisseur IA

**"Messages non traités"**
- Vérifier que la page est active
- Contrôler les logs serveur
- Vérifier la configuration webhook Facebook

## 📞 Support

Pour toute question ou problème :
1. Consulter la documentation Facebook Developer
2. Vérifier les logs de l'application  
3. Tester les configurations étape par étape

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier LICENSE pour plus de détails.

## 🔄 Mises à jour

### Version 1.0.0
- Système d'authentification complet
- Gestion multi-pages par utilisateur
- Chatbot avec réponses prédéfinies  
- Intégration IA (OpenAI, Mistral, Claude)
- Dashboard avec statistiques
- Interface responsive

### Roadmap
- [ ] Support de plus de fournisseurs IA
- [ ] Système de templates de réponses
- [ ] Analytics avancés
- [ ] API publique pour intégrations
- [ ] Support multilingue
- [ ] Mode debug pour développeurs
