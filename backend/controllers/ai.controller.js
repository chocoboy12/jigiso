const https = require('https');
const Anthropic = require('@anthropic-ai/sdk');
const { betaZodOutputFormat } = require('@anthropic-ai/sdk/helpers/beta/zod');
const { z } = require('zod');
const pricing = require('../services/pricing');
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

    // Mêmes consignes que la version en continu : catalogue réel et interdiction
    // d'inventer un prix (l'ancienne consigne contenait des fourchettes inventées).
    const system = await buildSystem(propertyContext);

    const reply = await callClaude(messages, system);
    res.json({ success: true, reply: reply });
  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/ai/estimate-price — loyer estimé à partir des annonces réelles
 * comparables (services/pricing.js), et non plus deviné par un modèle de
 * langage : un chiffre inventé ferait fixer un mauvais loyer. Sans assez
 * d'annonces comparables, la réponse le dit (`available: false`).
 */
exports.estimatePrice = async (req, res) => {
  try {
    const { type, city } = req.body;
    if (!type || !city) {
      return res.status(400).json({ success: false, message: 'Type et ville requis.' });
    }
    const est = await pricing.estimer(req.body);
    const prix = Number(req.body.price) || 0;
    res.json({ success: true, estimate: { ...est, verdict: pricing.situer(prix, est) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Estimation impossible pour le moment.' });
  }
};

/* ── Assistant de rédaction ─────────────────────────────────── */

const AnnonceRedigee = z.object({
  title: z.string(),
  description: z.string(),
});

const LIBELLES_EQUIPEMENTS = {
  parking: 'parking', electricity: 'électricité', water: 'eau courante',
  airConditioning: 'climatisation', wifi: 'wi-fi', kitchen: 'cuisine équipée',
  security: 'gardiennage / sécurité', generator: 'groupe électrogène',
  balcony: 'balcon', garden: 'jardin ou cour',
};

const CONSIGNE_REDACTION = `Tu rédiges des annonces de location pour JIGISO, site de location de logements au Mali, sans intermédiaire.

À partir des informations fournies par le propriétaire, écris en français :
- un titre de 70 caractères au plus, concret (type de bien, atout principal, quartier) ;
- une description de 60 à 130 mots, claire et chaleureuse, en paragraphes courts.

Règles :
- N'utilise QUE les informations fournies. N'invente aucun équipement, aucune distance, aucun commerce ou école à proximité, aucun état (« neuf », « rénové ») qui ne figure pas dans les informations. Un locataire se déplacera sur la foi de ce texte.
- Si les notes du propriétaire contiennent des détails, reprends-les fidèlement et reformule-les proprement.
- N'écris ni numéro de téléphone, ni e-mail, ni lien : le contact passe par la plateforme.
- Ne répète pas le loyer dans la description (il est affiché à part).
- Pas d'émojis, pas de majuscules d'insistance, pas de superlatifs creux (« exceptionnel », « unique »).`;

let clientClaude;
const claude = () => (clientClaude ||= new Anthropic());

/**
 * POST /api/ai/describe — propose un titre et une description à partir des
 * champs du formulaire. Le propriétaire relit et modifie avant de publier.
 */
exports.generateDescription = async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ success: false, message: "L'assistant de rédaction n'est pas configuré sur le serveur." });
  }
  const b = req.body || {};
  if (!b.type || !b.city) {
    return res.status(400).json({ success: false, message: 'Indiquez au moins le type de logement et la ville.' });
  }

  const texte = (v, max = 200) => String(v ?? '').trim().slice(0, max);
  let equipements = b.amenities;
  if (typeof equipements === 'string') { try { equipements = JSON.parse(equipements); } catch { equipements = {}; } }
  const listeEquipements = Object.entries(equipements || {})
    .filter(([k, v]) => v && LIBELLES_EQUIPEMENTS[k]).map(([k]) => LIBELLES_EQUIPEMENTS[k]);

  const infos = [
    `Type : ${texte(b.type, 40)}`,
    `Ville : ${texte(b.city, 60)}`,
    b.neighborhood && `Quartier : ${texte(b.neighborhood, 80)}`,
    b.bedrooms !== undefined && b.bedrooms !== '' && `Chambres : ${Number.parseInt(b.bedrooms, 10) || 0}`,
    b.bathrooms !== undefined && b.bathrooms !== '' && `Salles de bain : ${Number.parseInt(b.bathrooms, 10) || 0}`,
    Number(b.area) > 0 && `Surface : ${Number.parseInt(b.area, 10)} m²`,
    `Meublé : ${b.furnished === true || b.furnished === 'true' ? 'oui' : 'non'}`,
    listeEquipements.length && `Équipements : ${listeEquipements.join(', ')}`,
    texte(b.notes, 1500) && `Notes du propriétaire : ${texte(b.notes, 1500)}`,
  ].filter(Boolean).join('\n');

  try {
    /* Modèle de secours : si Claude Opus 5.5 décline la demande (filtres de
       sécurité), le serveur d'Anthropic la relance lui-même sur le modèle
       recommandé pour ce cas (`fallbacks: "default"`), dans le même appel. */
    const reponse = await claude().beta.messages.parse({
      model: 'claude-opus-5-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      max_tokens: 2000,
      output_config: { effort: 'low', format: betaZodOutputFormat(AnnonceRedigee) },
      system: CONSIGNE_REDACTION,
      messages: [{ role: 'user', content: `Informations sur le logement :\n${infos}` }],
    });

    if (reponse.model !== 'claude-opus-5-5') {
      console.log(`[rédaction IA] réponse fournie par le modèle de secours ${reponse.model}`);
    }
    // Refus de toute la chaîne (modèle principal ET secours), ou réponse illisible
    if (reponse.stop_reason === 'refusal' || !reponse.parsed_output) {
      return res.status(422).json({ success: false, message: "L'assistant n'a pas pu rédiger ce texte. Écrivez-le vous-même ou modifiez les informations." });
    }
    const { title, description } = reponse.parsed_output;
    res.json({ success: true, title: title.trim().slice(0, 100), description: description.trim().slice(0, 3000) });
  } catch (error) {
    console.error('[rédaction IA]', error.status || '', error.message);
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ success: false, message: "L'assistant est très sollicité. Réessayez dans une minute." });
    }
    if (error instanceof Anthropic.BadRequestError) {
      // Cas typique : compte Anthropic sans crédit. Rien que le propriétaire puisse corriger.
      return res.status(503).json({ success: false, message: "L'assistant de rédaction est momentanément indisponible. Écrivez votre texte vous-même : vous pourrez le relancer plus tard." });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return res.status(503).json({ success: false, message: "La clé de l'assistant de rédaction est refusée. Prévenez l'administrateur." });
    }
    res.status(502).json({ success: false, message: "L'assistant de rédaction ne répond pas pour le moment." });
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
