import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../data/api.dart';
import '../main.dart';
import '../state/app_state.dart';
import '../state/prefs.dart';
import '../theme.dart';
import '../widgets/jigiso_logo.dart';
import 'auth.dart';

/// Présentation au premier lancement : quatre écrans, puis l'écran d'accueil.
///
/// Les images sont de vraies photos du Mali (servies par l'API, Wikimedia
/// Commons), créditées comme l'exige leur licence. Hors connexion, un fond
/// aux couleurs de JIGISO les remplace : rien ne bloque la présentation.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final ctrl = PageController();
  int page = 0;
  List<Map<String, dynamic>> photos = [];
  static const _pages = [('onb.1t', 'onb.1s'), ('onb.2t', 'onb.2s'), ('onb.3t', 'onb.3s'), ('onb.4t', 'onb.4s')];

  @override
  void initState() {
    super.initState();
    Api.photosMali().then((p) { if (mounted) setState(() => photos = p); }).catchError((_) {});
  }

  @override
  void dispose() { ctrl.dispose(); super.dispose(); }

  Future<void> _terminer() async {
    await Prefs.ecrire('onboardingVu', true);
    if (!mounted) return;
    Navigator.of(context).pushReplacement(fadeRoute(const WelcomeScreen()));
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final derniere = page == _pages.length - 1;
    return Scaffold(
      backgroundColor: J.night,
      body: Stack(children: [
        PageView.builder(
          controller: ctrl,
          itemCount: _pages.length,
          onPageChanged: (i) { HapticFeedback.selectionClick(); setState(() => page = i); },
          itemBuilder: (_, i) => _Diapo(
            photo: photos.isEmpty ? null : photos[i % photos.length],
            titre: s.t(_pages[i].$1),
            texte: s.t(_pages[i].$2),
            pied: i == _pages.length - 1 ? _langues(s) : null,
          ),
        ),
        // « Passer »
        SafeArea(child: Align(
          alignment: Alignment.topRight,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: TextButton(
              onPressed: _terminer,
              child: Text(s.t('onb.skip'), style: J.ui(15, c: Colors.white, w: FontWeight.w700)),
            ),
          ),
        )),
        // Points et bouton
        Positioned(
          left: 24, right: 24, bottom: 24 + MediaQuery.of(context).padding.bottom,
          child: Row(children: [
            for (var i = 0; i < _pages.length; i++)
              AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                margin: const EdgeInsets.only(right: 6),
                width: i == page ? 24 : 8, height: 8,
                decoration: BoxDecoration(color: i == page ? J.gold : Colors.white.withValues(alpha: .4),
                    borderRadius: BorderRadius.circular(4)),
              ),
            const Spacer(),
            Pressable(
              onTap: derniere ? _terminer : () => ctrl.nextPage(duration: const Duration(milliseconds: 400), curve: Curves.easeOutCubic),
              child: Container(
                height: 56, padding: const EdgeInsets.symmetric(horizontal: 28),
                alignment: Alignment.center,
                decoration: BoxDecoration(color: J.gold, borderRadius: BorderRadius.circular(999)),
                child: Text(s.t(derniere ? 'onb.start' : 'onb.next'), style: J.ui(16, c: J.night, w: FontWeight.w800)),
              ),
            ),
          ]),
        ),
      ]),
    );
  }

  Widget _langues(AppState s) => Row(children: [
        for (final (l, nom) in const [('fr', 'Français'), ('bm', 'Bamanankan'), ('en', 'English')]) ...[
          Expanded(child: Pressable(
            onTap: () => s.setLang(l),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              constraints: const BoxConstraints(minHeight: 52),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: s.lang == l ? J.gold : Colors.white.withValues(alpha: .12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(nom, style: J.ui(14, c: s.lang == l ? J.night : Colors.white, w: FontWeight.w700)),
            ),
          )),
          if (l != 'en') const SizedBox(width: 8),
        ],
      ]);
}

class _Diapo extends StatelessWidget {
  final Map<String, dynamic>? photo;
  final String titre, texte;
  final Widget? pied;
  const _Diapo({required this.photo, required this.titre, required this.texte, this.pied});

  @override
  Widget build(BuildContext context) {
    final url = photo?['url'] as String?;
    final credit = [photo?['credit'], photo?['license']].whereType<String>().join(' · ');
    return Stack(fit: StackFit.expand, children: [
      // Photo réelle du Mali, ou fond de marque si elle ne se charge pas
      if (url != null)
        Image.network(url, fit: BoxFit.cover,
            // Décodée à la taille de l'écran (les photos d'origine sont plus grandes)
            cacheHeight: (MediaQuery.sizeOf(context).height * MediaQuery.devicePixelRatioOf(context)).round(),
            frameBuilder: (_, child, frame, sync) => AnimatedOpacity(
                opacity: frame == null && !sync ? 0 : 1, duration: const Duration(milliseconds: 500), child: child),
            errorBuilder: (_, __, ___) => const _FondMarque())
      else
        const _FondMarque(),
      // Dégradé : texte lisible quelle que soit la photo
      const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(
        begin: Alignment.topCenter, end: Alignment.bottomCenter,
        colors: [Color(0x66000000), Color(0x00000000), Color(0xCC17150F), Color(0xF217150F)],
        stops: [0, .3, .62, 1],
      ))),
      SafeArea(child: Padding(
        padding: const EdgeInsets.fromLTRB(28, 0, 28, 110),
        child: Column(mainAxisAlignment: MainAxisAlignment.end, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const JigisoLogo(parts: LogoParts.mark, height: 46),
          const SizedBox(height: 18),
          Text(titre, style: J.ui(32, c: Colors.white, w: FontWeight.w800, h: 1.1)),
          const SizedBox(height: 12),
          Text(texte, style: J.ui(16, c: Colors.white.withValues(alpha: .86), w: FontWeight.w500, h: 1.45)),
          if (pied != null) ...[const SizedBox(height: 22), pied!],
          if (credit.isNotEmpty) ...[
            const SizedBox(height: 18),
            Text('${photo?['caption'] ?? ''} — $credit',
                style: J.ui(10.5, c: Colors.white.withValues(alpha: .55))),
          ],
        ]),
      )),
    ]);
  }
}

class _FondMarque extends StatelessWidget {
  const _FondMarque();
  @override
  Widget build(BuildContext context) => const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(
        begin: Alignment.topLeft, end: Alignment.bottomRight,
        colors: [Color(0xFF1E6B3C), Color(0xFFC98A1E), Color(0xFFB4532A)],
      )));
}
