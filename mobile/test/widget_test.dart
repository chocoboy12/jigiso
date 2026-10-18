import 'package:flutter_test/flutter_test.dart';
import 'package:jigiso/data/models.dart';

/// Contrat entre l'app et `GET /api/app/config`.
///
/// C'est le point de rupture le plus probable : si le backend renomme un
/// champ, l'app repart silencieusement sur ses valeurs par défaut — plus de
/// maintenance, plus de mise à jour obligatoire — sans la moindre erreur.
/// Le document ci-dessous est la réponse réelle du serveur.
void main() {
  group('AppConfig.fromJson', () {
    final reponseServeur = {
      'maintenance': {'enabled': true, 'message': 'Retour dans une heure.'},
      'version': {
        'current': '1.2.0',
        'minimum': '1.1.0',
        'playStore': 'https://play.google.com/store/apps/details?id=ml.jigiso',
        'appStore': '',
      },
      'flags': {
        'google': true, 'facebook': false, 'apple': true,
        'ownerSignup': true, 'kycRequired': true, 'rentalRequests': true,
      },
      'banner': {'enabled': true, 'text': 'Nouveaux logements à Ségou', 'color': '#C98A1E'},
    };

    test('lit tous les réglages envoyés par le serveur', () {
      final c = AppConfig.fromJson(reponseServeur);

      expect(c.maintenance, isTrue);
      expect(c.maintenanceMessage, 'Retour dans une heure.');
      expect(c.currentVersion, '1.2.0');
      expect(c.minVersion, '1.1.0');
      expect(c.playStore, contains('play.google.com'));
      expect(c.bannerOn, isTrue);
      expect(c.bannerText, 'Nouveaux logements à Ségou');
      expect(c.bannerColor, '#C98A1E');
    });

    test('un drapeau coupé côté administration est bien coupé dans l\'app', () {
      final c = AppConfig.fromJson(reponseServeur);
      expect(c.flag('facebook'), isFalse);
      expect(c.flag('google'), isTrue);
    });

    test('un drapeau inconnu reste actif, pour ne pas casser une version ancienne', () {
      final c = AppConfig.fromJson(reponseServeur);
      expect(c.flag('fonctionnaliteFuture'), isTrue);
    });

    test('une réponse vide donne des réglages neutres', () {
      final c = AppConfig.fromJson({});
      expect(c.maintenance, isFalse);
      expect(c.currentVersion, '1.0.0');
      expect(c.bannerOn, isFalse);
    });
  });

  group('compareVersions — décide de la mise à jour obligatoire', () {
    test('compare nombre par nombre, pas alphabétiquement', () {
      expect(compareVersions('1.10.0', '1.9.0'), greaterThan(0));
    });

    test('versions égales', () => expect(compareVersions('1.2.0', '1.2.0'), 0));

    test('une version installée sous le minimum doit être rejetée', () {
      expect(compareVersions('1.0.5', '1.1.0'), lessThan(0));
    });

    test('tolère une version incomplète', () {
      expect(compareVersions('2', '1.9.9'), greaterThan(0));
    });
  });
}
