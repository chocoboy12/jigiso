const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
  },
  content: {
    type: String,
    required: [true, 'Le message ne peut pas être vide'],
    maxlength: [2000, 'Le message ne peut pas dépasser 2000 caractères'],
  },
  read: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

messageSchema.index({ sender: 1, receiver: 1 });

module.exports = mongoose.model('Message', messageSchema);
