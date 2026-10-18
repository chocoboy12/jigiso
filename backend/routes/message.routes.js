const express = require('express');
const router = express.Router();
const { sendMessage, getConversation, getConversations, getUnreadCount } = require('../controllers/message.controller');
const { protect } = require('../middleware/auth');
const emailService = require('../services/email.service');

router.post('/', protect, sendMessage);
router.get('/conversations', protect, getConversations);
router.get('/unread-count', protect, getUnreadCount);
router.get('/:userId', protect, getConversation);

// Route contact → Admin (public)
router.post('/contact-admin', async (req, res) => {
  try {
    const { senderName, senderEmail, senderPhone, subject, messageContent, type } = req.body;
    if (!senderName || !senderEmail || !subject || !messageContent) {
      return res.status(400).json({ success: false, message: 'Tous les champs obligatoires doivent être remplis.' });
    }
    const result = await emailService.sendContactToAdmin({
      senderName, senderEmail, senderPhone, subject, messageContent, type: type || 'other',
    });

    // `sendEmail` renvoie { simulated: true } quand aucun SMTP n'est configuré,
    // et null quand l'envoi a échoué. On ne doit pas annoncer un message
    // « envoyé » dans ces cas : l'utilisateur attendrait une réponse en vain.
    if (result?.simulated) {
      console.warn('[contact] message reçu mais NON acheminé : SMTP non configuré.');
      return res.status(503).json({
        success: false,
        code: 'EMAIL_NOT_CONFIGURED',
        message: "L'envoi d'e-mails n'est pas encore configuré. Écrivez directement à goitaaboubacar6@gmail.com.",
      });
    }
    if (!result) {
      return res.status(502).json({
        success: false,
        message: "L'e-mail n'a pas pu être remis. Réessayez ou écrivez à goitaaboubacar6@gmail.com.",
      });
    }

    res.json({ success: true, message: 'Message envoyé. Nous répondons sous 24 h.' });
  } catch (error) {
    console.error('[contact-admin]', error.message);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi.' });
  }
});

// Contact direct locataire → Propriétaire (message interne + email)
router.post('/contact-owner', protect, async (req, res) => {
  try {
    const { ownerId, propertyId, subject, messageContent, tenantPhone } = req.body;

    if (!ownerId || !subject?.trim() || !messageContent?.trim()) {
      return res.status(400).json({ success: false, message: 'Propriétaire, sujet et message requis.' });
    }

    const User = require('../models/User');
    const Property = require('../models/Property');
    const Message = require('../models/Message');

    const owner = await User.findById(ownerId);
    const property = propertyId ? await Property.findById(propertyId).select('title _id') : null;

    if (!owner) return res.status(404).json({ success: false, message: 'Propriétaire introuvable.' });

    // 1. Sauvegarder le message interne sur MaliRent
    const fullContent = subject ? `[${subject}]\n\n${messageContent}` : messageContent;
    await Message.create({
      sender: req.user._id,
      receiver: ownerId,
      property: propertyId || null,
      content: fullContent.trim(),
    });

    // 2. Email au propriétaire
    emailService.sendDirectContactToOwner({
      ownerEmail: owner.email,
      ownerName: owner.name,
      tenantName: req.user.name,
      tenantEmail: req.user.email,
      tenantPhone: tenantPhone || req.user.phone,
      subject,
      messageContent,
      propertyTitle: property?.title || 'Votre logement',
      propertyId,
    }).catch(err => console.error('Email contact owner:', err.message));

    // 3. Confirmation au locataire
    emailService.sendContactConfirmationToTenant({
      tenantEmail: req.user.email,
      tenantName: req.user.name,
      ownerName: owner.name,
      propertyTitle: property?.title || 'le logement',
      subject,
    }).catch(err => console.error('Email confirmation tenant:', err.message));

    res.json({
      success: true,
      message: `Message envoyé à ${owner.name}! Vous recevrez une confirmation par email.`,
      ownerId,
    });
  } catch (error) {
    console.error('Erreur contact owner:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi.' });
  }
});

module.exports = router;
