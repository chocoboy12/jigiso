const Favorite = require('../models/Favorite');

// GET /api/favorites
exports.getFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user._id })
      .populate({
        path: 'property',
        populate: { path: 'owner', select: 'name phone email' }
      })
      .sort({ createdAt: -1 });
    res.json({ success: true, favorites });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// POST /api/favorites/:propertyId
exports.addFavorite = async (req, res) => {
  try {
    const existing = await Favorite.findOne({ user: req.user._id, property: req.params.propertyId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Déjà dans vos favoris.' });
    }
    const favorite = await Favorite.create({ user: req.user._id, property: req.params.propertyId });
    res.status(201).json({ success: true, message: 'Ajouté aux favoris!', favorite });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// DELETE /api/favorites/:propertyId
exports.removeFavorite = async (req, res) => {
  try {
    await Favorite.findOneAndDelete({ user: req.user._id, property: req.params.propertyId });
    res.json({ success: true, message: 'Retiré des favoris.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};
