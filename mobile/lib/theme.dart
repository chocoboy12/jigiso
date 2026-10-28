import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Système JIGISO — repris de frontend/tailwind.config.js
class J {
  /// Mode sombre en cours (fixé par JigisoApp selon le réglage du profil).
  static bool sombre = false;
  static Color _c(int clair, int nuit) => Color(sombre ? nuit : clair);

  // Neutres : inversés en mode sombre (l'encre devient le texte clair)
  static Color get ink => _c(0xFF17150F, 0xFFF1ECE2);
  static Color get inkSoft => _c(0xFF3A3A2A, 0xFFD6D0C2);
  static Color get cream => _c(0xFFF7F2E8, 0xFF16140F);
  static Color get card => _c(0xFFFFFDF8, 0xFF221F18);
  static Color get line => _c(0xFFD8D2C2, 0xFF3D392F);
  static Color get clay200 => _c(0xFFB9B2A0, 0xFF6E6858);
  static Color get clay300 => _c(0xFFA9A292, 0xFF7D7767);
  static Color get clay500 => _c(0xFF7A7462, 0xFFA39C8A);
  static Color get clay600 => _c(0xFF4A4636, 0xFFC9C2B0);
  static Color get bg => _c(0xFFFAF8F4, 0xFF121110);   // fond des écrans app
  static Color get soft => _c(0xFFECE6DA, 0xFF2E2A22); // bordures douces
  /// Panneaux et feuilles (blanc en mode clair)
  static Color get surface => _c(0xFFFFFFFF, 0xFF1D1A14);
  /// Texte posé sur un aplat [ink]
  static Color get onInk => _c(0xFFFFFFFF, 0xFF17150F);
  /// Toujours sombre (présentation, galerie photo), quel que soit le mode
  static const night = Color(0xFF17150F);

  // Couleurs de marque : éclaircies en mode sombre pour rester lisibles
  static const gold = Color(0xFFC98A1E);
  static Color get goldDeep => _c(0xFF8A5E10, 0xFFE0A94A);
  static Color get goldDark => _c(0xFF7A4B1E, 0xFFD9A066);
  static Color get leaf => _c(0xFF1E6B3C, 0xFF3E9A63);
  static Color get terracotta => _c(0xFFB4532A, 0xFFD2693E);
  static const clayred = Color(0xFF8E3F1F);
  static Color get river => _c(0xFF2B5F7A, 0xFF5B9BC0);
  static const sand = Color(0xFFA5622C);

  /// Teintes claires codées en dur dans les écrans : même valeur en mode
  /// clair, équivalent sombre sinon.
  static const _nuit = {
    0xFFF5F1E8: 0xFF26231C, 0xFFF8F6F1: 0xFF26231C, 0xFFF0EBE1: 0xFF2A261F, 0xFFF5F2EC: 0xFF26231C,
    0xFFFFFCF5: 0xFF2B2518, 0xFFFBF6EA: 0xFF2B2518, 0xFFF3E6C8: 0xFF3A2F18, 0xFFE7CE97: 0xFF6B5420,
    0xFFEAE3D4: 0xFF3D392F, 0xFFE1D8C8: 0xFF3D392F,
    0xFFEAF3ED: 0xFF1A2E22, 0xFFE6F0EA: 0xFF1A2E22, 0xFFF4F7F5: 0xFF1A2420, 0xFFE8F0E9: 0xFF1A2E22,
    0xFFB9D3C2: 0xFF2F5A40,
    0xFFFFF9EF: 0xFF2B2518, 0xFFE6E0D6: 0xFF3D392F, 0xFFF4F0E9: 0xFF2A261F, 0xFFCFC6B7: 0xFF5A5446, 0xFF5E584F: 0xFFA39C8A,
    0xFFF9E9E2: 0xFF3A2219, 0xFFFBEDE8: 0xFF3A2219, 0xFFE6EFF4: 0xFF1A2A33,
  };
  static Color x(int clair) => Color(sombre ? (_nuit[clair] ?? clair) : clair);

  static Map<String, Color> get typeTint => {
    'villa': terracotta, 'maison': clayred, 'appartement': leaf, 'studio': gold,
    'chambre': sand, 'bureau': river, 'terrain': clay600,
  };

  /* Source Serif et DM Mono n'ont pas les lettres du bambara (ɛ, ɔ, ɲ, ŋ) :
     elles viennent alors d'Inter, livrée avec l'app, plutôt que d'une police
     système au hasard — ou d'un carré vide sur certains téléphones. */
  static List<String> _secours(FontWeight w) => [GoogleFonts.inter(fontWeight: w).fontFamily!];

  static TextStyle serif(double s, {Color? c, FontWeight w = FontWeight.w700, double h = 1.05}) =>
      GoogleFonts.sourceSerif4(fontSize: s, fontWeight: w, color: c ?? ink, height: h, letterSpacing: -s * 0.02)
          .copyWith(fontFamilyFallback: _secours(w));
  static TextStyle sans(double s, {Color? c, FontWeight w = FontWeight.w500, double h = 1.4}) =>
      GoogleFonts.inter(fontSize: s, fontWeight: w, color: c ?? ink, height: h);
  /// Typo interface mobile (Inter)
  static TextStyle ui(double s, {Color? c, FontWeight w = FontWeight.w500, double h = 1.3}) =>
      GoogleFonts.inter(fontSize: s, fontWeight: w, color: c ?? ink, height: h, letterSpacing: s >= 22 ? -s * 0.02 : 0);
  static TextStyle mono(double s, {Color? c}) =>
      GoogleFonts.dmMono(fontSize: s, fontWeight: FontWeight.w500, color: c ?? clay500, letterSpacing: s * 0.14)
          .copyWith(fontFamilyFallback: _secours(FontWeight.w500));

  static List<BoxShadow> get softShadow => [BoxShadow(color: night.withOpacity(sombre ? .5 : .14), blurRadius: 30, offset: const Offset(0, 12), spreadRadius: -18)];
  static List<BoxShadow> get cardShadow => [BoxShadow(color: night.withOpacity(sombre ? .6 : .22), blurRadius: 40, offset: const Offset(0, 18), spreadRadius: -24)];

  static final _themes = <bool, ThemeData>{};
  static ThemeData theme() => _themes[sombre] ??= _construireTheme();
  static ThemeData _construireTheme() {
    final b = sombre ? Brightness.dark : Brightness.light;
    return ThemeData(
      useMaterial3: true,
      brightness: b,
      scaffoldBackgroundColor: cream,
      colorScheme: ColorScheme.fromSeed(seedColor: gold, brightness: b, surface: sombre ? card : cream, primary: ink, onPrimary: onInk, secondary: gold),
      textTheme: GoogleFonts.interTextTheme(ThemeData(brightness: b).textTheme).apply(bodyColor: ink, displayColor: ink),
      dividerColor: line,
      sliderTheme: SliderThemeData(
        activeTrackColor: gold, inactiveTrackColor: line, thumbColor: gold, trackHeight: 4,
        overlayColor: const Color(0x33C98A1E),
      ),
    );
  }
}

/// Bande tricolore vert · or · terre cuite
class TriBar extends StatelessWidget {
  final double height;
  const TriBar({super.key, this.height = 3});
  @override
  Widget build(BuildContext context) => SizedBox(
        height: height,
        child: Row(children: [
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
            decoration: BoxDecoration(color: J.night.withOpacity(.5), borderRadius: BorderRadius.circular(5)),
            child: Text(label!, style: J.mono(9, c: const Color(0xFFF7F2E8))),
          )),
      ]);
}

class _HatchPainter extends CustomPainter {
  @override
  void paint(Canvas c, Size s) {
    final p = Paint()..color = J.night.withOpacity(.2)..strokeWidth = 5;
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
  PillButton({super.key, required this.label, this.onTap, Color? bg, Color? fg, this.border, this.height = 56, this.icon}) : bg = bg ?? J.ink, fg = fg ?? J.cream;
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
