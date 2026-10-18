const Message = require('../models/Message');
const User = require('../models/User');
const emailService = require('../services/email.service');

// POST /api/messages — Envoyer un message (interne + email)
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, content, propertyId } = req.body;

    if (!receiverId || !content?.trim()) {
      return res.status(400).json({ success: false, message: 'Destinataire et contenu requis.' });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) return res.status(404).json({ success: false, message: 'Destinataire introuvable.' });

    // Sauvegarder en base
    const message = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      property: propertyId || null,
      content: content.trim(),
    });

    await message.populate('sender', 'name profileImage');

    // Envoyer notification email au destinataire (asynchrone, ne bloque pas)
    const Property = require('../models/Property');
    let propertyTitle = null;
    if (propertyId) {
      const prop = await Property.findById(propertyId).select('title');
      propertyTitle = prop?.title;
    }

    emailService.sendMessageNotification({
      senderName: req.user.name,
      receiverEmail: receiver.email,
      receiverName: receiver.name,
      content: content.trim(),
      propertyTitle,
    }).catch(err => console.error('Email notification erreur:', err.message));

    res.status(201).json({ success: true, message, sent: true });
  } catch (error) {
    console.error('Erreur sendMessage:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// GET /api/messages/conversations
exports.getConversations = async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [{ sender: req.user._id }, { receiver: req.user._id }],
    })
      .populate('sender', 'name profileImage')
      .populate('receiver', 'name profileImage')
      .populate('property', 'title')
      .sort({ createdAt: -1 });

    const conversations = {};
    messages.forEach(msg => {
      const isSender = msg.sender._id.toString() === req.user._id.toString();
      const otherId = isSender ? msg.receiver._id.toString() : msg.sender._id.toString();
      const otherUser = isSender ? msg.receiver : msg.sender;

      if (!conversations[otherId]) {
        conversations[otherId] = { user: otherUser, lastMessage: msg, unreadCount: 0 };
      }
      if (!msg.read && msg.receiver._id.toString() === req.user._id.toString()) {
        conversations[otherId].unreadCount++;
      }
    });

    res.json({ success: true, conversations: Object.values(conversations) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// GET /api/messages/:userId — Conversation avec un utilisateur
exports.getConversation = async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user._id },
      ],
    })
      .populate('sender', 'name profileImage')
      .sort({ createdAt: 1 });

    await Message.updateMany(
      { sender: req.params.userId, receiver: req.user._id, read: false },
      { read: true }
    );

    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// GET /api/messages/unread-count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Message.countDocuments({ receiver: req.user._id, read: false });
    res.json({ success: true, count });
  } catch {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};
