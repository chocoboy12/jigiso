import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart';
import 'package:google_fonts/google_fonts.dart';
import 'theme.dart';
import 'state/app_state.dart';
import 'screens/splash.dart';
import 'screens/app_gate.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  /* Les polices sont livrées avec l'app (assets/google_fonts) : on interdit
     leur téléchargement. Avant, Inter, Source Serif et DM Mono étaient
     récupérées chez Google au lancement — texte qui saute, écran figé au
     premier démarrage, et rien du tout sans connexion. */
  GoogleFonts.config.allowRuntimeFetching = false;
  // Licences des polices (OFL), visibles dans « Licences » de l'app
  LicenseRegistry.addLicense(() async* {
    for (final (famille, fichier) in const [('Inter', 'OFL-Inter.txt'), ('Source Serif 4', 'OFL-SourceSerif4.txt'), ('DM Mono', 'OFL-DMMono.txt')]) {
      yield LicenseEntryWithLineBreaks([famille], await rootBundle.loadString('assets/google_fonts/$fichier'));
    }
  });
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent));
  runApp(const JigisoApp());
}

class JigisoApp extends StatefulWidget {
  const JigisoApp({super.key});
  @override
  State<JigisoApp> createState() => _JigisoAppState();
}

class _JigisoAppState extends State<JigisoApp> with WidgetsBindingObserver {
  // Réglages gardés sur le téléphone (langue, taille du texte…) puis données
  final state = AppState()..demarrer();

  /* Retour dans l'app : on recharge les annonces, sinon on ne voyait pas
     celles validées ou supprimées entre-temps. */
  late final AppLifecycleListener _cycle;
  /* Et toutes les 30 s tant que l'app est ouverte, en silence : l'app reste
     souvent au premier plan pendant qu'on agit dans l'admin du site. */
  Timer? _minuteur;
  void _demarrer() {
    _minuteur?.cancel();
    _minuteur = Timer.periodic(const Duration(seconds: 30), (_) => state.refreshProperties());
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    state.addListener(_surReglage);
    _demarrer();
    _cycle = AppLifecycleListener(
      onResume: () { state.refreshProperties(); state.chargerNouveautes(); state.chargerVisites(); _demarrer(); },
      onPause: () => _minuteur?.cancel(),
    );
  }

  @override
  void dispose() { state.removeListener(_surReglage); WidgetsBinding.instance.removeObserver(this); _minuteur?.cancel(); _cycle.dispose(); super.dispose(); }

  // Mode « automatique » : le téléphone passe en sombre ou en clair
  @override
  void didChangePlatformBrightness() { if (state.theme == 'auto') setState(() {}); }

  /* Les couleurs de J sont lues pendant le build : au changement de thème on
     bascule la palette puis on reconstruit tout l'arbre, y compris les
     widgets constants qui ne dépendent d'aucun Theme. */
  String _themeVu = 'auto';
  void _surReglage() { if (state.theme != _themeVu) setState(() => _themeVu = state.theme); }

  void _appliquerTheme() {
    final sombre = state.theme == 'sombre' ||
        (state.theme == 'auto' && WidgetsBinding.instance.platformDispatcher.platformBrightness == Brightness.dark);
    if (sombre == J.sombre) return;
    J.sombre = sombre;
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: sombre ? Brightness.light : Brightness.dark,
      statusBarBrightness: sombre ? Brightness.dark : Brightness.light,
    ));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      void tout(Element e) { e.markNeedsBuild(); e.visitChildren(tout); }
      WidgetsBinding.instance.rootElement?.visitChildren(tout);
    });
  }

  @override
  Widget build(BuildContext context) { _appliquerTheme(); return _app(); }

  Widget _app() => AppScope(
        state: state,
        child: MaterialApp(
          title: 'JIGISO',
          debugShowCheckedModeBanner: false,
          theme: J.theme(),
          home: const SplashScreen(),
          // Calendriers et boîtes de dialogue système en français ou en anglais
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const [Locale('fr'), Locale('en')],
          // Réglages de l'admin : maintenance et mise à jour obligatoire passent devant tout.
          // Taille du texte choisie dans le profil, en plus de celle du téléphone (plafonnée).
          builder: (context, child) {
            final mq = MediaQuery.of(context);
            final systeme = mq.textScaler.scale(14) / 14;
            // AppScope.of : abonne ce builder aux changements de réglage
            final facteur = (systeme * AppScope.of(context).textScale).clamp(1.0, 2.0);
            return MediaQuery(
              data: mq.copyWith(textScaler: TextScaler.linear(facteur)),
              child: AppGate(child: child!),
            );
          },
        ),
      );
}

/// Transition fondu + léger zoom entre écrans
Route<T> fadeRoute<T>(Widget page) => PageRouteBuilder<T>(
      transitionDuration: const Duration(milliseconds: 500),
      reverseTransitionDuration: const Duration(milliseconds: 350),
      pageBuilder: (_, __, ___) => page,
      transitionsBuilder: (_, a, __, child) => FadeTransition(
        opacity: CurvedAnimation(parent: a, curve: Curves.easeOut),
        child: ScaleTransition(scale: Tween(begin: .96, end: 1.0).animate(CurvedAnimation(parent: a, curve: Curves.easeOutCubic)), child: child),
      ),
    );
