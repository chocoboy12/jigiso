import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Système JIGISO — repris de frontend/tailwind.config.js
class J {
  static const ink = Color(0xFF17150F);
  static const inkSoft = Color(0xFF3A3A2A);
  static const cream = Color(0xFFF7F2E8);
  static const card = Color(0xFFFFFDF8);
  static const line = Color(0xFFD8D2C2);
  static const clay200 = Color(0xFFB9B2A0);
  static const clay300 = Color(0xFFA9A292);
  static const clay500 = Color(0xFF7A7462);
  static const clay600 = Color(0xFF4A4636);
  static const gold = Color(0xFFC98A1E);
  static const goldDeep = Color(0xFF8A5E10);
  static const goldDark = Color(0xFF7A4B1E);
  static const leaf = Color(0xFF1E6B3C);
  static const terracotta = Color(0xFFB4532A);
  static const clayred = Color(0xFF8E3F1F);
  static const river = Color(0xFF2B5F7A);
  static const sand = Color(0xFFA5622C);
  static const bg = Color(0xFFFAF8F4);   // fond des écrans app
  static const soft = Color(0xFFECE6DA); // bordures douces

  static const typeTint = {
    'villa': terracotta, 'maison': clayred, 'appartement': leaf, 'studio': gold,
    'chambre': sand, 'bureau': river, 'terrain': clay600,
  };

  static TextStyle serif(double s, {Color c = ink, FontWeight w = FontWeight.w700, double h = 1.05}) =>
      GoogleFonts.sourceSerif4(fontSize: s, fontWeight: w, color: c, height: h, letterSpacing: -s * 0.02);
  static TextStyle sans(double s, {Color c = ink, FontWeight w = FontWeight.w500, double h = 1.4}) =>
      GoogleFonts.inter(fontSize: s, fontWeight: w, color: c, height: h);
  /// Typo interface mobile (Inter)
  static TextStyle ui(double s, {Color c = ink, FontWeight w = FontWeight.w500, double h = 1.3}) =>
      GoogleFonts.inter(fontSize: s, fontWeight: w, color: c, height: h, letterSpacing: s >= 22 ? -s * 0.02 : 0);
  static TextStyle mono(double s, {Color c = clay500}) =>
      GoogleFonts.dmMono(fontSize: s, fontWeight: FontWeight.w500, color: c, letterSpacing: s * 0.14);

  static final softShadow = [BoxShadow(color: ink.withOpacity(.14), blurRadius: 30, offset: const Offset(0, 12), spreadRadius: -18)];
  static final cardShadow = [BoxShadow(color: ink.withOpacity(.22), blurRadius: 40, offset: const Offset(0, 18), spreadRadius: -24)];

  static ThemeData theme() => ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: cream,
        colorScheme: ColorScheme.fromSeed(seedColor: gold, surface: cream, primary: ink, secondary: gold),
        textTheme: GoogleFonts.interTextTheme(),
        sliderTheme: const SliderThemeData(
          activeTrackColor: gold, inactiveTrackColor: line, thumbColor: gold, trackHeight: 4,
          overlayColor: Color(0x33C98A1E),
        ),
      );
}

/// Bande tricolore vert · or · terre cuite
class TriBar extends StatelessWidget {
  final double height;
  const TriBar({super.key, this.height = 3});
  @override
  Widget build(BuildContext context) => SizedBox(
        height: height,
        child: const Row(children: [
          Expanded(child: ColoredBox(color: J.leaf)),
          Expanded(child: ColoredBox(color: J.gold)),
          Expanded(child: ColoredBox(color: J.terracotta)),
        ]),
      );
}

/// Trame quadrillée des sections sombres
class GridBackdrop extends StatelessWidget {
  const GridBackdrop({super.key});
  @override
  Widget build(BuildContext context) => CustomPaint(painter: _GridPainter(), size: Size.infinite);
}

class _GridPainter extends CustomPainter {
  @override
  void paint(Canvas c, Size s) {
    final p = Paint()..color = J.gold.withOpacity(.14)..strokeWidth = 1;
    for (double x = 0; x < s.width; x += 26) { c.drawLine(Offset(x, 0), Offset(x, s.height), p); }
    for (double y = 0; y < s.height; y += 26) { c.drawLine(Offset(0, y), Offset(s.width, y), p); }
  }
  @override
  bool shouldRepaint(_) => false;
}

/// Hachures diagonales — placeholder d'image signature
class Hatch extends StatelessWidget {
  final Color color;
  final String? label;
  const Hatch({super.key, required this.color, this.label});
  @override
  Widget build(BuildContext context) => Stack(fit: StackFit.expand, children: [
        ColoredBox(color: color),
        CustomPaint(painter: _HatchPainter()),
        if (label != null)
          Positioned(left: 12, bottom: 12, child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
            decoration: BoxDecoration(color: J.ink.withOpacity(.5), borderRadius: BorderRadius.circular(5)),
            child: Text(label!, style: J.mono(9, c: J.cream)),
          )),
      ]);
}

class _HatchPainter extends CustomPainter {
  @override
  void paint(Canvas c, Size s) {
    final p = Paint()..color = J.ink.withOpacity(.2)..strokeWidth = 5;
    for (double x = -s.height; x < s.width; x += 15) {
      c.drawLine(Offset(x, s.height), Offset(x + s.height, 0), p);
    }
  }
  @override
  bool shouldRepaint(_) => false;
}

/// Apparition décalée (fondu + glissé)
class Entrance extends StatefulWidget {
  final Widget child;
  final int delayMs;
  final Offset from;
  const Entrance({super.key, required this.child, this.delayMs = 0, this.from = const Offset(0, 24)});
  @override
  State<Entrance> createState() => _EntranceState();
}

class _EntranceState extends State<Entrance> with SingleTickerProviderStateMixin {
  late final AnimationController c = AnimationController(vsync: this, duration: const Duration(milliseconds: 560));
  @override
  void initState() {
    super.initState();
    Future.delayed(Duration(milliseconds: widget.delayMs), () { if (mounted) c.forward(); });
  }
  @override
  void dispose() { c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: c,
        child: widget.child,
        builder: (_, child) {
          final t = Curves.easeOutCubic.transform(c.value);
          return Opacity(opacity: t, child: Transform.translate(offset: widget.from * (1 - t), child: child));
        },
      );
}

/// Bouton qui s'enfonce légèrement à la pression
class Pressable extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  /// Action secondaire — utilisée là où l'appui court sert déjà à autre chose
  /// (sélectionner un quartier) mais où un second geste reste utile.
  final VoidCallback? onLongPress;
  final double scale;
  const Pressable({super.key, required this.child, this.onTap, this.onLongPress, this.scale = .97});
  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool down = false;
  @override
  Widget build(BuildContext context) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => down = true),
        onTapCancel: () => setState(() => down = false),
        onTapUp: (_) => setState(() => down = false),
        onTap: widget.onTap,
        onLongPress: widget.onLongPress,
        child: AnimatedScale(scale: down ? widget.scale : 1, duration: const Duration(milliseconds: 120), child: widget.child),
      );
}

class PillButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final Color bg, fg;
  final Color? border;
  final double height;
  final Widget? icon;
  const PillButton({super.key, required this.label, this.onTap, this.bg = J.ink, this.fg = J.cream, this.border, this.height = 56, this.icon});
  @override
  Widget build(BuildContext context) => Pressable(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          height: height,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999), border: border != null ? Border.all(color: border!, width: 1.5) : null),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (icon != null) ...[icon!, const SizedBox(width: 8)],
            Text(label, style: J.sans(16, c: fg, w: FontWeight.w700)),
          ]),
        ),
      );
}
