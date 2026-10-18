const https = require('https');
const { buildSystem } = require('../services/assistant.service');
const { repondre: repondreLocalement } = require('../services/assistant.local');
require('dotenv').config();

const callClaude = (messages, system) => {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return reject(new Error('ANTHROPIC_API_KEY manquant dans .env'));

    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: system,
      messages: messages,
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          if (!parsed.content || !parsed.content[0]) return reject(new Error('Reponse vide'));
          resolve(parsed.content[0].text);
        } catch (e) {
          reject(new Error('Parse error: ' + e.message));
        }
      });
    });

    req.on('error', (e) => reject(new Error('Network: ' + e.message)));
    req.write(body);
    req.end();
  });
};

exports.chat = async (req, res) => {
  try {
    const { messages, propertyContext } = req.body;
    if (!messages || !messages.length) {
      return res.status(400).json({ success: false, message: 'Messages requis.' });
    }

    const system = "Tu es MaliBot, assistant immobilier de MaliRent au Mali. Tu connais les quartiers de Bamako: ACI 2000, Hippodrome, Badalabougou, Hamdallaye, Yirimadjo. Prix: chambre 25k-75k FCFA, studio 50k-150k FCFA, appartement 100k-400k FCFA, maison 200k-800k FCFA. Reponds en francais, court et amical (2-3 phrases).";

    const reply = await callClaude(messages, system);
    res.json({ success: true, reply: reply });
  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.estimatePrice = async (req, res) => {
  try {
    const { type, city, neighborhood, bedrooms, area, furnished } = req.body;
    if (!type || !city) {
      return res.status(400).json({ success: false, message: 'Type et ville requis.' });
    }

    const system = 'Expert immobilier Mali. Reponds UNIQUEMENT en JSON valide sans texte avant ou apres.';
    const userMsg = "Estime loyer mensuel FCFA pour: " + type + " a " + city + " " + (neighborhood || '') + ", " + (bedrooms || 0) + " chambres, " + (area || 0) + "m2, " + (furnished ? 'meuble' : 'non meuble') + ". JSON: {min:0,max:0,recommended:0,confidence:'moyen',reasoning:'',tips:[]}";

    const raw = await callClaude([{ role: 'user', content: userMsg }], system);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON invalide');
    const estimate = JSON.parse(match[0]);
    res.json({ success: true, estimate: estimate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.generateDescription = async (req, res) => {
  try {
    const { type, city, neighborhood, bedrooms, area, furnished, price } = req.body;
    const system = 'Expert immobilier Mali. Ecris des descriptions en francais.';
    const userMsg = "Description courte 100 mots pour: " + type + " a " + city + " " + (neighborhood || '') + ", " + (bedrooms || 0) + " chambres, " + (area || 0) + "m2, " + (furnished ? 'meuble' : 'non meuble') + ".";
    const description = await callClaude([{ role: 'user', content: userMsg }], system);
    res.json({ success: true, description: description.trim() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Conversation en continu (Server-Sent Events).
 *
 * Claude renvoie sa réponse par fragments ; on les relaie au navigateur dès
 * qu'ils arrivent, au lieu d'attendre la phrase complète. L'utilisateur voit
 * le texte s'écrire, ce qui change complètement la perception de l'attente.
 *
 * Le flux SSE est aussi plus robuste qu'une requête longue : si la connexion
 * tombe au milieu, le navigateur garde ce qui est déjà arrivé.
 */
exports.chatStream = async (req, res) => {
  const { messages, propertyContext } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ success: false, message: 'Messages requis.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // En-têtes SSE. `X-Accel-Buffering` évite qu'un proxy retienne les fragments.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const envoyer = (evenement, donnees) => {
    res.write(`event: ${evenement}\ndata: ${JSON.stringify(donnees)}\n\n`);
  };

  /** Écrit un texte mot à mot, pour que l'affichage soit le même qu'avec le modèle. */
  const diffuser = async (texte) => {
    for (const mot of texte.split(/(\s+)/)) {
      if (!mot) continue;
      envoyer('fragment', { text: mot });
      await new Promise(r => setTimeout(r, 18));
    }
    envoyer('fin', {});
    res.end();
  };

  const derniere = [...messages].reverse().find(m => m?.role !== 'assistant')?.content || '';

  try {
    /* Moteur local d'abord : gratuit, instantané, et adossé aux données
       réelles. On ne sollicite le modèle de langage que pour les questions
       qu'il ne reconnaît pas — et seulement si une clé est configurée. */
    const local = await repondreLocalement(derniere);
    if (local.sur || !apiKey) {
      return diffuser(local.texte);
    }

    const system = await buildSystem(propertyContext);

    // On ne garde que les 12 derniers tours : au-delà, le contexte coûte cher
    // sans améliorer la réponse.
    const historique = messages.slice(-12)
      .filter(m => m && typeof m.content === 'string' && m.content.trim())
      .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user',
                   content: m.content.slice(0, 4000) }));

    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      stream: true,
      system,
      messages: historique,
    });

    const amont = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (amontRes) => {
      // Une erreur HTTP ne renvoie pas du SSE mais un JSON d'erreur : on le lit
      // tel quel, sinon l'échec passerait inaperçu.
      if (amontRes.statusCode !== 200) {
        let err = '';
        amontRes.on('data', c => { err += c; });
        amontRes.on('end', () => {
          console.error('[assistant] refus amont', amontRes.statusCode, err.slice(0, 400));
          // Le modèle est indisponible (crédit épuisé, panne, quota) : plutôt
          // qu'un message d'erreur, on sert la réponse locale. L'utilisateur
          // obtient quelque chose d'utile au lieu d'un échec.
          repondreLocalement(derniere)
            .then(local => diffuser(local.texte))
            .catch(() => { envoyer('erreur', { message: 'Assistant indisponible.' }); res.end(); });
        });
        return;
      }

      let tampon = '';

      amontRes.on('data', (chunk) => {
        tampon += chunk.toString('utf8');
        // Les événements SSE sont séparés par une ligne vide.
        const blocs = tampon.split('\n\n');
        tampon = blocs.pop();

        for (const bloc of blocs) {
          const ligne = bloc.split('\n').find(l => l.startsWith('data: '));
          if (!ligne) continue;
          try {
            const ev = JSON.parse(ligne.slice(6));
            if (ev.type === 'content_block_delta' && ev.delta?.text) {
              envoyer('fragment', { text: ev.delta.text });
            } else if (ev.type === 'error') {
              envoyer('erreur', { message: ev.error?.message || 'Erreur du modèle' });
            }
          } catch { /* fragment incomplet : on attend la suite */ }
        }
      });

      amontRes.on('end', () => { envoyer('fin', {}); res.end(); });
    });

    amont.on('error', (e) => {
      console.error('[assistant]', e.message);
      envoyer('erreur', { message: 'Assistant momentanément indisponible.' });
      res.end();
    });

    // Si la personne ferme l'onglet, on coupe l'appel en cours plutôt que de
    // payer des jetons pour une réponse que plus personne ne lira.
    //
    // On écoute `res` et non `req` : sur une requête dont le corps a déjà été
    // lu, `req` émet « close » immédiatement, ce qui tuait l'appel aussitôt.
    res.on('close', () => amont.destroy());

    amont.write(body);
    amont.end();
  } catch (error) {
    console.error('[assistant]', error.message);
    envoyer('erreur', { message: 'Assistant momentanément indisponible.' });
    res.end();
  }
};
