import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme.dart';

/// Logo JIGISO en pièces (assets/logo/*.png), positions relevées sur
/// JigisoLogoAnimation.module.css. Les pièces se posent une à une.
enum LogoParts { mark, word, stacked }

class _P {
  final String n;
  final double x, y, w, h;
  final Offset from;
  final bool spin;
  const _P(this.n, this.x, this.y, this.w, this.h, this.from, {this.spin = false});
}

const _mark = [
  _P('houseL', 203, 243, 140, 111, Offset(-180, 40)),
  _P('houseR', 392, 243, 140, 111, Offset(180, 40)),
  _P('roof', 163, 140, 409, 138, Offset(0, -220)),
  _P('pL0', 248, 228, 27, 27, Offset(-70, -70)),
  _P('pL1', 272, 228, 27, 26, Offset(70, -70)),
  _P('pL2', 248, 253, 27, 26, Offset(-70, 70)),
  _P('pL3', 272, 252, 27, 27, Offset(70, 70)),
  _P('pR0', 436, 228, 27, 27, Offset(-70, -70)),
  _P('pR1', 460, 228, 28, 27, Offset(70, -70)),
  _P('pR2', 436, 253, 27, 26, Offset(-70, 70)),
  _P('pR3', 460, 252, 28, 27, Offset(70, 70)),
  _P('diamond', 288, 44, 159, 159, Offset(0, -300), spin: true),
];
const _word = [
  _P('J', 136, 414, 47, 132, Offset(0, 160)),
  _P('I1', 199, 414, 35, 109, Offset(0, 160)),
  _P('G', 246, 412, 95, 112, Offset(0, 160)),
  _P('I2', 356, 414, 35, 109, Offset(0, 160)),
  _P('S', 404, 412, 75, 112, Offset(0, 160)),
  _P('O', 486, 412, 112, 112, Offset(0, 160)),
];

class JigisoLogo extends StatefulWidget {
  final LogoParts parts;
  final double height;
  final bool animate;
  final Duration duration;
  final VoidCallback? onDone;
  const JigisoLogo({super.key, this.parts = LogoParts.stacked, required this.height, this.animate = false,
      this.duration = const Duration(milliseconds: 1900), this.onDone});

  @override
  State<JigisoLogo> createState() => _JigisoLogoState();
}

class _JigisoLogoState extends State<JigisoLogo> with SingleTickerProviderStateMixin {
  late final AnimationController c = AnimationController(vsync: this, duration: widget.duration);

  @override
  void initState() {
    super.initState();
    if (widget.animate) {
      c.forward().whenComplete(() => widget.onDone?.call());
    } else {
      c.value = 1;
    }
  }

  /// Rejoue l'assemblage (ex. au toucher)
  void replay() => c.forward(from: 0);

  @override
  void dispose() { c.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final pieces = switch (widget.parts) {
      LogoParts.mark => _mark,
      LogoParts.word => _word,
      LogoParts.stacked => [..._mark, ..._word],
    };
    final Rect b = switch (widget.parts) {
      LogoParts.mark => const Rect.fromLTWH(163, 44, 409, 310),
      LogoParts.word => const Rect.fromLTWH(136, 412, 462, 134),
      LogoParts.stacked => const Rect.fromLTWH(136, 44, 462, 502),
    };
    final s = widget.height / b.height;
    final n = pieces.length;
    final step = 0.62 / n;

    return GestureDetector(
      onTap: widget.animate ? replay : null,
      child: SizedBox(
        width: b.width * s,
        height: b.height * s,
        child: AnimatedBuilder(
          animation: c,
          builder: (_, __) => Stack(clipBehavior: Clip.none, children: [
            for (var i = 0; i < n; i++) _piece(pieces[i], i * step, b, s),
          ]),
        ),
      ),
    );
  }

  Widget _piece(_P p, double start, Rect b, double s) {
    final end = math.min(start + .38, 1.0);
    final t = Interval(start, end, curve: Curves.easeOutBack).transform(c.value);
    final o = Interval(start, math.min(start + .12, 1.0)).transform(c.value);
    return Positioned(
      left: (p.x - b.left) * s + p.from.dx * (1 - t) * s,
      top: (p.y - b.top) * s + p.from.dy * (1 - t) * s,
      width: p.w * s,
      height: p.h * s,
      child: Opacity(
        opacity: o,
        child: Transform.rotate(
          angle: p.spin ? (1 - t) * math.pi : 0,
          child: Image.asset('assets/logo/${p.n}.png', fit: BoxFit.fill, filterQuality: FilterQuality.medium),
        ),
      ),
    );
  }
}

/// Bloc horizontal pour les en-têtes — marque à gauche, mot + signature à droite
class JigisoLockup extends StatelessWidget {
  final double size;
  final bool animate;
  const JigisoLockup({super.key, this.size = 36, this.animate = false});
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        JigisoLogo(parts: LogoParts.mark, height: size, animate: animate),
        SizedBox(width: size * .3),
        Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          JigisoLogo(parts: LogoParts.word, height: size * .48, animate: animate),
          SizedBox(height: size * .1),
          Text('LOCATION · MALI', style: J.mono(math.max(8, size * .215))),
        ]),
      ]);
}
