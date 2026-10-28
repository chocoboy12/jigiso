import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';

/// Réglages et habitudes gardés sur le téléphone : langue, taille du texte,
/// mode économie de données, annonces récemment consultées, historique des
/// recherches et filtres enregistrés.
///
/// Un simple fichier JSON dans les documents de l'app : rien de tout cela
/// n'est sensible (le jeton de connexion, lui, reste dans le trousseau).
class Prefs {
  static const _nom = 'preferences.json';
  static Map<String, dynamic> _d = {};

  static Future<File> _fichier() async => File('${(await getApplicationDocumentsDirectory()).path}/$_nom');

  static Future<void> charger() async {
    try {
      final f = await _fichier();
      if (await f.exists()) _d = jsonDecode(await f.readAsString()) as Map<String, dynamic>;
    } catch (_) {
      _d = {};   // fichier illisible : on repart des réglages par défaut
    }
  }

  static Future<void> _ecrire() async {
    try { await (await _fichier()).writeAsString(jsonEncode(_d)); } catch (_) {}
  }

  static T lire<T>(String cle, T defaut) {
    final v = _d[cle];
    return v is T ? v : defaut;
  }

  static List<Map<String, dynamic>> liste(String cle) =>
      ((_d[cle] as List?) ?? []).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList();

  static Future<void> ecrire(String cle, Object? valeur) {
    _d[cle] = valeur;
    return _ecrire();
  }
}
