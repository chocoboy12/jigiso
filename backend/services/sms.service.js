/**
 * Envoi de SMS — passerelle enfichable.
 *
 * ⚠️  AUCUN opérateur n'est branché pour l'instant. Tant que
 *     SMS_PROVIDER n'est pas configuré :
 *       - en développement, le code est écrit dans la console ;
 *       - en production, l'envoi ÉCHOUE volontairement, pour ne pas
 *         laisser croire qu'un numéro a été vérifié alors que personne
 *         n'a reçu de code.
 *
 * Pour brancher un opérateur (Orange Mali, Twilio, Vonage…), implémentez
 * `send` dans le bloc correspondant et renseignez les variables d'env.
 */
const SecurityLog = require('../models/SecurityLog');

const PROVIDER = process.env.SMS_PROVIDER || 'none';

async function sendViaTwilio(to, body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
    throw new Error('Configuration Twilio incomplète');
  }
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
    }
  );
  if (!res.ok) throw new Error(`Twilio a répondu ${res.status}`);
  return res.json();
}

/**
 * @returns {Promise<{ delivered: boolean, channel: string }>}
 */
exports.sendSms = async (to, body) => {
  try {
    if (PROVIDER === 'twilio') {
      await sendViaTwilio(to, body);
      return { delivered: true, channel: 'twilio' };
    }

    // Aucun opérateur configuré
    if (process.env.NODE_ENV === 'production') {
      await SecurityLog.record({
        event: 'sms_provider_missing',
        severity: 'critical',
        meta: { to: String(to).slice(-4) },
      });
      throw new Error("Aucune passerelle SMS configurée : vérification téléphone indisponible.");
    }

    console.log(`\n[SMS · développement] vers ${to}\n   ${body}\n`);
    return { delivered: true, channel: 'console' };
  } catch (err) {
    console.error('[SMS] échec:', err.message);
    throw err;
  }
};

exports.isConfigured = () => PROVIDER !== 'none';
