/// Même forme que les documents /api/properties du backend
class Property {
  final String id, title, type, city, neighborhood, pricePeriod, description;
  final String ownerId, ownerName, ownerPhone;
  /// Numéro WhatsApp déclaré par le propriétaire, vide s'il n'en a pas mis.
  /// Distinct de [ownerPhone] : beaucoup ont une puce pour les appels et
  /// une autre pour WhatsApp.
  final String ownerWhatsapp;
  final int price, bedrooms, bathrooms, area, views;
  final String status; // pending | approved | rejected | rented
  final bool furnished, availability, approved;
  final double rating;
  final DateTime? reservedUntil;
  final Map<String, bool> amenities;
  final List<String> images;
  final List<String> photoLabels;
  /// Position GPS posée par le propriétaire à la publication ; null si absente.
  final double? lat, lng;
  bool get aPosition => lat != null && lng != null;
  /// Vrai si [lat]/[lng] sont le point approché (décalé de 150 à 400 m) envoyé
  /// par le serveur : le quartier, pas l'adresse. Faux pour le propriétaire,
  /// un locataire dont la visite est confirmée, ou si l'adresse exacte est publique.
  final bool positionApprochee;
  /// Date de publication (première validation), à défaut de création.
  final DateTime? createdAt;
  /// Propriétaire dont l'identité a été vérifiée par l'équipe JIGISO
  /// (calculé par le serveur : e-mail confirmé + pièce d'identité validée).
  final bool ownerVerified;

  const Property({
    required this.id, required this.title, required this.type, required this.city, required this.neighborhood,
    required this.price, this.pricePeriod = 'mois', this.description = '', this.ownerId = '', required this.ownerName,
    this.ownerPhone = '', this.ownerWhatsapp = '', this.bedrooms = 0, this.bathrooms = 0, this.area = 0, this.views = 0, this.status = 'approved', this.furnished = false,
    this.availability = true, this.approved = true, this.rating = 0, this.reservedUntil,
    this.amenities = const {}, this.images = const [], this.photoLabels = const [],
    this.lat, this.lng, this.positionApprochee = false, this.createdAt, this.ownerVerified = false,
  });

  bool get reserved => reservedUntil != null && reservedUntil!.isAfter(DateTime.now());

  /// Copie au format de l'API, pour garder une annonce sur le téléphone
  /// (« récemment vus », favoris hors connexion). Relue par [Property.fromJson]
  /// avec un résolveur identité : les URL d'images sont déjà absolues.
  Map<String, dynamic> toJson() => {
        '_id': id, 'title': title, 'type': type, 'city': city, 'neighborhood': neighborhood,
        'price': price, 'pricePeriod': pricePeriod, 'description': description,
        'owner': {'_id': ownerId, 'name': ownerName, 'isVerified': ownerVerified},
        'bedrooms': bedrooms, 'bathrooms': bathrooms, 'area': area, 'views': views,
        'status': status, 'furnished': furnished, 'availability': availability, 'rating': rating,
        if (reservedUntil != null) 'reservation': {'until': reservedUntil!.toIso8601String()},
        'amenities': amenities,
        'images': [for (var i = 0; i < images.length; i++) {'url': images[i], 'isMain': i == 0}],
        if (aPosition) 'location': {'lat': lat, 'lng': lng},
        'positionApprochee': positionApprochee,
        if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
      };
  int get photoCount => images.isNotEmpty ? images.length : (photoLabels.isEmpty ? 1 : photoLabels.length);

  factory Property.fromJson(Map<String, dynamic> j, String Function(String) resolve) {
    final owner = j['owner'];
    final imgs = ((j['images'] as List?) ?? []).cast<Map<String, dynamic>>().toList()
      ..sort((a, b) => (b['isMain'] == true ? 1 : 0) - (a['isMain'] == true ? 1 : 0));
    final res = j['reservation'] is Map ? j['reservation']['until'] : null;
    int n(v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
    return Property(
      id: '${j['_id']}',
      title: j['title'] ?? '',
      type: j['type'] ?? 'maison',
      city: j['city'] ?? '',
      neighborhood: j['neighborhood'] ?? '',
      price: n(j['price']),
      pricePeriod: j['pricePeriod'] ?? 'mois',
      description: j['description'] ?? '',
      ownerId: owner is Map ? '${owner['_id']}' : '${owner ?? ''}',
      ownerName: owner is Map ? (owner['name'] ?? '') : '',
      ownerPhone: owner is Map ? (owner['phone'] ?? '') : '',
      ownerWhatsapp: owner is Map ? (owner['whatsapp'] ?? '') : '',
      bedrooms: n(j['bedrooms']),
      bathrooms: n(j['bathrooms']),
      area: n(j['area']),
      views: n(j['views']),
      status: j['status'] ?? 'pending',
      furnished: j['furnished'] == true,
      availability: j['availability'] != false,
      approved: j['status'] == 'approved',
      rating: (j['rating'] as num?)?.toDouble() ?? 0,
      reservedUntil: res != null ? DateTime.tryParse('$res') : null,
      amenities: ((j['amenities'] as Map?) ?? {}).map((k, v) => MapEntry('$k', v == true)),
      images: imgs.map((e) => resolve('${e['url'] ?? ''}')).where((u) => u.isNotEmpty).toList(),
      lat: (j['location'] is Map ? (j['location']['lat'] as num?) : null)?.toDouble(),
      lng: (j['location'] is Map ? (j['location']['lng'] as num?) : null)?.toDouble(),
      positionApprochee: j['positionApprochee'] == true,
      createdAt: DateTime.tryParse('${j['publishedAt'] ?? j['createdAt'] ?? ''}'),
      // Liste : `isVerified` déjà calculé ; détail : on applique la même règle
      ownerVerified: owner is Map && (owner['isVerified'] == true
          || (owner['emailVerified'] == true && owner['ownerVerification']?['status'] == 'approved')),
    );
  }
}

/// Réglages pilotés depuis l'admin du site (Administration · Application mobile)
class AppConfig {
  final bool maintenance;
  final String maintenanceMessage, currentVersion, minVersion, playStore, appStore;
  final Map<String, bool> flags;
  final bool bannerOn;
  final String bannerText, bannerColor;
  const AppConfig({this.maintenance = false, this.maintenanceMessage = '', this.currentVersion = '1.0.0', this.minVersion = '1.0.0',
      this.playStore = '', this.appStore = '', this.flags = const {}, this.bannerOn = false, this.bannerText = '', this.bannerColor = '#1E6B3C'});

  bool flag(String k) => flags[k] ?? true;

  factory AppConfig.fromJson(Map<String, dynamic> j) {
    final m = (j['maintenance'] as Map?) ?? {}, v = (j['version'] as Map?) ?? {}, b = (j['banner'] as Map?) ?? {};
    return AppConfig(
      maintenance: m['enabled'] == true, maintenanceMessage: m['message'] ?? '',
      currentVersion: v['current'] ?? '1.0.0', minVersion: v['minimum'] ?? '1.0.0', playStore: v['playStore'] ?? '', appStore: v['appStore'] ?? '',
      flags: ((j['flags'] as Map?) ?? {}).map((k, val) => MapEntry('$k', val == true)),
      bannerOn: b['enabled'] == true, bannerText: b['text'] ?? '', bannerColor: b['color'] ?? '#1E6B3C',
    );
  }
}

/// Compare deux versions « 1.2.0 »
int compareVersions(String a, String b) {
  final x = a.split('.').map((e) => int.tryParse(e) ?? 0).toList(), y = b.split('.').map((e) => int.tryParse(e) ?? 0).toList();
  for (var i = 0; i < 3; i++) {
    final d = (i < x.length ? x[i] : 0) - (i < y.length ? y[i] : 0);
    if (d != 0) return d;
  }
  return 0;
}

class AppUser {
  final String id, name, email, phone, role; // role : tenant | owner | admin
  /// URL absolue de la photo de profil — vide tant que l'utilisateur n'en a pas.
  final String photo;
  /// Numéro WhatsApp déclaré, vide par défaut. C'est lui, et pas [phone],
  /// qui alimente le bouton WhatsApp des annonces.
  final String whatsapp;
  final bool emailVerified, phoneVerified;
  /// Vérification d'identité propriétaire : none | pending | approved | rejected.
  final String ownerStatus;

  const AppUser({this.id = '', required this.name, required this.email, this.phone = '', required this.role,
      this.photo = '', this.whatsapp = '', this.emailVerified = false,
      this.phoneVerified = false, this.ownerStatus = 'none'});

  /// [resolve] transforme un chemin renvoyé par l'API en URL joignable depuis
  /// le téléphone, comme pour les photos d'annonces : sans lui, « /uploads/… »
  /// ou une URL « localhost » ne s'affiche pas sur l'appareil.
  factory AppUser.fromJson(Map<String, dynamic> j, [String Function(String)? resolve]) {
    final img = j['profileImage'];
    final url = img is Map ? '${img['url'] ?? ''}' : '';
    final verif = j['ownerVerification'];
    return AppUser(
      id: '${j['_id'] ?? j['id'] ?? ''}',
      name: j['name'] ?? '',
      email: j['email'] ?? '',
      phone: j['phone'] ?? '',
      role: j['role'] ?? 'tenant',
      photo: url.isEmpty ? '' : (resolve?.call(url) ?? url),
      whatsapp: j['whatsapp'] ?? '',
      emailVerified: j['emailVerified'] == true,
      phoneVerified: j['phoneVerified'] == true,
      ownerStatus: '${(verif is Map ? verif['status'] : null) ?? 'none'}',
    );
  }

  AppUser copyWith({String? name, String? phone, String? photo, String? whatsapp}) => AppUser(
        id: id, name: name ?? this.name, email: email, phone: phone ?? this.phone, role: role,
        photo: photo ?? this.photo, whatsapp: whatsapp ?? this.whatsapp,
        emailVerified: emailVerified, phoneVerified: phoneVerified,
        ownerStatus: ownerStatus,
      );
}

/// Numéro au format international sans « + », tel que l'attend wa.me.
///
/// Un numéro malien saisi sur place tient en 8 chiffres : sans l'indicatif,
/// wa.me ouvre une conversation avec un numéro qui n'existe pas. Renvoie
/// null quand il n'y a rien d'exploitable, pour que l'appelant n'affiche
/// pas un bouton mort.
String? numeroWhatsApp(String? brut) {
  final chiffres = (brut ?? '').replaceAll(RegExp(r'\D'), '');
  if (chiffres.isEmpty) return null;
  if (chiffres.startsWith('223')) return chiffres;
  return chiffres.length == 8 ? '223$chiffres' : chiffres;
}

class RentalRequest {
  final Property property;
  final DateTime moveIn;
  final String duration, message;
  String status; // pending | accepted | rejected | cancelled
  RentalRequest({required this.property, required this.moveIn, required this.duration, this.message = '', this.status = 'pending'});

  /// Depuis GET /rental-requests (côté locataire)
  factory RentalRequest.fromJson(Map<String, dynamic> j, String Function(String) resolve) {
    final prop = Map<String, dynamic>.from((j['property'] as Map?) ?? {'_id': '', 'title': 'Annonce retirée'});
    prop['owner'] ??= j['owner'];   // nom du propriétaire, affiché sur la carte
    return RentalRequest(
      property: Property.fromJson(prop, resolve),
      moveIn: DateTime.tryParse('${j['moveInDate']}') ?? DateTime.now(),
      duration: '${j['duration'] ?? ''}',
      message: '${j['message'] ?? ''}',
      status: '${j['status'] ?? 'pending'}',
    );
  }
}

/// Visite d'un logement (GET /visits)
/// Visite d'un logement. Les heures sont gardées en UTC = heure de Bamako
/// (GMT toute l'année) : un rendez-vous au Mali s'affiche à l'heure malienne,
/// même sur un téléphone réglé sur un autre fuseau.
class Visite {
  final String id, statut, role; // statut : proposee|confirmee|refusee|contreproposee|annulee ; role : locataire|proprietaire
  final DateTime date;
  final DateTime? dateAlternative;   // autre horaire proposé par le propriétaire
  final int duree;                   // minutes
  final String note, reponse, annuleePar, autreNom, autreTel;
  final Property? property;
  const Visite({required this.id, required this.statut, required this.role, required this.date, this.dateAlternative,
      this.duree = 60, this.note = '', this.reponse = '', this.annuleePar = '', this.autreNom = '', this.autreTel = '', this.property});

  /// Horaire en jeu : l'autre horaire tant qu'il attend une réponse
  DateTime get quand => statut == 'contreproposee' && dateAlternative != null ? dateAlternative! : date;
  bool get aVenir => quand.isAfter(DateTime.now());
  bool get active => statut == 'proposee' || statut == 'confirmee' || statut == 'contreproposee';

  factory Visite.fromJson(Map<String, dynamic> j, String Function(String) resolve) {
    final role = '${j['role'] ?? 'locataire'}';
    final autre = (role == 'proprietaire' ? j['tenant'] : j['owner']) as Map?;
    return Visite(
      id: '${j['_id']}', statut: '${j['status']}', role: role,
      date: (DateTime.tryParse('${j['date']}') ?? DateTime.now()).toUtc(),
      dateAlternative: DateTime.tryParse('${j['dateAlternative']}')?.toUtc(),
      duree: (j['duree'] as num?)?.toInt() ?? 60,
      note: '${j['note'] ?? ''}', reponse: '${j['reponse'] ?? ''}', annuleePar: '${j['annuleePar'] ?? ''}',
      autreNom: '${autre?['name'] ?? ''}', autreTel: '${autre?['phone'] ?? ''}',
      property: j['property'] is Map ? Property.fromJson(Map<String, dynamic>.from(j['property']), resolve) : null,
    );
  }
}

/// Disponibilités d'un propriétaire pour les visites (heures de Bamako)
class Disponibilites {
  final bool configure;
  final Set<int> jours;          // 0 = dimanche … 6 = samedi
  final int debut, fin, duree;
  final List<String> joursBloques;   // 'AAAA-MM-JJ'
  const Disponibilites({this.configure = false, this.jours = const {1, 2, 3, 4, 5, 6}, this.debut = 9, this.fin = 18,
      this.duree = 60, this.joursBloques = const []});

  factory Disponibilites.fromJson(Map<String, dynamic> j) => Disponibilites(
        configure: j['configure'] == true,
        jours: ((j['jours'] as List?) ?? const [1, 2, 3, 4, 5, 6]).map((e) => (e as num).toInt()).toSet(),
        debut: (j['debut'] as num?)?.toInt() ?? 9,
        fin: (j['fin'] as num?)?.toInt() ?? 18,
        duree: (j['duree'] as num?)?.toInt() ?? 60,
        joursBloques: ((j['joursBloques'] as List?) ?? const []).map((e) => '$e').toList(),
      );
  Map<String, dynamic> toJson() =>
      {'jours': (jours.toList()..sort()), 'debut': debut, 'fin': fin, 'duree': duree, 'joursBloques': joursBloques};
}

const propertyTypes = ['maison', 'appartement', 'studio', 'chambre', 'villa', 'bureau', 'terrain'];
const maliCities = ['Bamako', 'Sikasso', 'Ségou', 'Mopti', 'Kayes', 'Koulikoro', 'Tombouctou', 'Gao', 'Kidal'];
const amenityKeys = ['parking', 'electricity', 'water', 'airConditioning', 'wifi', 'kitchen', 'security', 'generator', 'balcony', 'garden'];
const durations = ['1 mois', '3 mois', '6 mois', '1 an', '2 ans', 'Indéterminée'];
const budgetSteps = [50000, 100000, 200000, 300000, 500000, 800000];
