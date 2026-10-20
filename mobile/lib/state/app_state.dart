import 'dart:async';
import 'package:flutter/material.dart';
import '../data/api.dart';
import '../data/mali_locations.dart';
import '../data/models.dart';
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
  void signIn(AppUser u) { user = u; tab = 0; notifyListeners(); load(); }

  /// Remplace l'utilisateur courant sans toucher à la navigation.
  /// `signIn` ramène à l'onglet 0, ce qui est juste après une connexion mais
  /// éjecterait quelqu'un qui vient simplement de changer sa photo.
  void updateUser(AppUser u) { user = u; notifyListeners(); }
  void signOut() { user = null; Api.oublierSession(); favorites.clear(); requests.clear(); notifyListeners(); }

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
  void setPlace(Place p) { place = p; load(); }
  final Set<String> favorites = {};
  final List<RentalRequest> requests = [];

  String t(String k) => (lang == 'fr' ? fr : en)[k] ?? fr[k] ?? k;
  String typeLabel(String type) => t('type.$type');
  String amenityLabel(String k) => t('am.$k');

  void setLang(String l) { lang = l; notifyListeners(); }

  Future<void> load() async {
    loading = true;
    notifyListeners();
    try { config = await Api.appConfig(); } catch (_) {}

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

    try {
      properties = await Api.properties(place: place.query);
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
    if (loading) return;
    try {
      properties = await Api.properties(place: place.query);
      offline = false;
      notifyListeners();
    } catch (_) {/* réseau absent : on garde ce qui est affiché */}
  }

  bool isFav(String id) => favorites.contains(id);

  void toggleFav(String id) {
    final add = !favorites.contains(id);
    add ? favorites.add(id) : favorites.remove(id);
    notifyListeners();
    if (!offline) Api.setFavorite(id, add).catchError((_) {});
  }

  Future<void> sendRequest(RentalRequest r) async {
    await Api.createRentalRequest(r); // l'erreur remonte à l'écran
    requests.insert(0, r);
    notifyListeners();
  }

  Property? byId(String id) {
    for (final p in properties) { if (p.id == id) return p; }
    return null;
  }
}

class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child}) : super(notifier: state);
  static AppState of(BuildContext c) => c.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;
}

String initials(String name) => name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).take(2).map((w) => w[0].toUpperCase()).join();

String fcfa(int n) {
  final s = n.toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(' ');
    b.write(s[i]);
  }
  return b.toString();
}
