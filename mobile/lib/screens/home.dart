import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/property_card.dart';
import 'detail.dart';
import '../widgets/location_picker.dart';

/// Écran 05 — Accueil locataire, façon kit mobile
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String? type;
  String? city;
  int budget = budgetSteps.length - 1;
  String query = '';
  int listKey = 0;

  static const cats = [('maison', Icons.house_outlined), ('appartement', Icons.apartment_rounded), ('studio', Icons.bed_outlined), ('villa', Icons.villa_outlined)];

  void _set(VoidCallback f) { HapticFeedback.selectionClick(); setState(() { f(); listKey++; }); }

  List<Property> _filter(List<Property> all) {
    final cap = budget == budgetSteps.length - 1 ? 1 << 40 : budgetSteps[budget];
    final q = query.toLowerCase();
    return all.where((p) => (type == null || p.type == type) && (city == null || p.city == city) && p.price <= cap &&
        (q.isEmpty || '${p.title} ${p.neighborhood} ${p.city}'.toLowerCase().contains(q))).toList();
  }

  void _filters(AppState s) => showModalBottomSheet(
        context: context,
        backgroundColor: Colors.white,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
        builder: (_) => StatefulBuilder(builder: (ctx, setSheet) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Center(child: Container(width: 40, height: 5, decoration: BoxDecoration(color: J.soft, borderRadius: BorderRadius.circular(3)))),
              const SizedBox(height: 16),
              Text('Filtres', style: J.ui(22, w: FontWeight.w800)),
              const SizedBox(height: 16),
              Text('Ville', style: J.ui(14, w: FontWeight.w700)),
              const SizedBox(height: 8),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final c in [null, ...maliCities.take(6)])
                  ChoiceChip(
                    label: Text(c ?? 'Toutes'), selected: city == c, showCheckmark: false,
                    selectedColor: J.ink, labelStyle: J.ui(13, c: city == c ? Colors.white : J.ink, w: FontWeight.w600),
                    backgroundColor: const Color(0xFFF5F1E8), side: BorderSide.none, shape: const StadiumBorder(),
                    onSelected: (_) { setSheet(() {}); _set(() => city = c); },
                  ),
              ]),
              const SizedBox(height: 18),
              Row(children: [
                Text('Budget max', style: J.ui(14, w: FontWeight.w700)),
                const Spacer(),
                Text('${fcfa(budgetSteps[budget])}${budget == budgetSteps.length - 1 ? ' +' : ''} FCFA', style: J.ui(14, c: J.gold, w: FontWeight.w800)),
              ]),
              Slider(value: budget.toDouble(), max: (budgetSteps.length - 1).toDouble(), divisions: budgetSteps.length - 1,
                  onChanged: (v) { setSheet(() {}); _set(() => budget = v.round()); }),
              const SizedBox(height: 8),
              Pressable(onTap: () => Navigator.pop(ctx), child: Container(height: 56, alignment: Alignment.center,
                  decoration: BoxDecoration(color: J.ink, borderRadius: BorderRadius.circular(18)),
                  child: Text('Voir les résultats', style: J.ui(16, c: Colors.white, w: FontWeight.w700)))),
            ]),
          ),
        )),
      );

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final results = _filter(s.properties);

    return RefreshIndicator(
      color: J.gold,
      onRefresh: s.load,
      child: ListView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        padding: EdgeInsets.fromLTRB(0, MediaQuery.of(context).padding.top + 10, 0, 130),
        children: [
          /* Une seule barre pour toute la recherche : le lieu ouvre le
             sélecteur (qui porte aussi « utiliser ma position »), le bouton
             rond ouvre les filtres. Deux rangées séparées mangeaient le haut
             de l'écran pour la même fonction. */
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(children: [
              Expanded(child: Pressable(
                onTap: () async {
                  final place = await showLocationPicker(context, current: s.place);
                  if (place != null) s.setPlace(place);
                },
                child: Container(
                  height: 58,
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: J.soft, width: 1.5),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(.05), blurRadius: 12, offset: const Offset(0, 3))],
                  ),
                  child: Row(children: [
                    const Icon(Icons.search_rounded, size: 21, color: J.ink),
                    const SizedBox(width: 12),
                    Expanded(child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(s.place.label, maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: J.ui(14.5, w: FontWeight.w700)),
                        const SizedBox(height: 1),
                        Text(_resume(s), maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: J.ui(12.5, c: J.clay500)),
                      ],
                    )),
                  ]),
                ),
              )),
              const SizedBox(width: 10),
              Pressable(
                onTap: () => _filters(s),
                child: Container(
                  width: 52, height: 52,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white,
                    border: Border.all(color: _filtresActifs ? J.gold : J.soft, width: 1.5),
                  ),
                  child: Icon(Icons.tune_rounded, size: 20, color: _filtresActifs ? J.gold : J.ink),
                ),
              ),
            ]),
          ),
          const SizedBox(height: 16),

          /* Types de logement : une bande qui défile, pour qu'ajouter un type
             n'oblige pas à repenser la grille. */
          SizedBox(
            height: 64,
            child: ListView(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                _tab(s, null, Icons.apps_rounded, s.t('all')),
                for (final c in cats) _tab(s, c.$1, c.$2, s.typeLabel(c.$1)),
              ],
            ),
          ),
          Container(height: 1, color: J.soft),

          if (s.config.bannerOn && s.config.bannerText.isNotEmpty) ...[
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Builder(builder: (_) {
                final bg = Color(int.parse('FF${s.config.bannerColor.replaceAll('#', '')}', radix: 16));
                final fg = bg == J.gold ? J.ink : Colors.white;
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
                  child: Row(children: [
                    Icon(Icons.campaign_outlined, color: fg, size: 20),
                    const SizedBox(width: 10),
                    Expanded(child: Text(s.config.bannerText, style: J.ui(13, c: fg, w: FontWeight.w600))),
                  ]),
                );
              }),
            ),
          ],

          const SizedBox(height: 18),

          if (s.loading)
            const Padding(padding: EdgeInsets.only(top: 60), child: Center(child: CircularProgressIndicator(color: J.gold)))
          else if (results.isEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(40, 70, 40, 0),
              child: Column(children: [
                Icon(s.offline ? Icons.cloud_off_rounded : Icons.search_off_rounded, size: 40, color: J.clay300),
                const SizedBox(height: 14),
                Text(s.offline ? s.t('offline') : s.t('empty.t'),
                    textAlign: TextAlign.center, style: J.ui(16, w: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(s.offline ? '' : s.t('empty.s'),
                    textAlign: TextAlign.center, style: J.ui(14, c: J.clay500)),
              ]),
            )
          else ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text('${results.length} ${s.t(results.length > 1 ? 'homesN' : 'homes1')}',
                  style: J.ui(13, c: J.clay500, w: FontWeight.w600)),
            ),
            const SizedBox(height: 14),
            for (var i = 0; i < results.length; i++)
              Entrance(
                key: ValueKey('c$listKey-${results[i].id}'),
                delayMs: 60 * (i > 4 ? 4 : i),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 26),
                  child: ListingCard(results[i],
                      onTap: () => Navigator.of(context).push(detailRoute(results[i]))),
                ),
              ),
          ],
        ],
      ),
    );
  }

  bool get _filtresActifs => city != null || budget != budgetSteps.length - 1;

  /// « Tous · jusqu'à 300 000 FCFA » — ce que la barre résume sous le lieu.
  String _resume(AppState s) {
    final morceaux = <String>[
      type == null ? s.t('all') : s.typeLabel(type!),
      if (budget != budgetSteps.length - 1) '≤ ${fcfa(budgetSteps[budget])} FCFA',
    ];
    return morceaux.join('  ·  ');
  }

  /// Onglet de type, souligné quand il est actif.
  Widget _tab(AppState s, String? t, IconData icon, String label) {
    final on = type == t;
    return Pressable(
      onTap: () => _set(() => type = t),
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 200),
        opacity: on ? 1 : .55,
        child: Container(
          margin: const EdgeInsets.only(right: 26),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 23, color: J.ink),
            const SizedBox(height: 5),
            Text(label, style: J.ui(12, w: on ? FontWeight.w700 : FontWeight.w500)),
            const SizedBox(height: 5),
            AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              height: 2, width: on ? 28 : 0,
              decoration: BoxDecoration(color: J.ink, borderRadius: BorderRadius.circular(2)),
            ),
          ]),
        ),
      ),
    );
  }
}
