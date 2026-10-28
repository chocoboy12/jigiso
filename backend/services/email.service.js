/**
 * JIGISO — Service Email
 * Nodemailer + Gmail SMTP
 * Admin: goitaaboubacar6@gmail.com
 */

const nodemailer = require('nodemailer');

// ─── Configuration du transporteur ────────────────────────
/**
 * Transport SMTP, créé une seule fois et réutilisé.
 * L'API de nodemailer est `createTransport` — pas `createTransporter`,
 * qui n'existe pas et faisait échouer tout envoi.
 */
let transporter = null;

/**
 * Transport SMTP générique.
 *
 * Deux façons de configurer, au choix :
 *
 *  1) N'importe quel fournisseur (Brevo, Resend, Mailjet, OVH…) :
 *       SMTP_HOST=smtp-relay.brevo.com
 *       SMTP_PORT=587
 *       SMTP_USER=…
 *       SMTP_PASS=…
 *
 *  2) Gmail, avec un mot de passe d'application :
 *       EMAIL_USER=vous@gmail.com
 *       EMAIL_PASS=seize_lettres_minuscules
 *
 * La première l'emporte si elle est renseignée. Elle est recommandée :
 * Gmail n'est pas prévu pour l'envoi applicatif et finit souvent en spam.
 */
const getTransporter = () => {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,          // 465 = TLS direct, 587 = STARTTLS
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } else {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return transporter;
};

/** Nom du mode actif, pour les journaux. */
const providerName = () =>
  process.env.SMTP_HOST ? `SMTP (${process.env.SMTP_HOST})` : 'Gmail';

/** Le service est-il réellement utilisable ? */
const isConfigured = () => Boolean(
  (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) ||
  (process.env.EMAIL_USER && process.env.EMAIL_PASS)
);
exports.isConfigured = isConfigured;

/** Vérifie la connexion SMTP au démarrage, pour ne pas échouer en silence. */
exports.verifyConnection = async () => {
  if (!isConfigured()) {
    console.warn('[email] aucune configuration SMTP : les e-mails ne partent PAS (mode simulation).');
    console.warn('        Renseignez SMTP_HOST/SMTP_USER/SMTP_PASS, ou EMAIL_USER/EMAIL_PASS.');
    return false;
  }
  try {
    await getTransporter().verify();
    console.log(`[email] connexion vérifiée via ${providerName()} — envoi opérationnel.`);
    return true;
  } catch (err) {
    console.error('[email] connexion SMTP impossible :', err.message);
    return false;
  }
};

// Email de l'admin JIGISO
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'goitaaboubacar6@gmail.com';
const FROM_NAME = 'JIGISO';
const FROM_EMAIL = process.env.MAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || 'noreply@jigiso.ml';

// Template HTML de base
/* Adresse publique du site, pour les liens des e-mails (localhost en développement) */
const SITE = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

const baseTemplate = (content, title = 'JIGISO') => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; color: #1a1a2e; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a2e; border-radius: 16px 16px 0 0; padding: 28px 32px; text-align: center; position: relative; overflow: hidden; }
    .header::before { content: ''; position: absolute; inset-x: 0; top: 0; height: 3px; background: linear-gradient(90deg, #009A00, #C8941A, #C41E3A); }
    .logo { font-size: 26px; font-weight: 800; color: white; letter-spacing: -0.5px; }
    .logo span { color: #C8941A; }
    .flag { font-size: 18px; margin-left: 6px; }
    .header-sub { color: rgba(255,255,255,0.5); font-size: 12px; margin-top: 4px; }
    .body { background: white; padding: 36px 32px; }
    .footer { background: #f0f0f0; border-radius: 0 0 16px 16px; padding: 20px 32px; text-align: center; }
    .footer p { color: #888; font-size: 12px; line-height: 1.6; }
    .btn { display: inline-block; background: #C8941A; color: white !important; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 700; font-size: 15px; margin: 20px 0; }
    .btn-green { background: #009A00; }
    .btn-red { background: #C41E3A; }
    h1 { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 12px; }
    p { color: #555; line-height: 1.7; margin-bottom: 12px; font-size: 15px; }
    .info-box { background: #FFF8E7; border-left: 4px solid #C8941A; border-radius: 0 12px 12px 0; padding: 16px 20px; margin: 20px 0; }
    .info-box p { color: #7D5A0F; margin: 0; font-size: 14px; }
    .info-box strong { color: #543C0A; }
    .divider { border: none; border-top: 1px solid #f0f0f0; margin: 24px 0; }
    .price { font-size: 24px; font-weight: 800; color: #C8941A; }
    .badge { display: inline-block; background: #E8F5E8; color: #009A00; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-warn { background: #FFF8E7; color: #C8941A; }
    .badge-red { background: #FDECEA; color: #C41E3A; }
    .message-bubble { background: #f9f9f9; border-radius: 12px; padding: 16px 20px; margin: 16px 0; border-left: 3px solid #C8941A; }
    .message-bubble p { color: #333; margin: 0; font-style: italic; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
    td:first-child { color: #888; font-weight: 600; width: 40%; }
    td:last-child { color: #1a1a2e; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Mali<span>Rent</span><span class="flag">🇲🇱</span></div>
      <div class="header-sub">Plateforme immobilière du Mali</div>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>Cet email a été envoyé par JIGISO · Plateforme immobilière du Mali<br>
      © ${new Date().getFullYear()} JIGISO — Fait avec ❤️ au Mali<br>
      <a href="${SITE}" style="color: #C8941A;">${SITE.replace(/^https?:\/\//, '')}</a></p>
    </div>
  </div>
</body>
</html>
`;

// ─── Envoi générique ──────────────────────────────────────
/**
 * `critical` distingue les deux familles d'envois.
 *
 * Par défaut un échec est seulement journalisé : une notification en arrière-plan
 * ne doit pas faire échouer l'action de l'utilisateur. Mais pour un e-mail que
 * la personne attend — le lien de confirmation d'adresse — se taire revient à
 * afficher « envoyé » alors que rien n'est parti. Dans ce cas on relance
 * l'erreur pour que l'appelant puisse le dire franchement.
 */
const sendEmail = async ({ to, subject, html, text, critical = false }) => {
  try {
    if (!isConfigured()) {
      console.warn(
        `[email] NON ENVOYÉ (aucune configuration SMTP) → ${to} | ${subject}\n` +
        '        Renseignez EMAIL_USER et EMAIL_PASS dans backend/.env.'
      );
      if (critical) {
        const err = new Error('EMAIL_NOT_CONFIGURED');
        err.emailCode = 'EMAIL_NOT_CONFIGURED';
        throw err;
      }
      return { simulated: true };
    }
    const info = await getTransporter().sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      text: text || subject,
    });
    console.log(`✅ Email envoyé à ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Erreur envoi email à ${to}:`, error.message);
    if (critical) throw error;
    // Envoi secondaire : on n'interrompt pas l'action en cours
    return null;
  }
};

// ═══════════════════════════════════════════════════════════
// TEMPLATES D'EMAILS
// ═══════════════════════════════════════════════════════════

// ─── 1. Nouveau message entre utilisateurs ────────────────
exports.sendMessageNotification = async ({ senderName, receiverEmail, receiverName, content, propertyTitle }) => {
  const html = baseTemplate(`
    <h1>💬 Nouveau message de ${senderName}</h1>
    <p>Bonjour <strong>${receiverName}</strong>,</p>
    <p>Vous avez reçu un nouveau message sur JIGISO${propertyTitle ? ` concernant le logement <strong>${propertyTitle}</strong>` : ''} :</p>
    <div class="message-bubble">
      <p>"${content}"</p>
    </div>
    <a href="${SITE}/messages" class="btn">Répondre au message</a>
    <hr class="divider">
    <p style="font-size:13px;color:#888;">Connectez-vous à votre compte JIGISO pour répondre directement à ce message.</p>
  `, `Nouveau message de ${senderName}`);

  return sendEmail({
    to: receiverEmail,
    subject: `💬 Nouveau message de ${senderName} — JIGISO`,
    html,
  });
};

// ─── 2. Nouvelle demande de location (propriétaire) ───────
exports.sendRentalRequestToOwner = async ({ ownerEmail, ownerName, tenantName, tenantPhone, tenantEmail, propertyTitle, city, price, moveInDate, duration, message }) => {
  const html = baseTemplate(`
    <h1>🏠 Nouvelle demande de location</h1>
    <p>Bonjour <strong>${ownerName}</strong>,</p>
    <p>Vous avez reçu une demande de location pour votre annonce <strong>${propertyTitle}</strong>.</p>
    <div class="info-box">
      <p><strong>Logement demandé :</strong> ${propertyTitle}<br>
      <strong>Ville :</strong> ${city} · <strong class="price">${price ? price.toLocaleString('fr-FR') + ' FCFA' : '—'}</strong></p>
    </div>
    <table>
      <tr><td>👤 Locataire</td><td>${tenantName}</td></tr>
      <tr><td>📞 Téléphone</td><td>${tenantPhone}</td></tr>
      <tr><td>📧 Email</td><td>${tenantEmail}</td></tr>
      <tr><td>📅 Date souhaitée</td><td>${moveInDate ? new Date(moveInDate).toLocaleDateString('fr-FR') : '—'}</td></tr>
      <tr><td>⏳ Durée</td><td>${duration}</td></tr>
    </table>
    ${message ? `<div class="message-bubble"><p>"${message}"</p></div>` : ''}
    <a href="${SITE}/mes-demandes" class="btn">Gérer cette demande</a>
  `, 'Nouvelle demande de location');

  return sendEmail({
    to: ownerEmail,
    subject: `🏠 Nouvelle demande pour "${propertyTitle}" — JIGISO`,
    html,
  });
};

// ─── 3. Réponse à la demande (locataire) ─────────────────
exports.sendRentalResponseToTenant = async ({ tenantEmail, tenantName, ownerName, propertyTitle, status, ownerResponse }) => {
  const isAccepted = status === 'accepted';
  const html = baseTemplate(`
    <h1>${isAccepted ? '🎉 Demande acceptée !' : '😔 Demande refusée'}</h1>
    <p>Bonjour <strong>${tenantName}</strong>,</p>
    <p>${isAccepted
      ? `Bonne nouvelle ! Le propriétaire <strong>${ownerName}</strong> a <span class="badge">accepté votre demande</span> pour le logement <strong>${propertyTitle}</strong>.`
      : `Le propriétaire <strong>${ownerName}</strong> n'a pas pu donner suite à votre demande pour <strong>${propertyTitle}</strong>.`
    }</p>
    ${ownerResponse ? `
    <div class="message-bubble">
      <p><strong>Message du propriétaire :</strong><br>"${ownerResponse}"</p>
    </div>` : ''}
    ${isAccepted ? `
    <div class="info-box">
      <p>✅ Contactez le propriétaire pour finaliser les détails de votre location.</p>
    </div>
    <a href="${SITE}/messages" class="btn btn-green">Contacter le propriétaire</a>
    ` : `
    <p>Ne vous découragez pas ! D'autres logements correspondent peut-être à vos besoins.</p>
    <a href="${SITE}/rechercher" class="btn">Chercher d'autres logements</a>
    `}
  `, isAccepted ? 'Demande acceptée' : 'Demande refusée');

  return sendEmail({
    to: tenantEmail,
    subject: isAccepted ? `🎉 Votre demande pour "${propertyTitle}" a été acceptée !` : `Réponse à votre demande — ${propertyTitle}`,
    html,
  });
};

/* Date en toutes lettres : « 3 novembre 2026 ». */
const dateLongue = (d) => new Date(d).toLocaleDateString('fr-FR', {
  day: 'numeric', month: 'long', year: 'numeric',
});

// ─── 3 bis. Réservation confirmée (locataire) ────────────
exports.sendReservationConfirmed = async ({ tenantEmail, tenantName, ownerName, propertyTitle, until, ownerResponse }) => {
  const html = baseTemplate(`
    <h1>🔑 Logement réservé pour vous</h1>
    <p>Bonjour <strong>${tenantName}</strong>,</p>
    <p><strong>${ownerName}</strong> a accepté votre demande : le logement
       <strong>${propertyTitle}</strong> vous est <span class="badge">réservé</span>.
       Il n'apparaît plus dans les recherches et n'accepte plus d'autres demandes.</p>
    <div class="info-box">
      <p>📅 Réservé jusqu'au <strong>${dateLongue(until)}</strong>.
         Passé cette date, le logement redevient disponible pour tout le monde.</p>
    </div>
    ${ownerResponse ? `
    <div class="message-bubble">
      <p><strong>Message du propriétaire :</strong><br>"${ownerResponse}"</p>
    </div>` : ''}
    <p>Prenez contact avec le propriétaire pour convenir de la remise des clés.</p>
    <a href="${SITE}/messages" class="btn btn-green">Contacter le propriétaire</a>
  `, 'Logement réservé');

  return sendEmail({
    to: tenantEmail,
    subject: `🔑 "${propertyTitle}" vous est réservé jusqu'au ${dateLongue(until)}`,
    html,
  });
};

// ─── 3 ter. Réservation annulée (l'autre partie) ─────────
exports.sendReservationCancelled = async ({ to, recipientName, otherName, propertyTitle, byTenant }) => {
  const html = baseTemplate(`
    <h1>Réservation annulée</h1>
    <p>Bonjour <strong>${recipientName}</strong>,</p>
    <p>${byTenant
      ? `<strong>${otherName}</strong> a annulé sa réservation pour <strong>${propertyTitle}</strong>.`
      : `<strong>${otherName}</strong> a annulé votre réservation pour <strong>${propertyTitle}</strong>.`}</p>
    <div class="info-box">
      <p>${byTenant
        ? '✅ Votre logement est de nouveau visible dans les recherches et peut recevoir de nouvelles demandes.'
        : 'Le logement est de nouveau disponible pour tout le monde.'}</p>
    </div>
    <a href="${SITE}/${byTenant ? 'mes-demandes' : 'rechercher'}" class="btn">
      ${byTenant ? 'Voir mes demandes' : 'Chercher un autre logement'}
    </a>
  `, 'Réservation annulée');

  return sendEmail({ to, subject: `Réservation annulée — ${propertyTitle}`, html });
};

// ─── 4. Annonce approuvée (propriétaire) ─────────────────
exports.sendPropertyApproved = async ({ ownerEmail, ownerName, propertyTitle, propertyId }) => {
  const html = baseTemplate(`
    <h1>✅ Votre annonce est en ligne !</h1>
    <p>Bonjour <strong>${ownerName}</strong>,</p>
    <p>Bonne nouvelle ! Votre annonce <strong>"${propertyTitle}"</strong> a été <span class="badge">validée et publiée</span> sur JIGISO.</p>
    <div class="info-box">
      <p>🎉 Votre logement est maintenant visible par les locataires qui cherchent sur JIGISO.</p>
    </div>
    <a href="${SITE}/logements/${propertyId}" class="btn btn-green">Voir mon annonce</a>
    <p style="font-size:13px;color:#888;margin-top:16px;">Conseils : Répondez rapidement aux demandes pour maximiser vos chances de louer.</p>
  `, 'Annonce approuvée');

  return sendEmail({
    to: ownerEmail,
    subject: `✅ Votre annonce "${propertyTitle}" est en ligne — JIGISO`,
    html,
  });
};

// ─── 5. Annonce refusée (propriétaire) ────────────────────
exports.sendPropertyRejected = async ({ ownerEmail, ownerName, propertyTitle, reason }) => {
  const html = baseTemplate(`
    <h1>⚠️ Annonce non approuvée</h1>
    <p>Bonjour <strong>${ownerName}</strong>,</p>
    <p>Votre annonce <strong>"${propertyTitle}"</strong> n'a pas pu être approuvée pour la raison suivante :</p>
    <div class="message-bubble">
      <p>"${reason || 'Annonce non conforme à nos conditions d\'utilisation.'}"</p>
    </div>
    <p>Vous pouvez modifier votre annonce et la soumettre à nouveau.</p>
    <a href="${SITE}/mes-annonces" class="btn btn-red">Modifier mon annonce</a>
    <hr class="divider">
    <p style="font-size:13px;color:#888;">Besoin d'aide ? Contactez-nous à <a href="mailto:${ADMIN_EMAIL}" style="color:#C8941A;">${ADMIN_EMAIL}</a></p>
  `, 'Annonce refusée');

  return sendEmail({
    to: ownerEmail,
    subject: `⚠️ Votre annonce "${propertyTitle}" n'a pas été approuvée`,
    html,
  });
};

// ─── 6. Nouveau compte créé ───────────────────────────────
exports.sendWelcomeEmail = async ({ userEmail, userName, role }) => {
  const isOwner = role === 'owner';
  const html = baseTemplate(`
    <h1>Bienvenue sur JIGISO, ${userName} ! 🎉</h1>
    <p>Votre compte <strong>${isOwner ? 'propriétaire' : 'locataire'}</strong> a été créé avec succès.</p>
    <div class="info-box">
      <p>${isOwner
        ? '🏠 <strong>Propriétaire</strong> — Vous pouvez maintenant publier vos logements et recevoir des demandes de location.'
        : '🔍 <strong>Locataire</strong> — Vous pouvez maintenant chercher des logements, envoyer des demandes et sauvegarder vos favoris.'
      }</p>
    </div>
    <a href="${isOwner ? SITE + '/publier' : SITE + '/rechercher'}" class="btn">
      ${isOwner ? '🚀 Publier mon premier logement' : '🔍 Chercher un logement'}
    </a>
    <hr class="divider">
    <p style="font-size:13px;color:#888;">Des questions ? Contactez-nous : <a href="mailto:${ADMIN_EMAIL}" style="color:#C8941A;">${ADMIN_EMAIL}</a></p>
  `, 'Bienvenue sur JIGISO');

  return sendEmail({
    to: userEmail,
    subject: `🎉 Bienvenue sur JIGISO, ${userName} !`,
    html,
  });
};

// ─── 7. Contact utilisateur → Admin ──────────────────────
exports.sendContactToAdmin = async ({ senderName, senderEmail, senderPhone, subject, messageContent, type }) => {
  const typeLabels = {
    question: '❓ Question générale',
    bug: '🐛 Signalement de bug',
    partnership: '🤝 Partenariat',
    complaint: '⚠️ Réclamation',
    suggestion: '💡 Suggestion',
    other: '📋 Autre',
  };

  const html = baseTemplate(`
    <h1>📩 Nouveau message via JIGISO</h1>
    <div class="info-box">
      <p><strong>Type :</strong> ${typeLabels[type] || type}<br>
      <strong>Sujet :</strong> ${subject}</p>
    </div>
    <table>
      <tr><td>👤 Nom</td><td>${senderName}</td></tr>
      <tr><td>📧 Email</td><td><a href="mailto:${senderEmail}" style="color:#C8941A;">${senderEmail}</a></td></tr>
      ${senderPhone ? `<tr><td>📞 Téléphone</td><td>${senderPhone}</td></tr>` : ''}
    </table>
    <p><strong>Message :</strong></p>
    <div class="message-bubble">
      <p>${messageContent.replace(/\n/g, '<br>')}</p>
    </div>
    <a href="mailto:${senderEmail}?subject=Re: ${subject}" class="btn">Répondre directement</a>
    <p style="font-size:12px;color:#aaa;margin-top:12px;">Reçu le ${new Date().toLocaleString('fr-FR')} via le formulaire de contact JIGISO</p>
  `, `Contact: ${subject}`);

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `[JIGISO Contact] ${typeLabels[type] || ''} — ${subject}`,
    html,
  });
};

// ─── 8. Notification admin — nouveau signalement ──────────
exports.sendReportToAdmin = async ({ reporterName, propertyTitle, reason, description }) => {
  const reasonLabels = {
    fausse_annonce: 'Fausse annonce',
    fraude: 'Fraude',
    mauvaise_information: 'Mauvaise information',
    deja_loue: 'Déjà loué',
    comportement_suspect: 'Comportement suspect',
    autre: 'Autre',
  };

  const html = baseTemplate(`
    <h1>🚩 Nouveau signalement</h1>
    <p>Un utilisateur a signalé une annonce sur JIGISO.</p>
    <table>
      <tr><td>👤 Signalé par</td><td>${reporterName}</td></tr>
      <tr><td>🏠 Logement</td><td>${propertyTitle}</td></tr>
      <tr><td>⚠️ Raison</td><td><span class="badge-warn">${reasonLabels[reason] || reason}</span></td></tr>
    </table>
    ${description ? `<div class="message-bubble"><p>"${description}"</p></div>` : ''}
    <a href="${SITE}/admin/signalements" class="btn btn-red">Traiter ce signalement</a>
  `, 'Nouveau signalement');

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `🚩 [JIGISO] Nouveau signalement — ${propertyTitle}`,
    html,
  });
};

// ─── 9. Notification admin — nouvel utilisateur ───────────
exports.sendNewUserToAdmin = async ({ userName, userEmail, userRole }) => {
  const html = baseTemplate(`
    <h1>👤 Nouvel utilisateur inscrit</h1>
    <table>
      <tr><td>Nom</td><td>${userName}</td></tr>
      <tr><td>Email</td><td>${userEmail}</td></tr>
      <tr><td>Rôle</td><td><span class="${userRole === 'owner' ? 'badge' : 'badge-warn'}">${userRole === 'owner' ? '🏠 Propriétaire' : '🔍 Locataire'}</span></td></tr>
      <tr><td>Date</td><td>${new Date().toLocaleString('fr-FR')}</td></tr>
    </table>
    <a href="${SITE}/admin/utilisateurs" class="btn">Voir dans l'admin</a>
  `, 'Nouvel utilisateur');

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `👤 [JIGISO] Nouvel inscrit : ${userName} (${userRole})`,
    html,
  });
};

// ─── 10. Notification admin — nouvelle annonce à valider ──
exports.sendNewPropertyToAdmin = async ({ ownerName, propertyTitle, city, type }) => {
  const html = baseTemplate(`
    <h1>🏠 Nouvelle annonce à valider</h1>
    <p>Un propriétaire vient de soumettre une annonce en attente de validation.</p>
    <table>
      <tr><td>👤 Propriétaire</td><td>${ownerName}</td></tr>
      <tr><td>🏠 Annonce</td><td>${propertyTitle}</td></tr>
      <tr><td>📍 Ville</td><td>${city}</td></tr>
      <tr><td>🏷️ Type</td><td>${type}</td></tr>
    </table>
    <a href="${SITE}/admin/logements" class="btn">Valider l'annonce</a>
  `, 'Nouvelle annonce');

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `🏠 [JIGISO] Nouvelle annonce à valider — ${propertyTitle}`,
    html,
  });
};

// ─── 11. Contact direct locataire → Propriétaire ─────────
exports.sendDirectContactToOwner = async ({
  ownerEmail, ownerName, tenantName, tenantEmail, tenantPhone,
  subject, messageContent, propertyTitle, propertyId
}) => {
  const html = baseTemplate(`
    <h1>📩 Message d'un locataire</h1>
    <p>Bonjour <strong>${ownerName}</strong>,</p>
    <p>Un locataire vous a envoyé un message concernant votre annonce <strong>"${propertyTitle}"</strong>.</p>
    <div class="info-box">
      <p><strong>Sujet :</strong> ${subject}</p>
    </div>
    <table>
      <tr><td>👤 Nom</td><td>${tenantName}</td></tr>
      <tr><td>📧 Email</td><td><a href="mailto:${tenantEmail}" style="color:#C8941A;">${tenantEmail}</a></td></tr>
      ${tenantPhone ? `<tr><td>📞 Téléphone</td><td>${tenantPhone}</td></tr>` : ''}
    </table>
    <p><strong>Message :</strong></p>
    <div class="message-bubble">
      <p>${messageContent.replace(/\n/g, '<br>')}</p>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin:20px 0;">
      <a href="mailto:${tenantEmail}?subject=Re: ${subject}" class="btn btn-green">Répondre par email</a>
      <a href="${SITE}/messages" class="btn">Répondre sur JIGISO</a>
    </div>
    ${propertyId ? `<a href="${SITE}/logements/${propertyId}" style="color:#C8941A;font-size:13px;">Voir l'annonce concernée →</a>` : ''}
    <hr class="divider">
    <p style="font-size:12px;color:#aaa;">Message reçu via JIGISO le ${new Date().toLocaleString('fr-FR')}</p>
  `, `Message de ${tenantName}`);

  return sendEmail({
    to: ownerEmail,
    subject: `📩 [JIGISO] Message de ${tenantName} — "${subject}"`,
    html,
  });
};

// ─── 12. Copie de confirmation au locataire ──────────────
exports.sendContactConfirmationToTenant = async ({
  tenantEmail, tenantName, ownerName, propertyTitle, subject
}) => {
  const html = baseTemplate(`
    <h1>✅ Message envoyé au propriétaire</h1>
    <p>Bonjour <strong>${tenantName}</strong>,</p>
    <p>Votre message a bien été transmis à <strong>${ownerName}</strong> concernant le logement <strong>"${propertyTitle}"</strong>.</p>
    <div class="info-box">
      <p><strong>Sujet :</strong> ${subject}<br>
      Le propriétaire sera notifié par email et vous répondra directement.</p>
    </div>
    <p>Vous pouvez également échanger des messages directement sur JIGISO :</p>
    <a href="${SITE}/messages" class="btn">Voir mes messages</a>
    <p style="font-size:13px;color:#888;margin-top:16px;">Continuez à explorer d'autres logements pendant que vous attendez une réponse.</p>
    <a href="${SITE}/rechercher" style="color:#C8941A;font-size:13px;">Voir d'autres logements →</a>
  `, 'Message envoyé');

  return sendEmail({
    to: tenantEmail,
    subject: `✅ Votre message a été envoyé à ${ownerName}`,
    html,
  });
};


/* ── Confirmation d'adresse e-mail ────────────────────────── */
exports.sendEmailVerification = async ({ userEmail, userName, link }) => {
  return sendEmail({
    critical: true,     // la personne attend ce lien : un échec doit remonter
    to: userEmail,
    subject: 'JIGISO — confirmez votre adresse e-mail',
    text: `Bonjour ${userName},\n\nConfirmez votre adresse en ouvrant ce lien (valable 24 h) :\n${link}\n\nSi vous n'avez pas créé de compte JIGISO, ignorez ce message.`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#17150F">
        <h2 style="color:#C98A1E;margin:0 0 16px">Confirmez votre adresse</h2>
        <p>Bonjour ${userName},</p>
        <p>Pour activer votre compte JIGISO, confirmez votre adresse e-mail :</p>
        <p style="margin:28px 0">
          <a href="${link}"
             style="background:#17150F;color:#F7F2E8;padding:13px 26px;border-radius:999px;
                    text-decoration:none;font-weight:600;display:inline-block">
            Confirmer mon adresse
          </a>
        </p>
        <p style="color:#7A7462;font-size:13px">Ce lien est valable 24 heures.</p>
        <p style="color:#7A7462;font-size:13px">
          Si vous n'avez pas créé de compte JIGISO, ignorez simplement ce message.
        </p>
      </div>`,
  });
};

/* ── Résultat de la vérification d'identité ───────────────── */
exports.sendKycDecision = async ({ userEmail, userName, approved, reason }) => {
  return sendEmail({
    to: userEmail,
    subject: approved
      ? 'JIGISO — votre compte propriétaire est vérifié'
      : 'JIGISO — vérification d\'identité refusée',
    text: approved
      ? `Bonjour ${userName},\n\nVotre identité a été validée. Vous pouvez désormais publier vos annonces.`
      : `Bonjour ${userName},\n\nVotre dossier n'a pas pu être validé.\nMotif : ${reason}\n\nVous pouvez déposer un nouveau dossier.`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#17150F">
        <h2 style="color:${approved ? '#1E6B3C' : '#B4532A'};margin:0 0 16px">
          ${approved ? 'Compte propriétaire vérifié' : 'Vérification refusée'}
        </h2>
        <p>Bonjour ${userName},</p>
        ${approved
          ? '<p>Votre identité a été validée. Le badge <strong>Propriétaire vérifié</strong> apparaît désormais sur vos annonces, et vous pouvez publier.</p>'
          : `<p>Votre dossier n'a pas pu être validé.</p>
             <p style="background:#F7F2E8;padding:14px;border-radius:10px"><strong>Motif :</strong> ${reason || 'non précisé'}</p>
             <p>Vous pouvez déposer un nouveau dossier depuis votre espace.</p>`}
      </div>`,
  });
};

// ─── Alerte : un logement correspond aux critères ────────
exports.sendAlertMatch = async ({ to, name, alertName, property }) => {
  const prix = Number(property.price || 0).toLocaleString('fr-FR');
  const html = baseTemplate(`
    <h1>🔔 Un logement correspond à votre alerte</h1>
    <p>Bonjour <strong>${name}</strong>,</p>
    <p>Une nouvelle annonce correspond à votre alerte <strong>« ${alertName} »</strong> :</p>
    <div class="info-box">
      <p><strong>${property.title}</strong><br>
      ${[property.neighborhood, property.city].filter(Boolean).join(', ')}<br>
      ${prix} FCFA / ${property.pricePeriod || 'mois'}${property.bedrooms ? ` · ${property.bedrooms} chambre${property.bedrooms > 1 ? 's' : ''}` : ''}</p>
    </div>
    <a href="${SITE}/logements/${property._id}" class="btn btn-green">Voir l'annonce</a>
    <p style="font-size:13px;color:#888;margin-top:16px;">Vous recevez cet e-mail parce que vous avez créé cette alerte. Vous pouvez la mettre en pause ou la supprimer depuis votre espace, rubrique Alertes.</p>
  `, 'Nouvelle annonce pour vous');
  return sendEmail({ to, subject: `🔔 ${property.title} — correspond à votre alerte`, html });
};

// ─── Visites ─────────────────────────────────────────────
/** Texte saisi par un utilisateur, rendu inoffensif dans le HTML de l'e-mail */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

exports.sendVisitProposed = async ({ to, ownerName, tenantName, propertyTitle, quand, note }) => {
  const html = baseTemplate(`
    <h1>📅 Demande de visite</h1>
    <p>Bonjour <strong>${esc(ownerName)}</strong>,</p>
    <p><strong>${esc(tenantName)}</strong> souhaite visiter <strong>« ${esc(propertyTitle)} »</strong> :</p>
    <div class="info-box"><p><strong>${quand}</strong>${note ? `<br>« ${esc(note)} »` : ''}</p></div>
    <p>Confirmez ou refusez ce créneau depuis l'application JIGISO (Demandes → Visites).</p>
    <a href="${SITE}/mes-demandes" class="btn">Répondre</a>
  `, 'Demande de visite');
  return sendEmail({ to, subject: `📅 Visite proposée — ${propertyTitle}`, html });
};

exports.sendVisitUpdate = async ({ to, name, propertyTitle, quand, evenement, parQui, reponse }) => {
  const titres = {
    confirmer: '✅ Visite confirmée', refuser: '❌ Visite refusée', annuler: '🚫 Visite annulée',
    proposer: '🔁 Autre horaire proposé', accepter: '✅ Nouvel horaire accepté', deplacer: '🔁 Visite déplacée',
  };
  const phrases = {
    confirmer: `${esc(parQui)} a confirmé la visite de « ${esc(propertyTitle)} ».`,
    refuser: `${esc(parQui)} ne peut pas vous recevoir pour « ${esc(propertyTitle)} » à ce moment-là. Choisissez un autre créneau.`,
    annuler: `${esc(parQui)} a annulé la visite de « ${esc(propertyTitle)} ».`,
    proposer: `${esc(parQui)} ne peut pas à l'horaire demandé pour « ${esc(propertyTitle)} » et propose plutôt ce moment. Acceptez-le ou choisissez un autre créneau dans l'application.`,
    accepter: `${esc(parQui)} a accepté le nouvel horaire pour « ${esc(propertyTitle)} ». La visite est confirmée.`,
    deplacer: `${esc(parQui)} a déplacé la visite de « ${esc(propertyTitle)} ». Confirmez le nouvel horaire ou proposez-en un autre.`,
  };
  const html = baseTemplate(`
    <h1>${titres[evenement] || 'Visite mise à jour'}</h1>
    <p>Bonjour <strong>${esc(name)}</strong>,</p>
    <p>${phrases[evenement] || ''}</p>
    <div class="info-box"><p><strong>${quand}</strong>${reponse ? `<br>« ${esc(reponse)} »` : ''}</p></div>
    <a href="${SITE}/mes-demandes" class="btn">Voir mes visites</a>
  `, 'Visite');
  return sendEmail({ to, subject: `${titres[evenement] || 'Visite'} — ${propertyTitle}`, html });
};

/** Rappel avant une visite confirmée (la veille, puis deux heures avant) */
exports.sendVisitReminder = async ({ to, name, propertyTitle, quand, ou, avec, tel, proche }) => {
  const html = baseTemplate(`
    <h1>⏰ ${proche ? 'Visite dans deux heures' : 'Visite demain'}</h1>
    <p>Bonjour <strong>${esc(name)}</strong>,</p>
    <p>Rappel : visite de <strong>« ${esc(propertyTitle)} »</strong>${ou ? ` (${esc(ou)})` : ''} avec <strong>${esc(avec)}</strong>.</p>
    <div class="info-box"><p><strong>${quand}</strong>${tel ? `<br>Téléphone : ${esc(tel)}` : ''}</p></div>
    <p>Un empêchement ? Déplacez ou annulez la visite dans l'application pour prévenir l'autre personne.</p>
    <a href="${SITE}/mes-demandes" class="btn">Voir la visite</a>
  `, 'Rappel de visite');
  return sendEmail({ to, subject: `⏰ Rappel de visite — ${propertyTitle}`, html });
};
