import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../data/api.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../data/mali_locations.dart' show Place;
import '../theme.dart';
import 'visits.dart' show BandeauVisites;
import '../widgets/property_card.dart';
import 'detail.dart';
import '../widgets/location_picker.dart';
import '../widgets/maps.dart';
import 'auth.dart' show KitButton;

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
  bool meuble = false;         // raccourci « Meublé »
  int? chambresMin;            // raccourci « 3 chambres et + »
  bool carte = false;          // affichage Liste / Carte
  bool carteDemandee = false;  // économie de données : la carte attend qu'on la demande
  int? _demandeCarteVue;       // dernière demande « montrer ma position » traitée
  bool _doigtSurCarte = false; // la page ne défile pas pendant qu'on manipule la carte
  String? _quartierCarte;       // filtre « quartier » de la carte (null : tous)

  static const cats = [('maison', Icons.house_outlined), ('appartement', Icons.apartment_rounded), ('studio', Icons.bed_outlined), ('villa', Icons.villa_outlined)];

  void _set(VoidCallback f) { HapticFeedback.selectionClick(); setState(() { f(); listKey++; }); }

  /* ── Historique et filtres enregistrés ─────────────────────────────── */
  int get _dernierBudget => budgetSteps.length - 1;
  /// Le lieu choisi (quartier, commune, région) fait partie du filtre ; pas
  /// une position GPS, qui ne vaudrait plus rien une fois la personne partie.
  Map<String, dynamic> _filtreActuelDe(AppState s) => {
        ..._filtreActuel,
        if (s.place.kind != 'bamako' && s.place.kind != 'gps') 'place': s.place.toJson(),
      };
  Map<String, dynamic> get _filtreActuel => {
        'type': type, 'city': city, 'budget': budget == _dernierBudget ? null : budget,
        if (meuble) 'meuble': true,
        if (chambresMin != null) 'chambres': chambresMin,
      };
  void _noter(AppState s) => s.noterRecherche(_filtreActuelDe(s));
  void _appliquer(Map<String, dynamic> f) {
    final pl = f['place'];
    if (pl is Map) AppScope.of(context).setPlace(Place.fromJson(pl));
    _appliquerCriteres(f);
  }
  void _appliquerCriteres(Map<String, dynamic> f) => _set(() {
        type = f['type'] as String?;
        city = f['city'] as String?;
        budget = (f['budget'] as int?) ?? _dernierBudget;
        meuble = f['meuble'] == true;
        chambresMin = f['chambres'] as int?;
      });

  String _libelle(AppState s, Map<String, dynamic> f) => [
        f['type'] == null ? s.t('all') : s.typeLabel(f['type'] as String),
        if (f['place'] is Map) Place.fromJson(f['place'] as Map).labelT(s.t),
        if (f['city'] != null) f['city'] as String,
        if (f['budget'] != null) '≤ ${fcfa(budgetSteps[f['budget'] as int])} FCFA',
        if (f['meuble'] == true) s.t('sc.furnished'),
        if (f['chambres'] != null) '${f['chambres']}+ ${s.t('ch')}',
      ].join(' · ');

  /// Enregistrer la recherche, et en option créer une alerte sur le compte.
  Future<void> _enregistrer(AppState s) async {
    final nom = TextEditingController(text: _libelle(s, _filtreActuelDe(s)));
    var alerte = s.user != null;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(builder: (c, setD) => AlertDialog(
        title: Text(s.t('saved.save'), style: J.ui(18, w: FontWeight.w800)),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          TextField(controller: nom, maxLength: 60, decoration: InputDecoration(labelText: s.t('saved.name'))),
          if (s.user != null)
            CheckboxListTile(
              contentPadding: EdgeInsets.zero, value: alerte, activeColor: J.gold,
              onChanged: (v) => setD(() => alerte = v ?? false),
              title: Text(s.t('saved.alert'), style: J.ui(14)),
            )
          else
            Text(s.t('saved.alertLogin'), style: J.ui(13, c: J.clay500)),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: Text(s.t('cancel'))),
          FilledButton(onPressed: () => Navigator.pop(c, true), style: FilledButton.styleFrom(backgroundColor: J.ink),
              child: Text(s.t('save'))),
        ],
      )),
    );
    if (ok != true || !mounted) return;
    final nomFinal = nom.text.trim().isEmpty ? _libelle(s, _filtreActuelDe(s)) : nom.text.trim();
    s.enregistrerFiltre({..._filtreActuelDe(s), 'name': nomFinal});
    var message = s.t('saved.ok');
    if (alerte) {
      try {
        message = await Api.creerAlerte(nomFinal, {
          if (type != null) 'type': type,
          if ((city ?? (s.place.kind == 'gps' ? null : s.place.city)) != null) 'city': city ?? s.place.city,
          if (budget != _dernierBudget) 'maxPrice': budgetSteps[budget],
        });
      } catch (e) {
        message = '$e';
      }
    }
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  /// Nouveautés des alertes : la liste s'ouvre, et elles sont marquées comme vues.
  void _ouvrirNouveautes(AppState s) {
    final liste = List<Property>.from(s.nouveautes);
    s.nouveautesVues();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: J.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (c) => SafeArea(child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(c).size.height * .8),
        child: ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(20, 18, 20, 20), children: [
          Text(s.t('alerts.t'), style: J.ui(22, w: FontWeight.w800)),
          const SizedBox(height: 14),
          for (final p in liste)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: ListingCard(p, onTap: () { Navigator.pop(c); Navigator.of(context).push(detailRoute(p)); }),
            ),
        ]),
      )),
    );
  }

  /* ── Vitrine de l'accueil ──────────────────────────────────────────── */

  /// Raccourcis de recherche : un toucher applique le filtre (re-toucher l'enlève).
  Widget _raccourcis(AppState s) {
    final budget100k = budgetSteps.indexOf(100000);
    // Bouton maison plutôt que FilterChip : le Chip tronquait les libellés
    // (« Près de mo… ») quand la police s'agrandit.
    Widget r(String cle, IconData icone, bool actif, VoidCallback f) => Padding(
          padding: const EdgeInsets.only(right: 8),
          child: Semantics(
            button: true, selected: actif,
            child: Pressable(
              onTap: () { HapticFeedback.selectionClick(); f(); _noter(s); },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(horizontal: 14),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: actif ? J.ink : J.surface,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: actif ? J.ink : J.soft, width: 1.5),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(icone, size: 17, color: actif ? J.onInk : J.ink),
                  const SizedBox(width: 6),
                  Text(s.t(cle), style: J.ui(13.5, c: actif ? J.onInk : J.ink, w: FontWeight.w600)),
                ]),
              ),
            ),
          ),
        );
    return SizedBox(
      height: 44,
      child: ListView(scrollDirection: Axis.horizontal, physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20), children: [
        r('sc.near', Icons.my_location_rounded, s.place.kind == 'gps', () async {
          final p = await currentPlace(context);
          if (p != null) s.setPlace(p);
        }),
        r('sc.cheap', Icons.savings_outlined, budget == budget100k,
            () => _set(() => budget = budget == budget100k ? _dernierBudget : budget100k)),
        r('sc.furnished', Icons.chair_outlined, meuble, () => _set(() => meuble = !meuble)),
        r('sc.studio', Icons.bed_outlined, type == 'studio', () => _set(() => type = type == 'studio' ? null : 'studio')),
        r('sc.beds3', Icons.king_bed_outlined, chambresMin == 3, () => _set(() => chambresMin = chambresMin == 3 ? null : 3)),
      ]),
    );
  }

  /// Conseils pour louer sans se faire avoir
  void _conseils(AppState s) => showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: J.surface,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
        builder: (c) => SafeArea(child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: MediaQuery.of(c).size.height * .85),
          child: ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(22, 20, 22, 24), children: [
            Text(s.t('safe.t'), style: J.ui(24, w: FontWeight.w800)),
            const SizedBox(height: 16),
            for (final (i, icone) in const [
              (1, Icons.home_work_outlined), (2, Icons.badge_outlined), (3, Icons.trending_down_rounded),
              (4, Icons.description_outlined), (5, Icons.receipt_long_outlined), (6, Icons.wb_sunny_outlined),
              (7, Icons.flag_outlined),
            ])
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(width: 42, height: 42, decoration: BoxDecoration(color: J.gold.withValues(alpha: .14), borderRadius: BorderRadius.circular(12)),
                      child: Icon(icone, color: J.goldDeep, size: 22)),
                  const SizedBox(width: 14),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(s.t('safe.${i}t'), style: J.ui(15.5, w: FontWeight.w800)),
                    const SizedBox(height: 3),
                    Text(s.t('safe.${i}s'), style: J.ui(14, c: J.clay600, h: 1.45)),
                  ])),
                ]),
              ),
          ]),
        )),
      );

  /// Bande horizontale de mini-cartes, avec titre
  Widget _bande(String titre, List<Property> annonces) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const SizedBox(height: 22),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(titre, style: J.ui(16, w: FontWeight.w800))),
        const SizedBox(height: 10),
        SizedBox(
          height: 172,
          child: ListView.separated(
            scrollDirection: Axis.horizontal, physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: annonces.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (_, i) => MiniListing(annonces[i], onTap: () => Navigator.of(context).push(detailRoute(annonces[i]))),
          ),
        ),
      ]);

  /// Vitrine : conseils, quartiers actifs, plus consultés, ajoutés récemment.
  /// Tout est calculé sur les vraies annonces chargées ; une section sans
  /// assez de données ne s'affiche pas.
  List<Widget> _vitrineSections(AppState s) {
    final annonces = s.properties;
    final parQuartier = <String, int>{};
    for (final p in annonces) {
      if (p.neighborhood.trim().isNotEmpty) parQuartier[p.neighborhood] = (parQuartier[p.neighborhood] ?? 0) + 1;
    }
    final quartiers = parQuartier.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    final consultes = annonces.where((p) => p.views > 0).toList()..sort((a, b) => b.views.compareTo(a.views));
    final recents = annonces.where((p) => p.createdAt != null).toList()..sort((a, b) => b.createdAt!.compareTo(a.createdAt!));

    return [
      // Conseils de sécurité
      const SizedBox(height: 18),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Pressable(
          onTap: () => _conseils(s),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: J.x(0xFFEAF3ED), borderRadius: BorderRadius.circular(18)),
            child: Row(children: [
              Container(width: 46, height: 46, decoration: BoxDecoration(color: J.leaf, borderRadius: BorderRadius.circular(14)),
                  child: const Icon(Icons.verified_user_outlined, color: Colors.white)),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(s.t('safe.t'), style: J.ui(15.5, w: FontWeight.w800)),
                Text(s.t('safe.s'), style: J.ui(13, c: J.clay600)),
              ])),
              Icon(Icons.chevron_right_rounded, color: J.leaf),
            ]),
          ),
        ),
      ),
      if (quartiers.length >= 2) ...[
        const SizedBox(height: 22),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(s.t('nb.t'), style: J.ui(16, w: FontWeight.w800))),
        Padding(padding: const EdgeInsets.fromLTRB(20, 2, 20, 10),
            child: Text(s.t('nb.s'), style: J.ui(12.5, c: J.clay500))),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Wrap(spacing: 8, runSpacing: 8, children: [
            for (final q in quartiers.take(6))
              ActionChip(
                avatar: Icon(Icons.place_outlined, size: 16, color: J.goldDeep),
                label: Text('${q.key} · ${q.value}', style: J.ui(13.5, w: FontWeight.w600)),
                backgroundColor: J.surface, side: BorderSide(color: J.soft, width: 1.5), shape: const StadiumBorder(),
                onPressed: () => _set(() => query = q.key),
              ),
          ]),
        ),
      ],
      if (annonces.length >= 4 && consultes.length >= 2) _bande(s.t('feat.t'), consultes.take(6).toList()),
      if (annonces.length >= 4 && recents.length >= 2) _bande(s.t('new.t'), recents.take(6).toList()),
      const SizedBox(height: 22),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Text(s.t('all.t'), style: J.ui(16, w: FontWeight.w800))),
      const SizedBox(height: 4),
    ];
  }

  // Bouton maison plutôt qu'ActionChip : le Chip coupait les libellés longs
  Widget _puce(String texte, IconData icone, VoidCallback onTap, {VoidCallback? onLong}) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: Semantics(
          button: true, label: texte,
          child: GestureDetector(
            onLongPress: onLong,
            child: Pressable(
              onTap: onTap,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                alignment: Alignment.center,
                decoration: BoxDecoration(color: J.x(0xFFF5F1E8), borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(icone, size: 16, color: J.ink),
                  const SizedBox(width: 6),
                  Text(texte, style: J.ui(13, w: FontWeight.w600)),
                ]),
              ),
            ),
          ),
        ),
      );

  List<Property> _filter(List<Property> all) {
    final cap = budget == budgetSteps.length - 1 ? 1 << 40 : budgetSteps[budget];
    final q = query.toLowerCase();
    return all.where((p) => (type == null || p.type == type) && (city == null || p.city == city) && p.price <= cap &&
        (!meuble || p.furnished) && (chambresMin == null || p.bedrooms >= chambresMin!) &&
        (q.isEmpty || '${p.title} ${p.neighborhood} ${p.city}'.toLowerCase().contains(q))).toList();
  }

  Future<void> _filters(AppState s) => showModalBottomSheet(
        context: context,
        backgroundColor: J.surface,
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
                    selectedColor: J.ink, labelStyle: J.ui(13, c: city == c ? J.onInk : J.ink, w: FontWeight.w600),
                    backgroundColor: J.x(0xFFF5F1E8), side: BorderSide.none, shape: const StadiumBorder(),
                    onSelected: (_) { setSheet(() {}); _set(() => city = c); },
                  ),
              ]),
              const SizedBox(height: 18),
              Row(children: [
                Text(tr(context, 'hm.budget'), style: J.ui(14, w: FontWeight.w700)),
                const Spacer(),
                Text('${fcfa(budgetSteps[budget])}${budget == budgetSteps.length - 1 ? ' +' : ''} FCFA', style: J.ui(14, c: J.gold, w: FontWeight.w800)),
              ]),
              Slider(value: budget.toDouble(), max: (budgetSteps.length - 1).toDouble(), divisions: budgetSteps.length - 1,
                  onChanged: (v) { setSheet(() {}); _set(() => budget = v.round()); }),
              const SizedBox(height: 8),
              Pressable(onTap: () => Navigator.pop(ctx), child: Container(height: 56, alignment: Alignment.center,
                  decoration: BoxDecoration(color: J.ink, borderRadius: BorderRadius.circular(18)),
                  child: Text(tr(context, 'hm.results'), style: J.ui(16, c: J.onInk, w: FontWeight.w700)))),
            ]),
          ),
        )),
      );

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    /* La personne vient de demander sa position (bouton rond, « Près de moi ») :
       on lui montre la carte, centrée sur elle — sinon rien ne change à
       l'écran quand aucune annonce n'est à proximité. */
    // (au retour sur l'onglet Accueil, une ancienne demande ne rouvre pas la carte)
    if (_demandeCarteVue == null) {
      _demandeCarteVue = s.demandeCarte;
    } else if (s.demandeCarte != _demandeCarteVue) {
      _demandeCarteVue = s.demandeCarte;
      carte = true;
      carteDemandee = true;   // demande explicite : affichée même en économie de données
    }
    final results = _filter(s.properties);

    return RefreshIndicator(
      color: J.gold,
      onRefresh: s.load,
      child: ListView(
        physics: _doigtSurCarte
            ? const NeverScrollableScrollPhysics()
            : const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
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
                    color: J.surface,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: J.soft, width: 1.5),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(.05), blurRadius: 12, offset: const Offset(0, 3))],
                  ),
                  child: Row(children: [
                    Icon(Icons.search_rounded, size: 21, color: J.ink),
                    const SizedBox(width: 12),
                    Expanded(child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(s.place.labelT(s.t), maxLines: 1, overflow: TextOverflow.ellipsis,
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
                onTap: () => _filters(s).then((_) => _noter(s)),
                child: Container(
                  width: 52, height: 52,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: J.surface,
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
          const SizedBox(height: 12),
          _raccourcis(s),

          if (s.config.bannerOn && s.config.bannerText.isNotEmpty) ...[
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Builder(builder: (_) {
                final bg = Color(int.parse('FF${s.config.bannerColor.replaceAll('#', '')}', radix: 16));
                final fg = bg == J.gold ? J.night : Colors.white;
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

          // Nouveaux logements pour les alertes de la personne
          if (s.nouveautes.isNotEmpty) ...[
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Pressable(
                onTap: () => _ouvrirNouveautes(s),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(color: J.gold, borderRadius: BorderRadius.circular(16)),
                  child: Row(children: [
                    Icon(Icons.notifications_active_rounded, color: J.ink),
                    const SizedBox(width: 10),
                    Expanded(child: Text(
                      '${s.nouveautes.length} ${s.t(s.nouveautes.length > 1 ? 'alerts.newN' : 'alerts.new1')}',
                      style: J.ui(14, w: FontWeight.w700))),
                    Icon(Icons.chevron_right_rounded, color: J.ink),
                  ]),
                ),
              ),
            ),
          ],

          // Filtres enregistrés puis recherches récentes : un toucher pour les réappliquer
          if (s.filtresEnregistres.isNotEmpty || s.historique.isNotEmpty) ...[
            const SizedBox(height: 14),
            SizedBox(
              height: 42,
              child: ListView(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 20),
                children: [
                  for (final f in s.filtresEnregistres)
                    _puce('${f['name'] ?? _libelle(s, f)}', Icons.bookmark_rounded, () => _appliquer(f),
                        onLong: () => showDialog(context: context, builder: (c) => AlertDialog(
                              title: Text('${f['name'] ?? _libelle(s, f)}'),
                              actions: [
                                TextButton(onPressed: () => Navigator.pop(c), child: Text(s.t('cancel'))),
                                TextButton(onPressed: () { s.supprimerFiltre(f); Navigator.pop(c); },
                                    child: Text(s.t('saved.remove'), style: TextStyle(color: J.terracotta))),
                              ],
                            ))),
                  for (final h in s.historique.where((h) => !s.filtresEnregistres.any((f) => _libelle(s, f) == _libelle(s, h))).take(5))
                    _puce(_libelle(s, h), Icons.history_rounded, () => _appliquer(h)),
                  if (s.historique.isNotEmpty)
                    TextButton(onPressed: s.effacerHistorique, child: Text(s.t('hist.clear'), style: J.ui(13, c: J.clay500))),
                ],
              ),
            ),
          ],

          // Enregistrer la recherche en cours (et créer une alerte)
          if (type != null || _filtresActifs)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
              child: Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => _enregistrer(s),
                  icon: Icon(Icons.bookmark_add_outlined, size: 20, color: J.goldDeep),
                  label: Text(s.t('saved.save'), style: J.ui(14, c: J.goldDeep, w: FontWeight.w700)),
                ),
              ),
            ),

          if (query.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Align(alignment: Alignment.centerLeft, child: InputChip(
                avatar: const Icon(Icons.place_outlined, size: 16),
                label: Text(query, style: J.ui(13.5, w: FontWeight.w700)),
                onDeleted: () => _set(() => query = ''),
              )),
            ),

          // Prochaine visite / visites à traiter
          if (s.prochaineVisite != null || s.visitesEnAttente > 0)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: BandeauVisites(onTap: () => s.goTab(2)),
            ),

          // Récemment vus
          if (s.recents.isNotEmpty) ...[
            const SizedBox(height: 18),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text(s.t('recent.t'), style: J.ui(16, w: FontWeight.w800)),
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 172,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: s.recents.length,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (_, i) => MiniListing(s.recents[i],
                    onTap: () => Navigator.of(context).push(detailRoute(s.recents[i]))),
              ),
            ),
          ],

          // Vitrine (conseils, quartiers, plus consultés, nouveautés) quand rien n'est filtré
          if (_vitrine && !s.loading && s.properties.isNotEmpty) ..._vitrineSections(s)
          else if (_vitrine && !s.loading) ...[
            // Même sans annonce, les conseils de sécurité restent utiles
            ..._vitrineSections(s).take(2),
          ],
          const SizedBox(height: 18),

          // Nombre de résultats et bascule Liste / Carte (la carte reste
          // accessible sans résultat : on peut y voir sa position)
          if (!s.loading)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 14),
              child: Row(children: [
                Expanded(child: Text(results.isEmpty ? '' : '${results.length} ${s.t(results.length > 1 ? 'homesN' : 'homes1')}',
                    style: J.ui(13, c: J.clay500, w: FontWeight.w600))),
                SegmentedButton<bool>(
                  showSelectedIcon: false,
                  style: SegmentedButton.styleFrom(
                    selectedBackgroundColor: J.ink, selectedForegroundColor: J.onInk,
                    visualDensity: VisualDensity.compact,
                  ),
                  segments: [
                    ButtonSegment(value: false, icon: const Icon(Icons.view_agenda_outlined, size: 18), label: Text(s.t('map.list'))),
                    ButtonSegment(value: true, icon: const Icon(Icons.map_outlined, size: 18), label: Text(s.t('map.map'))),
                  ],
                  selected: {carte},
                  onSelectionChanged: (v) => setState(() => carte = v.first),
                ),
              ]),
            ),

          if (s.loading)
            const Padding(padding: EdgeInsets.only(top: 60), child: Center(child: CircularProgressIndicator(color: J.gold)))
          else if (carte && s.lowData && !carteDemandee)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
              child: Column(children: [
                Text(s.t('map.lowData'), textAlign: TextAlign.center, style: J.ui(14, c: J.clay500)),
                const SizedBox(height: 12),
                KitButton(label: s.t('map.show'), onTap: () => setState(() => carteDemandee = true)),
              ]),
            )
          else if (carte)
            Builder(builder: (_) {
              /* Explorer par quartier : les quartiers des résultats, avec leur
                 nombre d'annonces ; en toucher un recadre la carte dessus. */
              final parQuartier = <String, int>{};
              for (final p in results) {
                if (p.neighborhood.trim().isNotEmpty) parQuartier.update(p.neighborhood.trim(), (n) => n + 1, ifAbsent: () => 1);
              }
              final quartiers = parQuartier.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
              final choisi = parQuartier.containsKey(_quartierCarte) ? _quartierCarte : null;
              final affichees = choisi == null ? results : results.where((p) => p.neighborhood.trim() == choisi).toList();
              Widget puce(String? q, String label, int n) {
                final on = choisi == q;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Pressable(
                    onTap: () { HapticFeedback.selectionClick(); setState(() => _quartierCarte = q); },
                    child: Semantics(button: true, selected: on, child: AnimatedContainer(
                      duration: const Duration(milliseconds: 160),
                      height: 40,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: on ? J.ink : J.surface,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: on ? J.ink : J.soft, width: 1.5),
                      ),
                      child: Text('$label · $n', style: J.ui(13.5, c: on ? J.onInk : J.ink, w: FontWeight.w600)),
                    )),
                  ),
                );
              }
              return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (quartiers.length > 1) ...[
                  Padding(padding: const EdgeInsets.fromLTRB(20, 4, 20, 8), child: Text(s.t('map.hoods'), style: J.mono(10))),
                  SizedBox(
                    height: 40,
                    child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 20), children: [
                      puce(null, s.t('map.all'), results.length),
                      for (final q in quartiers) puce(q.key, q.key, q.value),
                    ]),
                  ),
                  const SizedBox(height: 10),
                ],
                // Recréée quand le point de référence ou le quartier change : la carte se recadre
                ResultsMap(key: ValueKey('${s.pointRef}|$choisi'), annonces: affichees,
                    surCarte: (v) { if (v != _doigtSurCarte) setState(() => _doigtSurCarte = v); },
                    ouvrir: (p) => Navigator.of(context).push(detailRoute(p))),
              ]);
            })
          else if (results.isEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(40, 50, 40, 0),
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
          else
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
      ),
    );
  }

  bool get _filtresActifs => city != null || budget != budgetSteps.length - 1 || meuble || chambresMin != null;
  /// Écran d'accueil « vitrine » : aucun filtre, aucune recherche, pas la carte
  bool get _vitrine => type == null && !_filtresActifs && query.isEmpty && !carte;

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
      onTap: () { _set(() => type = t); _noter(AppScope.of(context)); },
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
