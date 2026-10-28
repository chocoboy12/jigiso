import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;
import '../data/models.dart';
import 'prefs.dart';

/// Rappels de visite programmés sur le téléphone : la veille au soir (18 h)
/// et une heure avant. Ils sonnent même hors connexion et app fermée.
///
/// Les visites étant en heure de Bamako (UTC), on programme en UTC : l'instant
/// est le bon quel que soit le fuseau du téléphone. Mode « inexact » : Android
/// peut décaler de quelques minutes, sans demander l'autorisation des alarmes
/// exactes.
class Rappels {
  static final _plugin = FlutterLocalNotificationsPlugin();
  static bool _pret = false;

  static const _canal = AndroidNotificationDetails(
    'visites', 'Rappels de visite',
    channelDescription: 'Rappel la veille et une heure avant une visite confirmée',
    importance: Importance.high, priority: Priority.high,
  );

  static Future<void> _init() async {
    if (_pret) return;
    tzdata.initializeTimeZones();
    await _plugin.initialize(settings: const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
    ));
    _pret = true;
  }

  /// Demande l'autorisation d'afficher des notifications (Android 13+), une fois.
  static Future<void> _autorisation() async {
    if (Prefs.lire<bool>('rappelsDemande', false)) return;
    await Prefs.ecrire('rappelsDemande', true);
    await _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
    await _plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()
        ?.requestPermissions(alert: true, sound: true);
  }

  static String _h(DateTime d) => '${d.hour.toString().padLeft(2, '0')} h ${d.minute.toString().padLeft(2, '0')}';

  /// Reprogramme tous les rappels d'après la liste des visites.
  static Future<void> synchroniser(List<Visite> visites) async {
    try {
      await _init();
      await _plugin.cancelAll();
      final maintenant = DateTime.now().toUtc();
      final confirmees = visites.where((v) => v.statut == 'confirmee' && v.date.isAfter(maintenant)).toList();
      if (confirmees.isEmpty) return;
      await _autorisation();
      for (final v in confirmees) {
        final d = v.date;   // UTC = heure de Bamako
        final titre = v.property?.title ?? 'Visite';
        final lieu = [v.property?.neighborhood, v.property?.city].where((e) => e != null && e.isNotEmpty).join(', ');
        final avec = v.autreNom.isEmpty ? '' : ' avec ${v.autreNom}';
        final base = v.id.hashCode & 0x3fffffff;
        // La veille à 18 h (si la visite n'est pas déjà demain matin trop tôt pour cela)
        final veille = DateTime.utc(d.year, d.month, d.day - 1, 18);
        if (veille.isAfter(maintenant) && d.difference(veille).inHours >= 3) {
          await _programmer(base * 2, veille, 'Visite demain à ${_h(d)}', '$titre${lieu.isEmpty ? '' : ' — $lieu'}$avec');
        }
        final avant = d.subtract(const Duration(hours: 1));
        if (avant.isAfter(maintenant)) {
          await _programmer(base * 2 + 1, avant, 'Visite dans 1 heure (${_h(d)})', '$titre${lieu.isEmpty ? '' : ' — $lieu'}$avec');
        }
      }
    } catch (_) {
      // Un rappel manqué ne doit jamais bloquer l'app : les e-mails de rappel restent
    }
  }

  static Future<void> _programmer(int id, DateTime quand, String titre, String texte) => _plugin.zonedSchedule(
        id: id,
        scheduledDate: tz.TZDateTime.from(quand, tz.UTC),
        notificationDetails: const NotificationDetails(android: _canal, iOS: DarwinNotificationDetails()),
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        title: titre,
        body: texte,
      );

  /// Déconnexion : plus aucun rappel pour ce compte sur ce téléphone.
  static Future<void> toutAnnuler() async {
    try { await _init(); await _plugin.cancelAll(); } catch (_) {}
  }
}
