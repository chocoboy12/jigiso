import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'home.dart';
import 'favorites.dart';
import 'requests.dart';
import 'profile.dart';
import '../widgets/location_picker.dart';

/// Coque locataire : barre du bas avec bouton central
class Shell extends StatelessWidget {
  const Shell({super.key});

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final pages = const [HomeScreen(), FavoritesScreen(), RequestsScreen(), ProfileScreen()];
    return Scaffold(
      backgroundColor: J.bg,
      extendBody: true,
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 260),
        transitionBuilder: (c, a) => FadeTransition(opacity: a, child: c),
        child: KeyedSubtree(key: ValueKey(s.tab), child: pages[s.tab]),
      ),
      bottomNavigationBar: KitNavBar(
        index: s.tab,
        onTap: s.goTab,
        items: [
          (Icons.home_rounded, s.t('tab.home')),
          (Icons.favorite_border_rounded, s.t('tab.fav')),
          (Icons.mail_outline_rounded, s.t('tab.req')),
          (Icons.person_outline_rounded, s.t('tab.me')),
        ],
        badges: [0, s.favorites.length, s.requests.length + s.visitesEnAttente, 0],
        fabIcon: Icons.my_location_rounded,
        onFab: () async {
          final p = await currentPlace(context);
          if (p != null) s.setPlace(p);
        },
      ),
    );
  }
}

/// Barre de navigation façon kit mobile : 4 onglets + bouton central flottant
class KitNavBar extends StatelessWidget {
  final int index;
  final ValueChanged<int> onTap;
  final List<(IconData, String)> items;
  final List<int>? badges;
  final IconData fabIcon;
  final Color fabBg, fabFg, accent;
  final VoidCallback onFab;
  KitNavBar({super.key, required this.index, required this.onTap, required this.items, this.badges, required this.fabIcon, Color? fabBg, this.fabFg = J.gold, this.accent = J.gold, required this.onFab}) : fabBg = fabBg ?? J.ink;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).padding.bottom;
    Widget item(int i) => Expanded(
          // Lecteur d'écran : chaque onglet annoncé comme un bouton, avec son état
          child: Semantics(
            button: true, selected: index == i, label: items[i].$2,
            excludeSemantics: true,
            child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () { HapticFeedback.selectionClick(); onTap(i); },
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              AnimatedScale(
                scale: index == i ? 1.12 : 1,
                duration: const Duration(milliseconds: 220),
                child: Badge(
                  isLabelVisible: (badges?[i] ?? 0) > 0,
                  label: Text('${badges?[i] ?? 0}'),
                  backgroundColor: J.terracotta,
                  child: Icon(items[i].$1, size: 26, color: index == i ? accent : J.clay300),
                ),
              ),
              const SizedBox(height: 3),
              // La barre a une hauteur fixe : son texte grandit, mais pas au-delà de 120 %
              MediaQuery.withClampedTextScaling(
                maxScaleFactor: 1.2,
                child: Text(items[i].$2, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: J.ui(12, c: index == i ? J.goldDeep : J.clay500, w: index == i ? FontWeight.w800 : FontWeight.w600)),
              ),
              const SizedBox(height: 4),
              AnimatedContainer(duration: const Duration(milliseconds: 220), width: index == i ? 18 : 0, height: 3,
                  decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(2))),
            ]),
          ),
          ),
        );
    return SizedBox(
      height: 92 + bottom,
      child: Stack(clipBehavior: Clip.none, alignment: Alignment.topCenter, children: [
        Positioned.fill(
          top: 0,
          child: Container(
            padding: EdgeInsets.fromLTRB(10, 12, 10, bottom),
            decoration: BoxDecoration(color: J.surface, borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
                boxShadow: [BoxShadow(color: J.night.withOpacity(.12), blurRadius: 30, offset: const Offset(0, -8), spreadRadius: -10)]),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [item(0), item(1), const SizedBox(width: 72), item(2), item(3)]),
          ),
        ),
        Positioned(
          top: -26,
          child: Pressable(
            scale: .9,
            onTap: () { HapticFeedback.mediumImpact(); onFab(); },
            child: Container(
              width: 64, height: 64,
              decoration: BoxDecoration(color: fabBg, shape: BoxShape.circle, border: Border.all(color: J.bg, width: 5),
                  boxShadow: [BoxShadow(color: fabBg.withOpacity(.5), blurRadius: 20, offset: const Offset(0, 10), spreadRadius: -8)]),
              child: Icon(fabIcon, size: 28, color: fabFg),
            ),
          ),
        ),
      ]),
    );
  }
}
