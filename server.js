const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const axios = require('axios');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration de la base de données
const dbConfig = {
    host: 'sql208.infinityfree.com',
    user: 'if0_39781107',
    password: 'DurandDev237',
    database: 'if0_39781107_chatbot_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24h
}));

// Middleware d'authentification
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
};

// Routes d'authentification
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.redirect('/dashboard');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API - Inscription
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, facebookAppId, facebookAppSecret, webhookToken } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Tous les champs sont requis' });
        }

        // Vérifier si l'utilisateur existe
        const [existing] = await pool.execute(
            'SELECT id FROM users WHERE email = ? OR username = ?',
            [email, username]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Utilisateur déjà existant' });
        }

        // Hasher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insérer l'utilisateur
        const [result] = await pool.execute(
            'INSERT INTO users (username, email, password_hash, facebook_app_id, facebook_app_secret, webhook_verify_token) VALUES (?, ?, ?, ?, ?, ?)',
            [username, email, hashedPassword, facebookAppId, facebookAppSecret, webhookToken]
        );

        res.json({ success: true, message: 'Inscription réussie' });
    } catch (error) {
        console.error('Erreur inscription:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// API - Connexion
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const [users] = await pool.execute(
            'SELECT id, username, password_hash FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(400).json({ error: 'Utilisateur non trouvé' });
        }

        const user = users[0];
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(400).json({ error: 'Mot de passe incorrect' });
        }

        req.session.userId = user.id;
        req.session.username = user.username;

        res.json({ success: true, message: 'Connexion réussie' });
    } catch (error) {
        console.error('Erreur connexion:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// API - Déconnexion
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// API - Obtenir les informations utilisateur
app.get('/api/user', requireAuth, async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT username, email, facebook_app_id FROM users WHERE id = ?',
            [req.session.userId]
        );

        res.json(users[0]);
    } catch (error) {
        console.error('Erreur récupération utilisateur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// API - Obtenir les pages Facebook
app.get('/api/pages', requireAuth, async (req, res) => {
    try {
        const [pages] = await pool.execute(
            'SELECT * FROM facebook_pages WHERE user_id = ? ORDER BY created_at DESC',
            [req.session.userId]
        );

        res.json(pages);
    } catch (error) {
        console.error('Erreur récupération pages:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// API - Connecter une page Facebook
app.post('/api/pages/connect', requireAuth, async (req, res) => {
    try {
        const { pageId, pageName, accessToken } = req.body;

        // Vérifier si la page existe déjà
        const [existing] = await pool.execute(
            'SELECT id FROM facebook_pages WHERE user_id = ? AND page_id = ?',
            [req.session.userId, pageId]
        );

        if (existing.length > 0) {
            // Mettre à jour
            await pool.execute(
                'UPDATE facebook_pages SET page_name = ?, access_token = ?, is_active = TRUE WHERE user_id = ? AND page_id = ?',
                [pageName, accessToken, req.session.userId, pageId]
            );
        } else {
            // Créer nouvelle entrée
            await pool.execute(
                'INSERT INTO facebook_pages (user_id, page_id, page_name, access_token) VALUES (?, ?, ?, ?)',
                [req.session.userId, pageId, pageName, accessToken]
            );
        }

        res.json({ success: true, message: 'Page connectée avec succès' });
    } catch (error) {
        console.error('Erreur connexion page:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// API - Webhook Facebook
app.get('/api/webhook', async (req, res) => {
    const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;
    
    try {
        // Récupérer tous les tokens de vérification
        const [users] = await pool.execute('SELECT webhook_verify_token FROM users WHERE webhook_verify_token IS NOT NULL');
        const validTokens = users.map(u => u.webhook_verify_token);
        
        if (mode === 'subscribe' && validTokens.includes(token)) {
            res.status(200).send(challenge);
        } else {
            res.status(403).send('Forbidden');
        }
    } catch (error) {
        console.error('Erreur webhook verification:', error);
        res.status(500).send('Error');
    }
});

app.post('/api/webhook', async (req, res) => {
    try {
        const { object, entry } = req.body;

        if (object === 'page') {
            for (const item of entry) {
                const pageId = item.id;
                
                if (item.messaging) {
                    for (const message of item.messaging) {
                        await processMessage(pageId, message);
                    }
                }
            }
        }

        res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
        console.error('Erreur traitement webhook:', error);
        res.status(500).send('Error');
    }
});

// Fonction pour traiter les messages
async function processMessage(pageId, messageData) {
    try {
        if (!messageData.message || !messageData.message.text) return;

        const senderId = messageData.sender.id;
        const messageText = messageData.message.text;

        // Trouver la page dans notre base
        const [pages] = await pool.execute(
            'SELECT user_id, access_token FROM facebook_pages WHERE page_id = ? AND is_active = TRUE',
            [pageId]
        );

        if (pages.length === 0) return;

        const { user_id: userId, access_token: accessToken } = pages[0];

        // Chercher une réponse prédéfinie
        const [responses] = await pool.execute(
            'SELECT response FROM predefined_responses WHERE user_id = ? AND page_id = ? AND LOWER(?) LIKE CONCAT("%", LOWER(keyword), "%") AND is_active = TRUE ORDER BY priority DESC LIMIT 1',
            [userId, pageId, messageText]
        );

        let responseText = null;
        let responseType = 'none';

        if (responses.length > 0) {
            responseText = responses[0].response;
            responseType = 'predefined';
        } else {
            // Essayer l'IA en fallback
            const [aiConfig] = await pool.execute(
                'SELECT * FROM ai_configs WHERE user_id = ? AND page_id = ? AND is_active = TRUE',
                [userId, pageId]
            );

            if (aiConfig.length > 0) {
                responseText = await generateAIResponse(messageText, aiConfig[0]);
                responseType = 'ai';
            }
        }

        // Envoyer la réponse si elle existe
        if (responseText) {
            await sendFacebookMessage(pageId, senderId, responseText, accessToken);
        }

        // Enregistrer dans l'historique
        await pool.execute(
            'INSERT INTO message_history (user_id, page_id, sender_id, message_text, response_text, response_type) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, pageId, senderId, messageText, responseText, responseType]
        );

    } catch (error) {
        console.error('Erreur traitement message:', error);
    }
}

// Fonction pour envoyer un message Facebook
async function sendFacebookMessage(pageId, recipientId, message, accessToken) {
    try {
        await axios.post(`https://graph.facebook.com/v18.0/${pageId}/messages`, {
            recipient: { id: recipientId },
            message: { text: message }
        }, {
            params: { access_token: accessToken }
        });
    } catch (error) {
        console.error('Erreur envoi message Facebook:', error);
    }
}

// Fonction pour générer une réponse IA
async function generateAIResponse(message, config) {
    try {
        let response;

        if (config.provider === 'openai') {
            response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: config.model,
                messages: [
                    { role: 'system', content: config.instructions || 'Tu es un assistant utile.' },
                    { role: 'user', content: message }
                ],
                temperature: config.temperature || 0.7,
                max_tokens: 150
            }, {
                headers: { 'Authorization': `Bearer ${config.api_key}` }
            });
            return response.data.choices[0].message.content;
        }
        // Ajouter support pour Mistral et Claude ici...

    } catch (error) {
        console.error('Erreur génération IA:', error);
        return 'Désolé, je ne peux pas répondre pour le moment.';
    }
}

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
