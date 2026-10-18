import 'package:flutter/material.dart';
import '../main.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/jigiso_logo.dart';
import 'auth.dart';
import 'owner_home.dart';
import 'shell.dart';

/// Les pièces du logo se posent une à une, puis on passe à l'accueil.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  bool done = false;

  void _finish() async {
    setState(() => done = true);
    await Future.delayed(const Duration(milliseconds: 900));
    if (!mounted) return;

    /* L'animation dure moins longtemps que la reprise de session sur une
       connexion lente. On lui laisse le temps de trancher, sans dépasser
       quelques secondes : au-delà, montrer l'écran d'accueil vaut mieux
       qu'un splash figé, et la session sera reprise au chargement suivant. */
    await AppScope.of(context).sessionDecidee
        .timeout(const Duration(seconds: 6), onTimeout: () {});
    if (!mounted) return;

    /* Une session reprise doit mener directement à l'app. Envoyer tout le
       monde vers l'écran d'accueil rendait le jeton inutile : l'utilisateur
       retrouvait « Créer un compte » à chaque lancement et devait ressaisir
       son mot de passe, alors qu'il n'avait jamais été déconnecté. */
    final u = AppScope.of(context).user;
    Navigator.of(context).pushReplacement(fadeRoute(
      u == null
          ? const WelcomeScreen()
          : u.role == 'owner'
              ? const OwnerShell()
              : const Shell(),
    ));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: J.cream,
        body: Stack(children: [
          Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              JigisoLogo(parts: LogoParts.stacked, height: 210, animate: true, onDone: _finish),
              const SizedBox(height: 22),
              AnimatedOpacity(
                opacity: done ? 1 : 0,
                duration: const Duration(milliseconds: 400),
                child: Text('LOCATION · MALI', style: J.mono(12)),
              ),
            ]),
          ),
          Positioned(
            left: 0, right: 0, bottom: 0,
            child: Align(
              alignment: Alignment.centerLeft,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 700),
                curve: Curves.easeOutCubic,
                width: done ? MediaQuery.of(context).size.width : 0,
                child: const TriBar(height: 5),
              ),
            ),
          ),
        ]),
      );
}
