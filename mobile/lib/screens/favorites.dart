import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/property_card.dart';
import 'detail.dart';

class FavoritesScreen extends StatelessWidget {
  const FavoritesScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    // Favoris du compte (ou du téléphone pour un invité), quelle que soit la ville affichée
    final list = s.listeFavoris;
    return SafeArea(
      bottom: false,
      child: ListView(padding: const EdgeInsets.fromLTRB(20, 24, 20, 120), children: [
        Entrance(child: Text(s.t('fav.t'), style: J.serif(34))),
        const SizedBox(height: 18),
        if (list.isEmpty)
          Entrance(delayMs: 100, child: Container(
            padding: const EdgeInsets.all(36),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(24), border: Border.all(color: J.line, width: 1.5)),
            child: Text(s.t('fav.empty'), textAlign: TextAlign.center, style: J.sans(14, c: J.clay500)),
          )),
        for (var i = 0; i < list.length; i++)
          Entrance(
            key: ValueKey(list[i].id),
            delayMs: 60 * i,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Dismissible(
                key: ValueKey('d-${list[i].id}'),
                direction: DismissDirection.endToStart,
                background: Container(
                  alignment: Alignment.centerRight,
                  padding: const EdgeInsets.only(right: 24),
                  decoration: BoxDecoration(color: J.terracotta, borderRadius: BorderRadius.circular(16)),
                  child: Icon(Icons.delete_outline_rounded, color: J.cream),
                ),
                onDismissed: (_) {
                  final id = list[i].id;
                  s.toggleFav(id);
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    behavior: SnackBarBehavior.floating,
                    margin: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                    backgroundColor: J.ink,
                    content: Text(s.t('fav.removed'), style: J.sans(14, c: J.cream)),
                    action: SnackBarAction(label: s.t('undo'), textColor: J.gold, onPressed: () => s.toggleFav(id)),
                  ));
                },
                child: Pressable(
                  onTap: () => Navigator.of(context).push(detailRoute(list[i])),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: J.card, borderRadius: BorderRadius.circular(16), boxShadow: J.cardShadow),
                    child: Row(children: [
                      ClipRRect(borderRadius: BorderRadius.circular(12),
                          child: SizedBox(width: 84, height: 84, child: Hero(tag: 'photo-${list[i].id}', child: PropertyPhoto(list[i])))),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${s.typeLabel(list[i].type)} · ${list[i].neighborhood}'.toUpperCase(), maxLines: 1, overflow: TextOverflow.ellipsis, style: J.mono(9.5, c: J.goldDeep)),
                        const SizedBox(height: 4),
                        Text(list[i].title, maxLines: 2, overflow: TextOverflow.ellipsis, style: J.serif(17, h: 1.2)),
                        const SizedBox(height: 4),
                        Text('${fcfa(list[i].price)} FCFA / ${s.t('month')}', style: J.sans(14, w: FontWeight.w700)),
                      ])),
                      HeartButton(list[i].id),
                    ]),
                  ),
                ),
              ),
            ),
          ),
      ]),
    );
  }
}
