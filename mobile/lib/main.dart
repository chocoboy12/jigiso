import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter/services.dart';
import 'theme.dart';
import 'state/app_state.dart';
import 'screens/splash.dart';
import 'screens/app_gate.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent));
  runApp(const JigisoApp());
}

class JigisoApp extends StatefulWidget {
  const JigisoApp({super.key});
  @override
  State<JigisoApp> createState() => _JigisoAppState();
}

class _JigisoAppState extends State<JigisoApp> {
  final state = AppState()..load();

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
    _demarrer();
    _cycle = AppLifecycleListener(
      onResume: () { state.refreshProperties(); _demarrer(); },
      onPause: () => _minuteur?.cancel(),
    );
  }

  @override
  void dispose() { _minuteur?.cancel(); _cycle.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => AppScope(
        state: state,
        child: MaterialApp(
          title: 'JIGISO',
          debugShowCheckedModeBanner: false,
          theme: J.theme(),
          home: const SplashScreen(),
          // Calendriers et boîtes de dialogue système en français ou en anglais
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const [Locale('fr'), Locale('en')],
          // Réglages de l'admin : maintenance et mise à jour obligatoire passent devant tout
          builder: (context, child) => AppGate(child: child!),
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
