const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Configuration de la base de données (à adapter selon votre config)
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'your_mysql_password',
    database: 'facebook_automation'
};

const pool = mysql.createPool(dbConfig);

// Middleware d'authentification pour les API
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Non authentifié' });
    }
    next();
};

// ========== GESTION DES PAGES FACEBOOK ==========

// Supprimer une page
router.delete('/pages/:pageId', requireAuth, async (req, res) => {
    try {
        const { pageId } = req.params;
        
        // Supprimer toutes les données associées à cette page
        await pool.execute('DELETE FROM predefined_responses WHERE user_id = ? AND page_id = ?', [req.session.userId, pageId]);
        await pool.execute('DELETE FROM ai_configs WHERE user_id = ? AND page_id = ?', [req.session.userId, pageId]);
        await pool.execute('DELETE FROM automation_scenarios WHERE user_id = ? AND page_id = ?', [req.session.userId, pageId]);
        await pool.execute('DELETE FROM facebook_pages WHERE user_id = ? AND page_id = ?', [req.session.userId, pageId]);

        res.json({ success: true, message: 'Page supprimée avec succès' });
    } catch (error) {
        console.error('Erreur suppression page:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Activer/Désactiver une page
router.put('/pages/:pageId/toggle', requireAuth, async (req, res) => {
    try {
        const { pageId } = req.params;
        const { isActive } = req.body;
        
        await pool.execute(
            'UPDATE facebook_pages SET is_active = ? WHERE user_id = ? AND page_id = ?',
            [isActive, req.session.userId, pageId]
        );

        res.json({ success: true, message: `Page ${isActive ? 'activée' : 'désactivée'} avec succès` });
    } catch (error) {
        console.error('Erreur toggle page:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ========== TEST DE CONFIGURATION ==========

// Tester une réponse prédéfinie
router.post('/test/predefined', requireAuth, async (req, res) => {
    try {
        const { pageId, testMessage } = req.body;
        
        if (!pageId || !testMessage) {
            return res.status(400).json({ error: 'Champs requis manquants' });
        }

        // Chercher une réponse correspondante
        const [responses] = await pool.execute(
            'SELECT keyword, response, priority FROM predefined_responses WHERE user_id = ? AND page_id = ? AND LOWER(?) LIKE CONCAT("%", LOWER(keyword), "%") AND is_active = TRUE ORDER BY priority DESC LIMIT 1',
            [req.session.userId, pageId, testMessage]
        );

        if (responses.length > 0) {
            res.json({
                found: true,
                keyword: responses[0].keyword,
                response: responses[0].response,
                priority: responses[0].priority
            });
        } else {
            res.json({
                found: false,
                message: 'Aucune réponse prédéfinie trouvée pour ce message'
            });
        }
    } catch (error) {
        console.error('Erreur test réponse prédéfinie:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Tester la configuration IA
router.post('/test/ai', requireAuth, async (req, res) => {
    try {
        const { pageId, testMessage } = req.body;
        
        if (!pageId || !testMessage) {
            return res.status(400).json({ error: 'Champs requis manquants' });
        }

        // Récupérer la config IA
        const [configs] = await pool.execute(
            'SELECT * FROM ai_configs WHERE user_id = ? AND page_id = ? AND is_active = TRUE',
            [req.session.userId, pageId]
        );

        if (configs.length === 0) {
            return res.json({
                success: false,
                message: 'Aucune configuration IA active trouvée pour cette page'
            });
        }

        const config = configs[0];
        
        try {
            let aiResponse = '';

            if (config.provider === 'openai') {
                const axios = require('axios');
                const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                    model: config.model,
                    messages: [
                        { role: 'system', content: config.instructions || 'Tu es un assistant utile.' },
                        { role: 'user', content: testMessage }
                    ],
                    temperature: config.temperature || 0.7,
                    max_tokens: 150
                }, {
                    headers: { 'Authorization': `Bearer ${config.api_key}` }
                });
                aiResponse = response.data.choices[0].message.content;
            } else if (config.provider === 'mistral') {
                // Implémentation Mistral (exemple)
                aiResponse = `[Réponse Mistral simulée pour: "${testMessage}"]`;
            } else if (config.provider === 'claude') {
                // Implémentation Claude (exemple)  
                aiResponse = `[Réponse Claude simulée pour: "${testMessage}"]`;
            }

            res.json({
                success: true,
                response: aiResponse,
                provider: config.provider,
                model: config.model
            });

        } catch (aiError) {
            console.error('Erreur IA:', aiError);
            res.json({
                success: false,
                message: 'Erreur lors de la génération de la réponse IA',
                error: aiError.response?.data?.error?.message || aiError.message
            });
        }

    } catch (error) {
        console.error('Erreur test IA:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router; GESTION DES RÉPONSES PRÉDÉFINIES ==========

// Obtenir toutes les réponses prédéfinies
router.get('/responses/:pageId', requireAuth, async (req, res) => {
    try {
        const { pageId } = req.params;
        const [responses] = await pool.execute(
            'SELECT * FROM predefined_responses WHERE user_id = ? AND page_id = ? ORDER BY priority DESC, created_at DESC',
            [req.session.userId, pageId]
        );
        res.json(responses);
    } catch (error) {
        console.error('Erreur récupération réponses:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Ajouter une réponse prédéfinie
router.post('/responses', requireAuth, async (req, res) => {
    try {
        const { pageId, keyword, response, priority } = req.body;
        
        if (!pageId || !keyword || !response) {
            return res.status(400).json({ error: 'Champs requis manquants' });
        }

        await pool.execute(
            'INSERT INTO predefined_responses (user_id, page_id, keyword, response, priority) VALUES (?, ?, ?, ?, ?)',
            [req.session.userId, pageId, keyword, response, priority || 1]
        );

        res.json({ success: true, message: 'Réponse ajoutée avec succès' });
    } catch (error) {
        console.error('Erreur ajout réponse:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Modifier une réponse prédéfinie
router.put('/responses/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { keyword, response, priority, isActive } = req.body;

        await pool.execute(
            'UPDATE predefined_responses SET keyword = ?, response = ?, priority = ?, is_active = ? WHERE id = ? AND user_id = ?',
            [keyword, response, priority, isActive, id, req.session.userId]
        );

        res.json({ success: true, message: 'Réponse modifiée avec succès' });
    } catch (error) {
        console.error('Erreur modification réponse:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Supprimer une réponse prédéfinie
router.delete('/responses/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        await pool.execute(
            'DELETE FROM predefined_responses WHERE id = ? AND user_id = ?',
            [id, req.session.userId]
        );

        res.json({ success: true, message: 'Réponse supprimée avec succès' });
    } catch (error) {
        console.error('Erreur suppression réponse:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ========== GESTION DE LA CONFIGURATION IA ==========

// Obtenir la configuration IA d'une page
router.get('/ai-config/:pageId', requireAuth, async (req, res) => {
    try {
        const { pageId } = req.params;
        const [configs] = await pool.execute(
            'SELECT id, provider, model, temperature, instructions, tone, style, is_active FROM ai_configs WHERE user_id = ? AND page_id = ?',
            [req.session.userId, pageId]
        );
        
        res.json(configs[0] || null);
    } catch (error) {
        console.error('Erreur récupération config IA:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Sauvegarder/Mettre à jour la configuration IA
router.post('/ai-config', requireAuth, async (req, res) => {
    try {
        const { pageId, provider, apiKey, model, temperature, instructions, tone, style, isActive } = req.body;
        
        if (!pageId || !provider || !apiKey || !model) {
            return res.status(400).json({ error: 'Champs requis manquants' });
        }

        // Vérifier si une config existe déjà
        const [existing] = await pool.execute(
            'SELECT id FROM ai_configs WHERE user_id = ? AND page_id = ?',
            [req.session.userId, pageId]
        );

        if (existing.length > 0) {
            // Mettre à jour
            await pool.execute(
                'UPDATE ai_configs SET provider = ?, api_key = ?, model = ?, temperature = ?, instructions = ?, tone = ?, style = ?, is_active = ? WHERE user_id = ? AND page_id = ?',
                [provider, apiKey, model, temperature || 0.7, instructions, tone, style, isActive, req.session.userId, pageId]
            );
        } else {
            // Créer nouveau
            await pool.execute(
                'INSERT INTO ai_configs (user_id, page_id, provider, api_key, model, temperature, instructions, tone, style, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [req.session.userId, pageId, provider, apiKey, model, temperature || 0.7, instructions, tone, style, isActive]
            );
        }

        res.json({ success: true, message: 'Configuration IA sauvegardée' });
    } catch (error) {
        console.error('Erreur sauvegarde config IA:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ========== GESTION DES SCÉNARIOS ==========

// Obtenir tous les scénarios d'une page
router.get('/scenarios/:pageId', requireAuth, async (req, res) => {
    try {
        const { pageId } = req.params;
        const [scenarios] = await pool.execute(
            'SELECT * FROM automation_scenarios WHERE user_id = ? AND page_id = ? ORDER BY created_at DESC',
            [req.session.userId, pageId]
        );
        res.json(scenarios);
    } catch (error) {
        console.error('Erreur récupération scénarios:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Créer un nouveau scénario
router.post('/scenarios', requireAuth, async (req, res) => {
    try {
        const { pageId, name, triggerType, actionType, isActive } = req.body;
        
        if (!pageId || !name) {
            return res.status(400).json({ error: 'Champs requis manquants' });
        }

        await pool.execute(
            'INSERT INTO automation_scenarios (user_id, page_id, name, trigger_type, action_type, is_active) VALUES (?, ?, ?, ?, ?, ?)',
            [req.session.userId, pageId, name, triggerType || 'new_message', actionType || 'predefined', isActive !== false]
        );

        res.json({ success: true, message: 'Scénario créé avec succès' });
    } catch (error) {
        console.error('Erreur création scénario:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Modifier un scénario
router.put('/scenarios/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, triggerType, actionType, isActive } = req.body;

        await pool.execute(
            'UPDATE automation_scenarios SET name = ?, trigger_type = ?, action_type = ?, is_active = ? WHERE id = ? AND user_id = ?',
            [name, triggerType, actionType, isActive, id, req.session.userId]
        );

        res.json({ success: true, message: 'Scénario modifié avec succès' });
    } catch (error) {
        console.error('Erreur modification scénario:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Supprimer un scénario
router.delete('/scenarios/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        await pool.execute(
            'DELETE FROM automation_scenarios WHERE id = ? AND user_id = ?',
            [id, req.session.userId]
        );

        res.json({ success: true, message: 'Scénario supprimé avec succès' });
    } catch (error) {
        console.error('Erreur suppression scénario:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ========== HISTORIQUE DES MESSAGES ==========

// Obtenir l'historique des messages d'une page
router.get('/history/:pageId', requireAuth, async (req, res) => {
    try {
        const { pageId } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        
        const [messages] = await pool.execute(
            'SELECT * FROM message_history WHERE user_id = ? AND page_id = ? ORDER BY processed_at DESC LIMIT ? OFFSET ?',
            [req.session.userId, pageId, parseInt(limit), parseInt(offset)]
        );
        
        res.json(messages);
    } catch (error) {
        console.error('Erreur récupération historique:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ========== STATISTIQUES ==========

// Obtenir les statistiques d'une page
router.get('/stats/:pageId', requireAuth, async (req, res) => {
    try {
        const { pageId } = req.params;
        
        // Statistiques des 30 derniers jours
        const [stats] = await pool.execute(`
            SELECT 
                COUNT(*) as total_messages,
                SUM(CASE WHEN response_type = 'predefined' THEN 1 ELSE 0 END) as predefined_responses,
                SUM(CASE WHEN response_type = 'ai' THEN 1 ELSE 0 END) as ai_responses,
                SUM(CASE WHEN response_type = 'none' THEN 1 ELSE 0 END) as no_responses
            FROM message_history 
            WHERE user_id = ? AND page_id = ? AND processed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `, [req.session.userId, pageId]);

        // Messages par jour (7 derniers jours)
        const [dailyStats] = await pool.execute(`
            SELECT 
                DATE(processed_at) as date,
                COUNT(*) as messages_count
            FROM message_history 
            WHERE user_id = ? AND page_id = ? AND processed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(processed_at)
            ORDER BY date DESC
        `, [req.session.userId, pageId]);

        res.json({
            summary: stats[0],
            daily: dailyStats
        });
    } catch (error) {
        console.error('Erreur récupération statistiques:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==========
