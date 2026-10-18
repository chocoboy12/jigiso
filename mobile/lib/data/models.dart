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

  const Property({
    required this.id, required this.title, required this.type, required this.city, required this.neighborhood,
    required this.price, this.pricePeriod = 'mois', this.description = '', this.ownerId = '', required this.ownerName,
    this.ownerPhone = '', this.ownerWhatsapp = '', this.bedrooms = 0, this.bathrooms = 0, this.area = 0, this.views = 0, this.status = 'approved', this.furnished = false,
    this.availability = true, this.approved = true, this.rating = 0, this.reservedUntil,
    this.amenities = const {}, this.images = const [], this.photoLabels = const [],
  });

  bool get reserved => reservedUntil != null && reservedUntil!.isAfter(DateTime.now());
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
}

const propertyTypes = ['maison', 'appartement', 'studio', 'chambre', 'villa', 'bureau', 'terrain'];
const maliCities = ['Bamako', 'Sikasso', 'Ségou', 'Mopti', 'Kayes', 'Koulikoro', 'Tombouctou', 'Gao', 'Kidal'];
const amenityKeys = ['parking', 'electricity', 'water', 'airConditioning', 'wifi', 'kitchen', 'security', 'generator', 'balcony', 'garden'];
const durations = ['1 mois', '3 mois', '6 mois', '1 an', '2 ans', 'Indéterminée'];
const budgetSteps = [50000, 100000, 200000, 300000, 500000, 800000];
