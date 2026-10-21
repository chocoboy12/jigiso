import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'models.dart';

/// Erreur renvoyée par l'API, avec le message exact du serveur.
///
/// Le backend explique précisément ce qui ne va pas — « 8 caractères minimum,
/// une majuscule », « Cet email est déjà utilisé », « Trop de tentatives ».
/// Remplacer cela par un message générique côté app, c'est demander aux gens
/// de deviner ce qu'ils doivent corriger.
class ApiException implements Exception {
  final String message;
  final int statusCode;
  const ApiException(this.message, this.statusCode);
  @override
  String toString() => message;
}

/// Client de l'API JIGISO (même backend que le site).
/// Lancer avec : flutter run --dart-define=API_URL=http://192.168.x.x:5001/api
/// (10.0.2.2 = la machine hôte depuis l'émulateur Android)
class Api {
  static const base = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:5001/api');
  static String get origin => base.replaceAll(RegExp(r'/api/?$'), '');
  static String? token;

  /// Fichier multipart avec son type MIME réel. Sans lui, `fromPath` envoie
  /// « application/octet-stream » et le serveur (filtre multer) refuse l'image.
  static Future<http.MultipartFile> _image(String field, File f) {
    final ext = f.path.split('.').last.toLowerCase();
    final type = switch (ext) {
      'png' => MediaType('image', 'png'),
      'webp' => MediaType('image', 'webp'),
      'heic' || 'heif' => MediaType('image', 'heic'),
      'pdf' => MediaType('application', 'pdf'),
      _ => MediaType('image', 'jpeg'),
    };
    return http.MultipartFile.fromPath(field, f.path, contentType: type);
  }

  static Map<String, String> get _h => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
        if (visiteur != null) 'X-Visitor-Id': visiteur!,
      };

  /// Identifiant anonyme de cet appareil, tiré au hasard une fois : il permet
  /// aux recommandations de tenir compte des annonces consultées, même sans
  /// compte. Aucun lien avec la personne ni avec le téléphone.
  static String? visiteur;
  static Future<void> preparerVisiteur() async {
    if (visiteur != null) return;
    try {
      var v = await _coffre.read(key: 'jigiso_visiteur');
      if (v == null || v.isEmpty) {
        final r = Random.secure();
        v = List.generate(16, (_) => r.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
        await _coffre.write(key: 'jigiso_visiteur', value: v);
      }
      visiteur = v;
    } catch (_) {/* trousseau indisponible : pas de personnalisation */}
  }

  /// Logements semblables à une annonce, chacun avec la raison de la suggestion.
  static Future<List<({Property property, String raison})>> similaires(String id) async {
    final r = await http.get(Uri.parse('$base/properties/$id/similar?limit=6'), headers: _h)
        .timeout(const Duration(seconds: 8));
    if (r.statusCode != 200) return [];
    final List liste = jsonDecode(r.body)['properties'] ?? [];
    return liste.map((e) {
      final j = e as Map<String, dynamic>;
      return (property: Property.fromJson(j, resolve), raison: '${j['recommandation']?['raison'] ?? ''}');
    }).toList();
  }

  /// Loyer comparé aux annonces semblables ; null si pas assez de comparables.
  static Future<Map<String, dynamic>?> prixDuMarche(String id) async {
    final r = await http.get(Uri.parse('$base/properties/$id/price-insight'), headers: _h)
        .timeout(const Duration(seconds: 8));
    if (r.statusCode != 200) return null;
    final i = jsonDecode(r.body)['insight'] as Map<String, dynamic>?;
    return (i?['available'] == true && i?['verdict'] != null) ? i : null;
  }

  /// Même logique que resolveImageUrl() du site : chemins relatifs et
  /// URLs « localhost » repointés vers l'API réellement configurée.
  static final _hoteLocal = RegExp(r'^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)');

  static String resolve(String url) {
    if (url.isEmpty) return url;
    if (url.startsWith('http')) {
      final u = Uri.tryParse(url);
      // Adresse de l'appareil qui a publié (localhost, 10.0.2.2 de l'émulateur,
      // réseau local) : on repointe vers l'API que cette app connaît.
      if (u != null && u.path.startsWith('/uploads/') && _hoteLocal.hasMatch(u.host)) return '$origin${u.path}';
      return url;
    }
    return '$origin${url.startsWith('/') ? '' : '/'}$url';
  }

  static Future<AppConfig> appConfig() async {
    final r = await http.get(Uri.parse('$base/app/config')).timeout(const Duration(seconds: 6));
    if (r.statusCode != 200) throw Exception('HTTP ${r.statusCode}');
    final j = jsonDecode(r.body);
    return AppConfig.fromJson((j['config'] ?? j) as Map<String, dynamic>);
  }

  /// [auto] : chargement que la personne n'a pas demandé (lancement de l'app,
  /// rafraîchissement périodique). Le serveur ne le compte alors pas comme une
  /// recherche, sinon l'analyse de la demande serait faussée.
  static Future<List<Property>> properties({Map<String, String> place = const {}, String? type, int? maxPrice, bool auto = false}) async {
    final q = {
      'limit': '60',
      if (auto) 'auto': '1',
      ...place,
      if (type != null) 'type': type,
      if (maxPrice != null) 'maxPrice': '$maxPrice',
    };
    final r = await http.get(Uri.parse('$base/properties').replace(queryParameters: q), headers: _h)
        .timeout(const Duration(seconds: 8));
    if (r.statusCode != 200) throw Exception('HTTP ${r.statusCode}');
    final body = jsonDecode(r.body);
    final List list = body is List ? body : (body['properties'] ?? body['data'] ?? []);
    return list.map((e) => Property.fromJson(e as Map<String, dynamic>, resolve)).toList();
  }

  /// Détail complet d'une annonce.
  ///
  /// La liste ne renvoie pas les coordonnées du propriétaire — les exposer
  /// sur un point d'entrée public reviendrait à offrir tous les numéros du
  /// site en une requête. Il faut donc recharger l'annonce pour afficher
  /// « Appeler » et « WhatsApp ».
  static Future<Property> property(String id) async {
    final r = await http.get(Uri.parse('$base/properties/$id'), headers: _h)
        .timeout(const Duration(seconds: 10));
    if (r.statusCode >= 300) throw _erreurServeur(r);
    final b = jsonDecode(r.body);
    return Property.fromJson((b['property'] ?? b) as Map<String, dynamic>, resolve);
  }

  /// Même contrat que authAPI du site : { token, user }
  static Future<AppUser> login(String email, String password) =>
      _auth('login', {'email': email, 'password': password});

  static Future<AppUser> register({required String name, required String phone, required String email, required String password, required String role}) =>
      _auth('register', {'name': name, 'phone': phone, 'email': email, 'password': password, 'role': role});

  static Future<AppUser> _auth(String path, Map<String, String> body) async {
    final r = await http.post(Uri.parse('$base/auth/$path'), headers: _h, body: jsonEncode(body)).timeout(const Duration(seconds: 8));
    if (r.statusCode >= 300) throw _erreurServeur(r);
    final j = jsonDecode(r.body);
    await _memoriserJeton(j['token'] as String?);
    return AppUser.fromJson(j['user'] as Map<String, dynamic>, resolve);
  }

  /// Transforme une réponse d'erreur en exception porteuse du message serveur.
  static ApiException _erreurServeur(http.Response r) {
    try {
      final j = jsonDecode(r.body);
      if (j is Map && j['message'] is String && (j['message'] as String).trim().isNotEmpty) {
        return ApiException(j['message'] as String, r.statusCode);
      }
    } catch (_) {/* corps illisible : on retombe sur le code HTTP */}
    return ApiException('Erreur ${r.statusCode}', r.statusCode);
  }

  /// Coordonnées d'un lieu, via la passerelle OpenStreetMap du backend.
  ///
  /// On passe par le serveur et non par Nominatim en direct : il impose un
  /// User-Agent, limite le débit à une requête par seconde, et le backend gère
  /// déjà file d'attente et cache. Renvoie null si le lieu est introuvable —
  /// cas réel pour certains quartiers absents d'OpenStreetMap.
  /// Lieux déjà résolus pendant cette session. On parcourt la liste des
  /// quartiers en revenant plusieurs fois sur les mêmes : sans ce cache,
  /// chaque regard recoûte un aller-retour réseau et une seconde d'attente.
  /// Les « introuvables » sont mémorisés aussi — c'est une réponse, pas un échec.
  static final Map<String, ({double lat, double lng, String label})?> _lieux = {};

  static Future<({double lat, double lng, String label})?> geocode(String q) async {
    final cle = q.toLowerCase().trim();
    if (_lieux.containsKey(cle)) return _lieux[cle];
    final r = await http
        .get(Uri.parse('$base/geocode?q=${Uri.encodeQueryComponent(q)}'), headers: _h)
        .timeout(const Duration(seconds: 12));
    if (r.statusCode >= 300) throw _erreurServeur(r);
    final res = (jsonDecode(r.body) as Map)['result'];
    final point = res == null
        ? null
        : (
            lat: (res['lat'] as num).toDouble(),
            lng: (res['lng'] as num).toDouble(),
            label: '${res['label'] ?? q}',
          );
    _lieux[cle] = point;
    return point;
  }

  // ── Session ───────────────────────────────────────────────────────────
  // Le jeton va dans le trousseau du téléphone (Keychain / EncryptedShared-
  // Preferences) : il ouvre le compte, il ne doit pas traîner en clair.

  static const _coffre = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  static const _cleJeton = 'jigiso_token';

  static Future<void> _memoriserJeton(String? valeur) async {
    token = valeur;
    if (valeur == null) {
      await _coffre.delete(key: _cleJeton);
    } else {
      await _coffre.write(key: _cleJeton, value: valeur);
    }
  }

  /// Reprend la session d'un lancement précédent.
  ///
  /// Renvoie l'utilisateur si le jeton est encore valable, et `null` si le
  /// serveur le refuse — le jeton est alors effacé, car le garder laisserait
  /// croire à une session ouverte qui échouerait à la première requête.
  ///
  /// Les pannes réseau remontent telles quelles au lieu d'être confondues avec
  /// un refus : une absence de réponse ne dit rien de la validité du jeton.
  /// L'appelant doit pouvoir réessayer plus tard plutôt que de conclure à une
  /// déconnexion — au Mali, un creux de réseau au lancement est ordinaire.
  ///
  /// 15 secondes et non 8 : ce délai ne retarde que l'affichage de l'état
  /// connecté, et une connexion 3G lente dépasse largement 8 secondes.
  static Future<AppUser?> reprendreSession() async {
    final enregistre = await _coffre.read(key: _cleJeton);
    if (enregistre == null || enregistre.isEmpty) return null;
    token = enregistre;

    final r = await http.get(Uri.parse('$base/users/profile'), headers: _h)
        .timeout(const Duration(seconds: 15));

    if (r.statusCode >= 300) {
      // Le serveur a répondu et refuse : le jeton est mort pour de bon.
      await _memoriserJeton(null);
      return null;
    }
    try {
      return AppUser.fromJson(jsonDecode(r.body)['user'] as Map<String, dynamic>, resolve);
    } catch (_) {
      // Réponse inattendue mais serveur joignable : on garde le jeton.
      return null;
    }
  }

  static Future<void> oublierSession() => _memoriserJeton(null);

  /// Connexion Google / Facebook / Apple : le jeton du fournisseur est
  /// échangé contre un jeton Jigiso. Route à ajouter côté backend.
  static Future<AppUser> socialLogin(String provider, String providerToken, {String role = 'tenant'}) =>
      _auth(provider, {'token': providerToken, 'role': role});

  // ── Compte ────────────────────────────────────────────────────────────

  /// Met à jour le profil. Les champs laissés à null ne sont pas touchés :
  /// envoyer un champ vide effacerait la valeur existante côté serveur.
  ///
  /// Changer de numéro annule la vérification du téléphone (le serveur le fait
  /// et le journalise) — l'utilisateur doit la refaire.
  static Future<AppUser> updateProfile({String? name, String? phone, String? whatsapp, File? photo}) async {
    final req = http.MultipartRequest('PUT', Uri.parse('$base/users/profile'))
      ..headers.addAll({if (token != null) 'Authorization': 'Bearer $token'});
    if (name != null) req.fields['name'] = name;
    if (phone != null) req.fields['phone'] = phone;
    // Chaîne vide volontairement transmise : c'est ainsi qu'on retire le numéro.
    if (whatsapp != null) req.fields['whatsapp'] = whatsapp;
    if (photo != null) req.files.add(await _image('profileImage', photo));
    final r = await http.Response.fromStream(await req.send().timeout(const Duration(seconds: 60)));
    if (r.statusCode >= 300) throw _erreurServeur(r);
    return AppUser.fromJson(jsonDecode(r.body)['user'] as Map<String, dynamic>, resolve);
  }

  /// Change le mot de passe.
  ///
  /// Un succès invalide TOUS les jetons du compte, celui de cette session
  /// compris : le serveur incrémente `tokenVersion`, ce qui est exactement le
  /// but (si quelqu'un d'autre était connecté, il saute). On efface donc la
  /// session ici, et l'appelant doit renvoyer vers l'écran de connexion —
  /// sinon la requête suivante échouerait en 401 sans explication.
  static Future<String> changePassword(String actuel, String nouveau) async {
    final r = await http.put(Uri.parse('$base/users/change-password'), headers: _h,
        body: jsonEncode({'currentPassword': actuel, 'newPassword': nouveau}))
        .timeout(const Duration(seconds: 12));
    if (r.statusCode >= 300) throw _erreurServeur(r);
    final message = '${jsonDecode(r.body)['message'] ?? 'Mot de passe modifié.'}';
    await oublierSession();
    return message;
  }

  /// Vérification d'identité — mêmes champs que VerificationPage du site
  static Future<void> submitIdentity({required String docType, required File profilePhoto, required File front, File? back, required File selfie}) async {
    final kyc = http.MultipartRequest('POST', Uri.parse('$base/verification/identity'))
      ..headers.addAll({if (token != null) 'Authorization': 'Bearer $token'})
      ..fields['docType'] = docType
      ..files.add(await _image('id_front', front))
      ..files.add(await _image('selfie', selfie));
    if (back != null) kyc.files.add(await _image('id_back', back));
    final r1 = await http.Response.fromStream(await kyc.send().timeout(const Duration(seconds: 60)));
    if (r1.statusCode >= 300) throw _erreurServeur(r1);

    final photo = http.MultipartRequest('PUT', Uri.parse('$base/users/profile'))
      ..headers.addAll({if (token != null) 'Authorization': 'Bearer $token'})
      ..files.add(await _image('profileImage', profilePhoto));
    await photo.send().timeout(const Duration(seconds: 60));
  }

  // ─── Espace propriétaire ───────────────────────────────
  static Future<List<Property>> myProperties() async {
    final r = await http.get(Uri.parse('$base/properties/my-properties'), headers: _h).timeout(const Duration(seconds: 8));
    if (r.statusCode != 200) throw Exception('HTTP ${r.statusCode}');
    final b = jsonDecode(r.body);
    final List list = b is List ? b : (b['properties'] ?? b['data'] ?? []);
    return list.map((e) => Property.fromJson(e as Map<String, dynamic>, resolve)).toList();
  }

  static Future<Map<String, dynamic>> ownerStats() async {
    final r = await http.get(Uri.parse('$base/properties/stats'), headers: _h).timeout(const Duration(seconds: 8));
    if (r.statusCode != 200) throw Exception('HTTP ${r.statusCode}');
    final b = jsonDecode(r.body);
    return (b['stats'] ?? b) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> verificationStatus() async {
    final r = await http.get(Uri.parse('$base/verification/status'), headers: _h).timeout(const Duration(seconds: 8));
    if (r.statusCode != 200) throw Exception('HTTP ${r.statusCode}');
    return (jsonDecode(r.body)['status'] ?? {}) as Map<String, dynamic>;
  }

  /// Demandes de location (reçues pour un propriétaire, envoyées pour un locataire)
  static Future<List<Map<String, dynamic>>> rentalRequests() async {
    final r = await http.get(Uri.parse('$base/rental-requests'), headers: _h).timeout(const Duration(seconds: 8));
    if (r.statusCode != 200) throw Exception('HTTP ${r.statusCode}');
    final b = jsonDecode(r.body);
    return ((b is List ? b : b['requests'] ?? []) as List).cast<Map<String, dynamic>>();
  }

  static Future<void> updateRequest(String id, String status) async {
    final r = await http.put(Uri.parse('$base/rental-requests/$id'), headers: _h, body: jsonEncode({'status': status}));
    if (r.statusCode >= 300) throw Exception('HTTP ${r.statusCode}');
  }

  /// Publier un logement — mêmes champs que AddPropertyPage (amenities et location en JSON, photos dans « images »)
  static Future<void> createProperty({required Map<String, String> fields, required Map<String, bool> amenities, Map<String, double>? location, required Map<String, dynamic> contract, required List<File> photos}) async {
    final req = http.MultipartRequest('POST', Uri.parse('$base/properties'))
      ..headers.addAll({if (token != null) 'Authorization': 'Bearer $token'})
      ..fields.addAll(fields)
      ..fields['amenities'] = jsonEncode(amenities)
      ..fields['contract'] = jsonEncode(contract);
    if (location != null) req.fields['location'] = jsonEncode(location);
    for (final f in photos) { req.files.add(await _image('images', f)); }
    final r = await http.Response.fromStream(await req.send().timeout(const Duration(seconds: 60)));
    if (r.statusCode >= 300) throw _erreurServeur(r);
  }

  static Future<void> setFavorite(String id, bool add) async {
    final u = Uri.parse('$base/favorites/$id');
    final r = add ? await http.post(u, headers: _h) : await http.delete(u, headers: _h);
    if (r.statusCode >= 300) throw Exception('HTTP ${r.statusCode}');
  }

  static Future<void> createRentalRequest(RentalRequest q) async {
    final r = await http.post(Uri.parse('$base/rental-requests'), headers: _h, body: jsonEncode({
      'ownerId': q.property.ownerId,
      'propertyId': q.property.id,
      'moveInDate': q.moveIn.toIso8601String().substring(0, 10),
      'duration': q.duration,
      'message': q.message,
    })).timeout(const Duration(seconds: 8));
    if (r.statusCode >= 300) throw _erreurServeur(r);
  }
}
