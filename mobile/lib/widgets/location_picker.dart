import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../data/api.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import '../data/mali_locations.dart';
import '../theme.dart';
import '../state/app_state.dart';

/// Le Mali tient dans ce cadre (mêmes bornes que le serveur, qui refuse
/// toute position d'annonce en dehors).
bool dansLeMali(double lat, double lng) => lat >= 10 && lat <= 25.5 && lng >= -12.5 && lng <= 4.5;

/// Récupère la position GPS (demande la permission si besoin).
///
/// Précision élevée, 15 s au plus, puis repli sur la dernière position
/// connue. Une position hors du Mali est refusée avec une explication : elle
/// ne trouverait aucun logement et donnerait des distances de milliers de km
/// (cas typique : un émulateur Android, placé par défaut en Californie).
Future<Place?> currentPlace(BuildContext context) async {
  final m = ScaffoldMessenger.of(context);
  final s = AppScope.of(context);
  void dire(String cle, {SnackBarAction? action}) =>
      m.showSnackBar(SnackBar(content: Text(s.t(cle)), action: action, duration: const Duration(seconds: 6)));

  if (!await Geolocator.isLocationServiceEnabled()) {
    dire('gps.off', action: SnackBarAction(label: s.t('gps.settings'), onPressed: Geolocator.openLocationSettings));
    return null;
  }
  var p = await Geolocator.checkPermission();
  if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
  if (p == LocationPermission.deniedForever) {
    dire('gps.denied', action: SnackBarAction(label: s.t('gps.settings'), onPressed: Geolocator.openAppSettings));
    return null;
  }
  if (p == LocationPermission.denied) { dire('gps.denied'); return null; }

  Position? pos;
  try {
    pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 15)),
    );
  } catch (_) {
    pos = await Geolocator.getLastKnownPosition();   // pas de signal GPS (intérieur…) : dernière position connue
  }
  if (pos == null) { dire('gps.timeout'); return null; }

  if (!dansLeMali(pos.latitude, pos.longitude)) {
    m.showSnackBar(SnackBar(
      duration: const Duration(seconds: 8),
      content: Text('${s.t('gps.outside')} (${pos.latitude.toStringAsFixed(2)}, ${pos.longitude.toStringAsFixed(2)})'),
    ));
    return null;
  }
  return Place.gps(pos.latitude, pos.longitude);
}

/// Feuille « Où cherchez-vous ? » — GPS, Bamako (communes + quartiers), régions
Future<Place?> showLocationPicker(BuildContext context, {Place? current, Color accent = J.gold, bool allowGps = true}) =>
    showModalBottomSheet<Place>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _LocationSheet(current: current, accent: accent, allowGps: allowGps),
    );

class _LocationSheet extends StatefulWidget {
  final Place? current;
  final Color accent;
  final bool allowGps;
  const _LocationSheet({this.current, required this.accent, required this.allowGps});
  @override
  State<_LocationSheet> createState() => _LocationSheetState();
}

class _LocationSheetState extends State<_LocationSheet> {
  late bool regions = widget.current?.kind == 'region';
  String? open = 'V';
  String q = '';
  bool locating = false;

  void _done(Place p) { HapticFeedback.selectionClick(); Navigator.pop(context, p); }

  @override
  Widget build(BuildContext context) {
    final a = widget.accent;
    final cur = widget.current;
    final filter = q.toLowerCase();
    return Container(
      height: MediaQuery.of(context).size.height * .88,
      decoration: BoxDecoration(color: J.surface, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Center(child: Container(width: 40, height: 5, decoration: BoxDecoration(color: J.line, borderRadius: BorderRadius.circular(3)))),
            const SizedBox(height: 14),
            Row(children: [
              Expanded(child: Text(tr(context, 'lp.where'), style: J.ui(22, w: FontWeight.w800))),
              IconButton(onPressed: () => Navigator.pop(context), icon: Icon(Icons.close_rounded, color: J.clay500)),
            ]),
            const SizedBox(height: 10),
            if (widget.allowGps) ...[
              Pressable(
                onTap: () async {
                  setState(() => locating = true);
                  final p = await currentPlace(context);
                  if (!mounted) return;
                  setState(() => locating = false);
                  if (p != null) _done(p);
                },
                child: Container(
                  height: 56,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(color: a.withOpacity(.12), borderRadius: BorderRadius.circular(18)),
                  child: Row(children: [
                    locating ? SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: a)) : Icon(Icons.my_location_rounded, color: J.ink),
                    const SizedBox(width: 12),
                    Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(tr(context, 'lp.useGps'), style: J.ui(15, w: FontWeight.w700)),
                      Text(tr(context, 'lp.useGpsSub'), style: J.ui(12, c: J.clay500)),
                    ])),
                    const Icon(Icons.chevron_right_rounded),
                  ]),
                ),
              ),
              const SizedBox(height: 12),
            ],
            Container(
              height: 52,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(color: J.x(0xFFF8F6F1), borderRadius: BorderRadius.circular(16), border: Border.all(color: J.soft, width: 1.5)),
              child: Row(children: [
                Icon(Icons.search_rounded, color: J.clay300),
                const SizedBox(width: 10),
                Expanded(child: TextField(onChanged: (v) => setState(() => q = v), style: J.ui(15),
                    decoration: InputDecoration(border: InputBorder.none, hintText: 'Commune, quartier, région…', hintStyle: J.ui(15, c: J.clay300)))),
              ]),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(color: J.x(0xFFF5F1E8), borderRadius: BorderRadius.circular(14)),
              child: Row(children: [
                for (final t in [(false, 'Bamako'), (true, 'Régions')])
                  Expanded(child: GestureDetector(
                    onTap: () => setState(() => regions = t.$1),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      height: 40, alignment: Alignment.center,
                      decoration: BoxDecoration(color: regions == t.$1 ? J.surface : Colors.transparent, borderRadius: BorderRadius.circular(11)),
                      child: Text(t.$2, style: J.ui(14, c: regions == t.$1 ? J.ink : J.clay500, w: FontWeight.w700)),
                    ),
                  )),
              ]),
            ),
          ]),
        ),
        Expanded(
          child: ListView(padding: const EdgeInsets.fromLTRB(20, 12, 20, 30), children: regions
              ? [
                  for (final r in maliRegions.entries.where((e) => filter.isEmpty || e.key.toLowerCase().contains(filter)))
                    _row(
                      icon: cur?.kind == 'region' && cur?.region == r.key ? Icons.radio_button_checked_rounded : Icons.radio_button_unchecked_rounded,
                      title: tr(context, 'pl.region').replaceAll('{r}', r.key), sub: tr(context, 'lp.capital').replaceAll('{c}', r.value),
                      on: cur?.kind == 'region' && cur?.region == r.key,
                      onTap: () => _done(Place.region(r.key)),
                      carte: '${r.key}, Mali',
                    ),
                ]
              : [
                  if (filter.isEmpty) _row(icon: Icons.location_city_rounded, title: tr(context, 'pl.bamako'), sub: tr(context, 'lp.district'), on: cur?.kind == 'bamako', onTap: () => _done(const Place.bamako()), carte: 'Bamako, Mali'),
                  for (final c in bamakoCommunes.entries)
                    if (filter.isEmpty || c.value.any((x) => x.toLowerCase().contains(filter)) || 'commune ${c.key}'.toLowerCase().contains(filter))
                      _commune(c.key, c.value.where((x) => filter.isEmpty || x.toLowerCase().contains(filter)).toList(), cur, forceOpen: filter.isNotEmpty),
                ]),
        ),
      ]),
    );
  }

  /* Voir un lieu sur une carte.

     L'app n'embarque pas de carte : on ouvre celle du téléphone, qui sait
     déjà centrer, afficher les transports et surtout lancer le guidage.
     Embarquer une carte aurait demandé une clé Google facturée, ou un paquet
     supplémentaire, pour un résultat moins bon que l'app native.

     Les noms de quartiers maliens sont inégalement présents dans
     OpenStreetMap : on prévient quand le lieu reste introuvable plutôt que
     d'ouvrir une carte au mauvais endroit. */
  Future<void> _surLaCarte(String lieu) async {
    final messager = ScaffoldMessenger.of(context);
    setState(() => _carteEnCours = lieu);
    try {
      final point = await Api.geocode(lieu);
      if (!mounted) return;
      if (point == null) {
        messager.showSnackBar(SnackBar(content: Text('« $lieu » est introuvable sur la carte.')));
        return;
      }
      final uri = Uri.parse(
          'https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}');
      if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        if (mounted) messager.showSnackBar(SnackBar(content: Text(tr(context, 'lp.noMaps'))));
      }
    } catch (e) {
      if (mounted) messager.showSnackBar(SnackBar(content: Text('${tr(context, 'lp.mapFail')} $e')));
    } finally {
      if (mounted) setState(() => _carteEnCours = null);
    }
  }

  /// Lieu dont on attend les coordonnées — pour n'animer que celui-ci.
  String? _carteEnCours;

  Widget _row({required IconData icon, required String title, required String sub, required bool on, required VoidCallback onTap, String? carte}) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Pressable(
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(color: on ? widget.accent.withOpacity(.08) : J.surface, borderRadius: BorderRadius.circular(16),
                border: Border.all(color: on ? widget.accent : J.soft, width: 1.5)),
            child: Row(children: [
              Icon(icon, size: 22, color: on ? widget.accent : J.clay300),
              const SizedBox(width: 12),
              Expanded(child: Text(title, style: J.ui(15, w: FontWeight.w700))),
              Text(sub, style: J.ui(12, c: J.clay300)),
              if (carte != null) ...[
                const SizedBox(width: 6),
                Pressable(
                  onTap: () => _surLaCarte(carte),
                  child: Padding(
                    padding: const EdgeInsets.all(6),
                    child: _carteEnCours == carte
                        ? const SizedBox(width: 18, height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: J.gold))
                        : Icon(Icons.map_outlined, size: 20, color: J.clay500),
                  ),
                ),
              ],
            ]),
          ),
        ),
      );

  Widget _commune(String num, List<String> qs, Place? cur, {bool forceOpen = false}) {
    final isOpen = forceOpen || open == num;
    final inC = (cur?.kind == 'commune' || cur?.kind == 'quartier') && cur?.commune == num;
    final carteCommune = 'Commune $num, Bamako, Mali';
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(color: J.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: inC ? widget.accent : J.soft, width: 1.5)),
      child: Column(children: [
        InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => setState(() => open = isOpen ? null : num),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              Container(width: 34, height: 34, alignment: Alignment.center, decoration: BoxDecoration(color: J.x(0xFFF5F1E8), borderRadius: BorderRadius.circular(10)),
                  child: Text(num, style: J.ui(13, c: J.goldDeep, w: FontWeight.w800))),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'lp.commune').replaceAll('{n}', '$num'), style: J.ui(15, w: FontWeight.w700)),
                Text('${bamakoCommunes[num]!.length} quartiers', style: J.ui(12, c: J.clay300)),
              ])),
              Pressable(
                onTap: () => _surLaCarte(carteCommune),
                child: Padding(
                  padding: const EdgeInsets.all(6),
                  child: _carteEnCours == carteCommune
                      ? const SizedBox(width: 18, height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: J.gold))
                      : Icon(Icons.map_outlined, size: 20, color: J.clay500),
                ),
              ),
              AnimatedRotation(turns: isOpen ? .5 : 0, duration: const Duration(milliseconds: 200), child: Icon(Icons.expand_more_rounded, color: J.clay500)),
            ]),
          ),
        ),
        AnimatedSize(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOutCubic,
          child: isOpen
              ? Padding(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    // L'appui court choisit le quartier : c'est la raison d'être
                    // de cette feuille. La carte passe donc par l'appui long,
                    // annoncé ici pour qu'il ne reste pas à découvrir.
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(children: [
                        Icon(Icons.map_outlined, size: 13, color: J.clay300),
                        const SizedBox(width: 5),
                        Expanded(child: Text(tr(context, 'lp.longPress'), style: J.ui(11, c: J.clay300))),
                      ]),
                    ),
                    Align(alignment: Alignment.centerLeft, child: Wrap(spacing: 6, runSpacing: 6, children: [
                      _chip(tr(context, 'lp.wholeCommune'), inC && cur?.kind == 'commune', () => _done(Place.commune(num)), strong: true, carte: carteCommune),
                      for (final x in qs) _chip(x, inC && cur?.quartier == x, () => _done(Place.quartier(num, x)), carte: '$x, Bamako, Mali'),
                    ])),
                  ]),
                )
              : const SizedBox(width: double.infinity),
        ),
      ]),
    );
  }

  Widget _chip(String l, bool on, VoidCallback f, {bool strong = false, String? carte}) => Pressable(
        onTap: f,
        onLongPress: carte == null
            ? null
            : () {
                HapticFeedback.mediumImpact();
                _surLaCarte(carte);
              },
        /* Pas d'`alignment` ici : un Container qui en porte un s'étire à toute
           la largeur disponible, et chaque quartier occupait une ligne entière
           — le Wrap et son `spacing` ne servaient plus à rien. Sans alignement,
           le Container se dimensionne sur son contenu et les quartiers
           redeviennent des pastilles qui se suivent. */
        child: Container(
          height: 34,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(color: on ? J.ink : (strong ? widget.accent.withOpacity(.15) : J.x(0xFFF5F1E8)), borderRadius: BorderRadius.circular(999)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Text(l, style: J.ui(12, c: on ? J.onInk : J.ink, w: strong ? FontWeight.w700 : FontWeight.w600)),
            if (carte != null && _carteEnCours == carte) ...[
              const SizedBox(width: 6),
              SizedBox(width: 12, height: 12,
                  child: CircularProgressIndicator(strokeWidth: 1.6, color: on ? J.onInk : J.goldDeep)),
            ],
          ]),
        ),
      );
}
