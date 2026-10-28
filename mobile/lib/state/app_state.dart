import 'dart:async';
import 'package:flutter/material.dart';
import '../data/api.dart';
import '../data/geo.dart';
import '../data/mali_locations.dart';
import '../data/models.dart';
import 'prefs.dart';
import 'rappels.dart';
import 'strings.dart';

class AppState extends ChangeNotifier {
  String lang = 'fr';
  int tab = 0;
  static const appVersion = '1.0.0'; // à aligner avec pubspec.yaml
  AppConfig config = const AppConfig();
  bool get mustUpdate => compareVersions(appVersion, config.minVersion) < 0;
  AppUser? user;
  /// Après connexion, on recharge les annonces : la liste chargée au
  /// lancement peut dater d'avant une validation par l'admin.
  void signIn(AppUser u) {
    user = u; tab = 0; notifyListeners(); load();
    _apresConnexion();
  }

  /// Remplace l'utilisateur courant sans toucher à la navigation.
  /// `signIn` ramène à l'onglet 0, ce qui est juste après une connexion mais
  /// éjecterait quelqu'un qui vient simplement de changer sa photo.
  void updateUser(AppUser u) { user = u; notifyListeners(); }
  void signOut() {
    user = null; Api.oublierSession(); requests.clear(); nouveautes = [];
    visites = []; Rappels.toutAnnuler();
    _chargerFavorisLocaux();   // l'invité retrouve les favoris gardés sur le téléphone
    notifyListeners();
  }

  /* Une session ouverte doit survivre à la fermeture de l'app : on relit le
     jeton du trousseau une seule fois au lancement, pas à chaque changement
     de lieu. */
  bool _sessionReprise = false;

  /* Se complète dès que la question « y a-t-il une session ? » est tranchée.
     Le splash l'attend : sans cela il décide après son animation, alors que
     la reprise peut encore être en vol sur une connexion lente, et renvoie
     vers l'écran d'accueil quelqu'un qui est en réalité connecté. */
  final _sessionDecidee = Completer<void>();
  Future<void> get sessionDecidee => _sessionDecidee.future;
  void _trancher() { if (!_sessionDecidee.isCompleted) _sessionDecidee.complete(); }
  void goTab(int i) { tab = i; notifyListeners(); }
  List<Property> properties = [];
  bool loading = true;
  bool offline = false; // vrai si le serveur ne répond pas — aucune donnée de remplacement
  Place place = const Place.bamako();
  void setPlace(Place p) {
    place = p;
    // Position GPS demandée : l'accueil bascule sur la carte, centrée sur la personne
    if (p.kind == 'gps') demandeCarte++;
    _majPointRef();
    load();
  }

  /// Incrémenté quand l'accueil doit afficher la carte (voir HomeScreen).
  int demandeCarte = 0;

  /* ── Distance : depuis la position GPS ou le lieu choisi ──────────── */
  /// Point de référence des distances affichées. Null pour « tout Bamako » :
  /// une distance au centre d'une ville entière ne voudrait rien dire.
  ({double lat, double lng, String label})? pointRef;

  Future<void> _majPointRef() async {
    final p = place;
    if (p.kind == 'gps' && p.lat != null) {
      pointRef = (lat: p.lat!, lng: p.lng!, label: t('dist.you'));
    } else if (p.kind == 'bamako') {
      pointRef = null;
    } else {
      final q = switch (p.kind) {
        'quartier' => '${p.quartier}, Bamako',
        'commune' => 'Commune ${p.commune}, Bamako',
        _ => p.city,
      };
      final nom = p.kind == 'quartier' ? p.quartier! : p.kind == 'commune' ? t('lp.commune').replaceAll('{n}', '${p.commune}') : p.city;
      try {
        final g = await Api.geocode(q);
        pointRef = g == null ? null : (lat: g.lat, lng: g.lng, label: nom);
      } catch (_) {
        pointRef = null;   // lieu introuvable ou hors ligne : pas de distance plutôt qu'une fausse
      }
    }
    notifyListeners();
  }

  /// « Ma position » sur la carte : sert de point de départ des distances
  /// sans changer la recherche en cours.
  void setPositionUtilisateur(double lat, double lng) {
    pointRef = (lat: lat, lng: lng, label: t('dist.you'));
    notifyListeners();
  }

  /// Distance à vol d'oiseau entre le point de référence et l'annonce, en km.
  double? distanceDe(Property p) =>
      pointRef == null || !p.aPosition ? null : distanceKm(pointRef!.lat, pointRef!.lng, p.lat!, p.lng!);
  final Set<String> favorites = {};
  final List<RentalRequest> requests = [];

  /// Français par défaut ; bambara et anglais retombent sur le français pour
  /// toute phrase pas encore traduite.
  String t(String k) => (lang == 'bm' ? bm : lang == 'en' ? en : fr)[k] ?? fr[k] ?? k;
  String typeLabel(String type) => t('type.$type');
  String amenityLabel(String k) => t('am.$k');

  void setLang(String l) { lang = l; Prefs.ecrire('lang', l); notifyListeners(); }

  /* ── Confort d'utilisation (réglages gardés sur le téléphone) ─────── */

  /// Taille du texte : 1.0 normale, 1.15 grande, 1.3 très grande (s'ajoute au réglage du téléphone).
  double textScale = 1.0;
  void setTextScale(double v) { textScale = v; Prefs.ecrire('textScale', v); notifyListeners(); }

  /// Mode économie de données : photos chargées seulement à la demande,
  /// pas de rafraîchissement automatique en arrière-plan.
  bool lowData = false;
  void setLowData(bool v) { lowData = v; Prefs.ecrire('lowData', v); notifyListeners(); }
  /// Thème : auto (suit le téléphone) | clair | sombre
  String theme = 'auto';
  void setTheme(String v) { theme = v; Prefs.ecrire('theme', v); notifyListeners(); }
  final Set<String> photosAffichees = {};
  bool photosVisibles(String id) => !lowData || photosAffichees.contains(id);
  void afficherPhotos(String id) { photosAffichees.add(id); notifyListeners(); }

  /// À appeler une fois au lancement, avant [load].
  Future<void> demarrer() async {
    await Prefs.charger();
    lang = Prefs.lire<String>('lang', 'fr');
    textScale = Prefs.lire<num>('textScale', 1.0).toDouble();
    lowData = Prefs.lire<bool>('lowData', false);
    theme = Prefs.lire<String>('theme', 'auto');
    recents = _relire('recents');
    historique = Prefs.liste('historique');
    filtresEnregistres = Prefs.liste('filtres');
    _chargerFavorisLocaux();
    notifyListeners();
    await load();
    if (user != null) _apresConnexion();
  }

  List<Property> _relire(String cle) => Prefs.liste(cle).map((j) {
        try { return Property.fromJson(j, (u) => u); } catch (_) { return null; }
      }).whereType<Property>().toList();

  /* ── Récemment vus ─────────────────────────────────────────────────── */
  List<Property> recents = [];
  void voir(Property p) {
    recents = [p, ...recents.where((r) => r.id != p.id)].take(20).toList();
    Prefs.ecrire('recents', recents.map((r) => r.toJson()).toList());
    notifyListeners();
  }
  /// Annonce supprimée ou retirée : on ne la propose plus.
  void oublierAnnonce(String id) {
    recents = recents.where((r) => r.id != id).toList();
    Prefs.ecrire('recents', recents.map((r) => r.toJson()).toList());
    notifyListeners();
  }

  /* ── Historique des recherches et filtres enregistrés ──────────────── */
  /// Chaque entrée : { type?, city?, budget? } — budget = index dans budgetSteps.
  List<Map<String, dynamic>> historique = [];
  List<Map<String, dynamic>> filtresEnregistres = [];
  static String _cleFiltre(Map<String, dynamic> f) =>
      '${f['type']}|${f['city']}|${f['budget']}|${f['meuble']}|${f['chambres']}|${(f['place'] as Map?)?['quartier'] ?? (f['place'] as Map?)?['commune'] ?? (f['place'] as Map?)?['region']}';

  void noterRecherche(Map<String, dynamic> f) {
    if (f['type'] == null && f['city'] == null && f['budget'] == null && f['place'] == null) return;
    historique = [f, ...historique.where((h) => _cleFiltre(h) != _cleFiltre(f))].take(8).toList();
    Prefs.ecrire('historique', historique);
    notifyListeners();
  }
  void effacerHistorique() { historique = []; Prefs.ecrire('historique', historique); notifyListeners(); }

  void enregistrerFiltre(Map<String, dynamic> f) {
    filtresEnregistres = [f, ...filtresEnregistres.where((h) => _cleFiltre(h) != _cleFiltre(f))].take(10).toList();
    Prefs.ecrire('filtres', filtresEnregistres);
    notifyListeners();
  }
  void supprimerFiltre(Map<String, dynamic> f) {
    filtresEnregistres = filtresEnregistres.where((h) => _cleFiltre(h) != _cleFiltre(f)).toList();
    Prefs.ecrire('filtres', filtresEnregistres);
    notifyListeners();
  }

  /* ── Alertes : nouveaux logements correspondant au budget ──────────── */
  List<Property> nouveautes = [];
  Future<void> chargerNouveautes() async {
    if (user == null) return;
    try { nouveautes = await Api.nouveautesAlertes(); notifyListeners(); } catch (_) {}
  }
  Future<void> nouveautesVues() async {
    nouveautes = [];
    notifyListeners();
    try { await Api.alertesVues(); } catch (_) {}
  }

  /* ── Favoris : sur le compte une fois connecté, sur le téléphone sinon ─ */
  final Map<String, Property> _favorisConnus = {};
  List<Property> get listeFavoris => favorites.map((id) => _favorisConnus[id] ?? byId(id)).whereType<Property>().toList();

  void _chargerFavorisLocaux() {
    favorites.clear(); _favorisConnus.clear();
    for (final p in _relire('favorisInvite')) { favorites.add(p.id); _favorisConnus[p.id] = p; }
  }

  /* ── Visites : liste partagée par l'agenda, la bannière de l'accueil
     et les rappels programmés sur le téléphone ─────────────────────── */
  List<Visite> visites = [];
  bool visitesChargees = false;
  String? erreurVisites;
  /// Demande d'ouvrir l'onglet « Visites » de l'écran des demandes
  bool ouvrirVisites = false;

  Future<void> chargerVisites() async {
    if (user == null) return;
    try {
      visites = await Api.visites();
      erreurVisites = null;
      Rappels.synchroniser(visites);
    } catch (e) {
      erreurVisites = '$e';
    }
    visitesChargees = true;
    notifyListeners();
  }

  /// Prochaine visite confirmée dans les 7 jours (bannière de l'accueil)
  Visite? get prochaineVisite {
    final maintenant = DateTime.now();
    final l = visites.where((v) => v.statut == 'confirmee' && v.date.isAfter(maintenant)
        && v.date.difference(maintenant).inDays < 7).toList()..sort((a, b) => a.date.compareTo(b.date));
    return l.isEmpty ? null : l.first;
  }

  /// Visites qui attendent une réponse de ma part
  int get visitesEnAttente => visites.where((v) => v.aVenir &&
      ((v.role == 'proprietaire' && v.statut == 'proposee') || (v.role == 'locataire' && v.statut == 'contreproposee'))).length;

  Future<void> _apresConnexion() async {
    // Favoris ajoutés en invité : rattachés au compte à la connexion
    final locaux = _relire('favorisInvite');
    for (final p in locaux) { await Api.setFavorite(p.id, true).catchError((_) {}); }
    if (locaux.isNotEmpty) Prefs.ecrire('favorisInvite', []);
    try {
      final liste = await Api.favoris();
      favorites..clear()..addAll(liste.map((p) => p.id));
      _favorisConnus..clear()..addEntries(liste.map((p) => MapEntry(p.id, p)));
      notifyListeners();
    } catch (_) {}
    chargerNouveautes();
    chargerVisites();
    // Demandes de location envoyées : chargées depuis le serveur (avant, seules
    // celles de la session en cours s'affichaient, et disparaissaient ensuite)
    if (user?.role != 'owner') {
      try { final d = await Api.mesDemandes(); requests..clear()..addAll(d); notifyListeners(); } catch (_) {}
    }
  }

  Future<void> load() async {
    loading = true;
    notifyListeners();
    await Api.preparerVisiteur();
    // Réglages de l'admin chargés en parallèle de la reprise de session
    final configEnCours = Api.appConfig().then((c) => config = c).catchError((_) => config);

    if (!_sessionReprise) {
      try {
        final repris = await Api.reprendreSession();
        if (repris != null) user = repris;
        // Le serveur a répondu : la question est tranchée, on ne redemande plus.
        _sessionReprise = true;
        _trancher();
      } catch (_) {
        /* Serveur injoignable — le jeton n'est pas en cause. On laisse le
           drapeau à false pour retenter au prochain chargement. Le marquer
           ici condamnait l'utilisateur à ressaisir son mot de passe parce
           que le réseau avait toussé pendant les secondes du lancement. */
        _trancher();   // sans réponse, mieux vaut montrer l'app que figer le splash
      }
    } else {
      _trancher();
    }

    await configEnCours;
    try {
      // La ville par défaut n'est pas un choix de la personne : pas une recherche
      properties = await Api.properties(place: place.query, auto: place.kind == 'bamako');
      offline = false;
    } catch (_) {
      properties = [];
      offline = true;
    }
    loading = false;
    notifyListeners();
  }

  /// Recharge la liste sans indicateur de chargement : une annonce supprimée
  /// ou validée depuis l'admin apparaît / disparaît sans geste de l'utilisateur.
  /// Garde la liste en place si le serveur ne répond pas.
  Future<void> refreshProperties() async {
    if (loading || lowData) return;   // économie de données : pas de rechargement en arrière-plan
    try {
      final nouvelles = await Api.properties(place: place.query, auto: true);
      final avant = offline;
      offline = false;
      /* Toute l'interface se redessine à chaque notification : on ne le fait
         que si la liste a réellement changé (sinon, une saccade toutes les
         30 secondes pour rien). */
      if (_empreinte(nouvelles) != _empreinte(properties) || avant) {
        properties = nouvelles;
        notifyListeners();
      }
    } catch (_) {/* réseau absent : on garde ce qui est affiché */}
  }

  /// Résumé d'une liste : identité, prix, disponibilité, vues de chaque annonce.
  static String _empreinte(List<Property> l) =>
      l.map((p) => '${p.id}:${p.price}:${p.availability}:${p.reserved}:${p.views}:${p.images.length}').join('|');

  bool isFav(String id) => favorites.contains(id);

  void toggleFav(String id) {
    final add = !favorites.contains(id);
    add ? favorites.add(id) : favorites.remove(id);
    final p = byId(id);
    if (add && p != null) _favorisConnus[id] = p;
    notifyListeners();
    if (user != null) {
      Api.setFavorite(id, add).catchError((_) {});
    } else {
      // Invité : gardés sur le téléphone, rattachés au compte à la connexion
      Prefs.ecrire('favorisInvite', favorites.map((f) => _favorisConnus[f]).whereType<Property>().map((p) => p.toJson()).toList());
    }
  }

  Future<void> sendRequest(RentalRequest r) async {
    await Api.createRentalRequest(r); // l'erreur remonte à l'écran
    requests.insert(0, r);
    notifyListeners();
  }

  Property? byId(String id) {
    for (final p in properties) { if (p.id == id) return p; }
    for (final p in recents) { if (p.id == id) return p; }
    return _favorisConnus[id];
  }
}

class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child}) : super(notifier: state);
  static AppState of(BuildContext c) => c.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;
}

String initials(String name) => name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).take(2).map((w) => w[0].toUpperCase()).join();

/// Raccourci de traduction là où seul le BuildContext est sous la main
String tr(BuildContext context, String cle) => AppScope.of(context).t(cle);

String fcfa(int n) {
  final s = n.toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(' ');
    b.write(s[i]);
  }
  return b.toString();
}
