import 'package:flutter/material.dart';
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
  @override
  Widget build(BuildContext context) => AppScope(
        state: state,
        child: MaterialApp(
          title: 'JIGISO',
          debugShowCheckedModeBanner: false,
          theme: J.theme(),
          home: const SplashScreen(),
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
