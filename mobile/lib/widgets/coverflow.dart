import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme.dart';

/// Carrousel en perspective, comme sur le site : la photo active au centre,
/// ses voisines inclinées et assombries de part et d'autre. Défile tout seul
/// (pause dès que l'utilisateur touche), compteur « 01 / 05 » en bas, et un
/// toucher sur la photo du centre l'ouvre en plein écran.
class CoverflowGallery extends StatefulWidget {
  final int count;
  final Widget Function(BuildContext, int) photo;
  final Duration interval;
  /// Défilement automatique (coupé en mode économie de données)
  final bool autoplay;
  const CoverflowGallery({super.key, required this.count, required this.photo, this.interval = const Duration(seconds: 5), this.autoplay = true});

  @override
  State<CoverflowGallery> createState() => _CoverflowGalleryState();
}

class _CoverflowGalleryState extends State<CoverflowGallery> {
  final ctrl = PageController(viewportFraction: .74);
  int actif = 0;
  Timer? _auto;

  @override
  void initState() {
    super.initState();
    _relancer();
  }

  void _relancer() {
    _auto?.cancel();
    if (widget.count < 2 || !widget.autoplay) return;
    _auto = Timer.periodic(widget.interval, (_) {
      if (!mounted || !ctrl.hasClients) return;
      final suivant = (actif + 1) % widget.count;
      ctrl.animateToPage(suivant, duration: const Duration(milliseconds: 700), curve: Curves.easeOutCubic);
    });
  }

  @override
  void dispose() { _auto?.cancel(); ctrl.dispose(); super.dispose(); }

  void _ouvrir(int i) {
    _auto?.cancel();
    Navigator.of(context).push(PageRouteBuilder(
      opaque: false,
      barrierColor: Colors.black,
      pageBuilder: (_, __, ___) => _PleinEcran(count: widget.count, start: i, photo: widget.photo),
      transitionsBuilder: (_, a, __, child) => FadeTransition(opacity: a, child: child),
    )).then((_) => _relancer());
  }

  @override
  Widget build(BuildContext context) {
    String deux(int v) => v.toString().padLeft(2, '0');
    return Column(children: [
      Expanded(
        child: Listener(
          onPointerDown: (_) => _auto?.cancel(),   // l'utilisateur prend la main…
          onPointerUp: (_) => _relancer(),         // …le défilement reprend ensuite
          child: PageView.builder(
            controller: ctrl,
            itemCount: widget.count,
            onPageChanged: (i) { HapticFeedback.selectionClick(); setState(() => actif = i); },
            itemBuilder: (context, i) => AnimatedBuilder(
              animation: ctrl,
              builder: (context, child) {
                // Position de la page par rapport au centre : 0 = active, ±1 = voisines
                final page = ctrl.hasClients && ctrl.position.haveDimensions ? ctrl.page ?? actif.toDouble() : actif.toDouble();
                final d = (i - page).clamp(-1.6, 1.6);
                final a = d.abs();
                return Transform(
                  alignment: d < 0 ? Alignment.centerRight : Alignment.centerLeft,
                  transform: Matrix4.identity()
                    ..setEntry(3, 2, .0011)        // perspective
                    ..rotateY(-d * .62)
                    ..scaleByDouble(1 - a * .1, 1 - a * .1, 1, 1),
                  child: Stack(fit: StackFit.expand, children: [
                    child!,
                    // Voile : les voisines s'assombrissent à mesure qu'elles s'éloignent
                    IgnorePointer(child: Container(color: Colors.black.withValues(alpha: math.min(a, 1) * .5))),
                  ]),
                );
              },
              child: GestureDetector(
                onTap: () => i == actif
                    ? _ouvrir(i)
                    : ctrl.animateToPage(i, duration: const Duration(milliseconds: 500), curve: Curves.easeOutCubic),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: ClipRRect(borderRadius: BorderRadius.circular(10), child: widget.photo(context, i)),
                ),
              ),
            ),
          ),
        ),
      ),
      const SizedBox(height: 14),
      // Compteur et barre de progression
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        Text(deux(actif + 1), style: J.mono(12, c: J.gold)),
        const SizedBox(width: 12),
        ClipRRect(
          borderRadius: BorderRadius.circular(2),
          child: SizedBox(width: 96, height: 2, child: Stack(children: [
            Container(color: J.cream.withValues(alpha: .2)),
            AnimatedFractionallySizedBox(
              duration: const Duration(milliseconds: 500),
              widthFactor: (actif + 1) / widget.count,
              child: Container(color: J.gold),
            ),
          ])),
        ),
        const SizedBox(width: 12),
        Text('/ ${deux(widget.count)}', style: J.mono(12, c: J.clay300)),
      ]),
    ]);
  }
}

/// Photos en plein écran : glisser pour passer, pincer pour zoomer.
class _PleinEcran extends StatefulWidget {
  final int count, start;
  final Widget Function(BuildContext, int) photo;
  const _PleinEcran({required this.count, required this.start, required this.photo});
  @override
  State<_PleinEcran> createState() => _PleinEcranState();
}

class _PleinEcranState extends State<_PleinEcran> {
  late final ctrl = PageController(initialPage: widget.start);
  late int i = widget.start;
  @override
  void dispose() { ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.black,
        body: Stack(children: [
          PageView.builder(
            controller: ctrl,
            itemCount: widget.count,
            onPageChanged: (v) => setState(() => i = v),
            itemBuilder: (c, k) => InteractiveViewer(
              maxScale: 4,
              child: Center(child: AspectRatio(aspectRatio: 4 / 3, child: widget.photo(c, k))),
            ),
          ),
          SafeArea(child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              Text('${i + 1} / ${widget.count}', style: J.mono(12, c: J.cream)),
              const Spacer(),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close_rounded, color: Colors.white),
                style: IconButton.styleFrom(backgroundColor: Colors.white.withValues(alpha: .12)),
              ),
            ]),
          )),
        ]),
      );
}
