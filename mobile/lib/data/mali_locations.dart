/// Découpage administratif du Mali (loi de 2023 : 19 régions + District de Bamako)
/// et communes / quartiers de Bamako.
const bamakoCommunes = <String, List<String>>{
  'I': ['Banconi', 'Boulkassoumbougou', 'Djélibougou', 'Doumanzana', 'Fadjiguila', 'Korofina', 'Sotuba'],
  'II': ['Bagadadji', 'Bozola', 'Hippodrome', 'Médina Coura', 'Missira', 'Niarela', 'Quinzambougou'],
  'III': ['Badialan', 'Bamako-Coura', 'Darsalam', 'Dravéla', 'Koulouba', "N'Tomikorobougou", 'Point G'],
  'IV': ['ACI 2000', 'Djicoroni Para', 'Hamdallaye', 'Lafiabougou', 'Sébénikoro', 'Taliko'],
  'V': ['Badalabougou', 'Baco Djicoroni', 'Daoudabougou', 'Kalaban Coura', 'Quartier Mali', 'Sabalibougou', 'Torokorobougou'],
  'VI': ['Banankabougou', 'Faladié', 'Magnambougou', 'Niamakoro', 'Senou', 'Sogoniko', 'Sokorodji', 'Yirimadio'],
};

/// Région → chef-lieu
const maliRegions = <String, String>{
  'Kayes': 'Kayes', 'Koulikoro': 'Koulikoro', 'Sikasso': 'Sikasso', 'Ségou': 'Ségou', 'Mopti': 'Mopti',
  'Tombouctou': 'Tombouctou', 'Gao': 'Gao', 'Kidal': 'Kidal', 'Taoudénit': 'Taoudénit', 'Ménaka': 'Ménaka',
  'Bougouni': 'Bougouni', 'Dioïla': 'Dioïla', 'Douentza': 'Douentza', 'Kita': 'Kita', 'Nara': 'Nara',
  'Nioro du Sahel': 'Nioro du Sahel', 'San': 'San', 'Koutiala': 'Koutiala', 'Bandiagara': 'Bandiagara',
};

/// Sélection de lieu : tout Bamako, une commune, un quartier, une région, ou la position GPS
class Place {
  final String kind; // bamako | commune | quartier | region | gps
  final String? commune, quartier, region;
  final double? lat, lng;
  const Place.bamako() : kind = 'bamako', commune = null, quartier = null, region = null, lat = null, lng = null;
  const Place.commune(this.commune) : kind = 'commune', quartier = null, region = null, lat = null, lng = null;
  const Place.quartier(this.commune, this.quartier) : kind = 'quartier', region = null, lat = null, lng = null;
  const Place.region(this.region) : kind = 'region', commune = null, quartier = null, lat = null, lng = null;
  const Place.gps(this.lat, this.lng) : kind = 'gps', commune = null, quartier = null, region = null;

  String get label => switch (kind) {
        'commune' => 'Bamako · Commune $commune',
        'quartier' => '$quartier · Commune $commune',
        'region' => 'Région de $region',
        'gps' => 'Ma position actuelle',
        _ => 'Tout Bamako',
      };

  /// Paramètres pour GET /properties
  Map<String, String> get query => switch (kind) {
        'commune' => {'city': 'Bamako', 'commune': 'Commune $commune'},
        'quartier' => {'city': 'Bamako', 'neighborhood': quartier!},
        'region' => {'city': maliRegions[region] ?? region!, 'region': region!},
        'gps' => {'lat': '$lat', 'lng': '$lng', 'radius': '5'},
        _ => {'city': 'Bamako'},
      };

  /// Ville et quartier à enregistrer sur une annonce
  String get city => kind == 'region' ? (maliRegions[region] ?? region!) : 'Bamako';
  String get neighborhood => quartier ?? (commune != null ? 'Commune $commune' : '');
}
