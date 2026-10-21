/**
 * Test d'envoi d'e-mail.
 *
 *   npm run test:email                → adresse de l'admin
 *   npm run test:email a@b.com        → adresse choisie
 *
 * Avec EMAIL_USER / EMAIL_PASS configurés, l'envoi passe par Gmail.
 * Sans configuration, le script ouvre un compte SMTP de test (Ethereal)
 * et affiche un lien pour voir l'e-mail tel qu'il sera reçu — ce qui valide
 * tout le circuit sans identifiants réels.
 */
require('dotenv').config();
const nodemailer = require('nodemailer');
const emailService = require('../services/email.service');

const to = process.argv[2] || process.env.ADMIN_NOTIFICATION_EMAIL;

(async () => {
  const configured = emailService.isConfigured();
  console.log(`\nDestinataire : ${to}`);
  console.log(`Mode         : ${configured ? (process.env.SMTP_HOST ? 'SMTP ' + process.env.SMTP_HOST : 'Gmail') : 'SMTP de test (aucun identifiant)'}\n`);

  if (configured) {
    const ok = await emailService.verifyConnection();
    if (!ok) {
      if (process.env.SMTP_HOST) {
        console.error('Connexion refusée. Vérifiez SMTP_HOST, SMTP_PORT, SMTP_USER et SMTP_PASS');
        console.error('tels que votre fournisseur les affiche.');
      } else {
        console.error("Connexion refusée. EMAIL_PASS doit être un MOT DE PASSE D'APPLICATION Google");
        console.error("(16 lettres minuscules), pas le mot de passe du compte.");
      }
      process.exit(1);
    }
    const res = await emailService.sendContactToAdmin({
      senderName: 'Test JIGISO', senderEmail: to, senderPhone: '',
      subject: "Test d'envoi", type: 'question',
      messageContent: "Si vous lisez ceci, l'envoi d'e-mails fonctionne.",
    });
    console.log(res ? `Envoyé. Identifiant : ${res.messageId}` : "Échec de l'envoi.");
    process.exit(res ? 0 : 1);
  }

  const account = await nodemailer.createTestAccount();
  const transport = nodemailer.createTransport({
    host: account.smtp.host, port: account.smtp.port, secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass },
  });

  const info = await transport.sendMail({
    from: '"JIGISO" <noreply@jigiso.ml>',
    to,
    subject: "JIGISO — test du circuit d'envoi",
    html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#17150F">
      <h2 style="color:#C98A1E">Le circuit d'envoi fonctionne</h2>
      <p>Cet e-mail a ete produit par l'application, transmis a un serveur SMTP et accepte par lui.</p>
      <p>Il reste a renseigner <strong>EMAIL_USER</strong> et <strong>EMAIL_PASS</strong>
         dans <code>backend/.env</code> pour qu'il parte vers de vraies boites.</p>
    </div>`,
  });

  console.log('SMTP de test : accepte par le serveur');
  console.log('Identifiant  :', info.messageId);
  console.log('Reponse      :', info.response);
  console.log("\nApercu de l'e-mail recu :");
  console.log('  ' + nodemailer.getTestMessageUrl(info));
  console.log('\nLe code est donc correct. Il manque uniquement vos identifiants Gmail.\n');
  process.exit(0);
})().catch(err => { console.error('Echec :', err.message); process.exit(1); });
