import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../data/api.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'maps.dart' show fondCarte, attributionCarte;

/// « À proximité » : écoles, marchés, santé, transports… à moins d'un
/// kilomètre, d'après OpenStreetMap. Seul ce qui est réellement cartographié
/// s'affiche ; la section le dit, car la carte du Mali reste incomplète.
///
/// La première recherche d'un secteur se fait sur le serveur et peut prendre
/// une minute (serveurs OpenStreetMap publics) : on redemande sans bloquer.
class Alentours extends StatefulWidget {
  final Property p;
  const Alentours(this.p, {super.key});
  @override
  State<Alentours> createState() => _AlentoursState();
}

class _AlentoursState extends State<Alentours> {
  Map<String, dynamic>? data;
  String statut = 'chargement';
  Timer? _relance;
  int _essais = 0;
  final ouverts = <String>{};

  static const _ordre = [
    ('ecoles', Icons.school_outlined), ('marches', Icons.storefront_outlined), ('sante', Icons.local_hospital_outlined),
    ('transports', Icons.directions_bus_outlined), ('culte', Icons.mosque_outlined), ('banques', Icons.account_balance_outlined),
  ];

  @override
  void initState() { super.initState(); _charger(); }
  @override
  void dispose() { _relance?.cancel(); super.dispose(); }

  Future<void> _charger() async {
    try {
      final r = await Api.alentours(widget.p.id);
      if (!mounted) return;
      final st = '${r['statut']}';
      setState(() { data = r; statut = st; });
      // Recherche en cours côté serveur : on repasse, au plus ~2 minutes
      if (st == 'enCours' && _essais++ < 12) _relance = Timer(const Duration(seconds: 10), _charger);
      if (st == 'enCours' && _essais > 12) setState(() => statut = 'indisponible');
    } catch (_) {
      if (mounted) setState(() => statut = 'indisponible');
    }
  }

  String _distance(num m) => m < 1000 ? '≈ ${(m / 50).round() * 50} m' : '≈ ${(m / 1000).toStringAsFixed(1).replaceAll('.', ',')} km';

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    if (statut == 'sansPosition') return const SizedBox.shrink();
    final cats = (data?['categories'] as Map?) ?? {};
    final presentes = _ordre.where((c) => ((cats[c.$1] as Map?)?['total'] ?? 0) > 0).toList();

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(s.t('near.t'), style: J.mono(10)),
      const SizedBox(height: 2),
      Text(s.t('near.sub'), style: J.ui(12.5, c: J.clay500)),
      const SizedBox(height: 10),
      if (statut == 'chargement' || statut == 'enCours')
        Row(children: [
          SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: J.gold)),
          const SizedBox(width: 10),
          Expanded(child: Text(s.t('near.loading'), style: J.ui(13.5, c: J.clay500))),
        ])
      else if (statut != 'ok')
        Text(s.t('near.unavail'), style: J.ui(13.5, c: J.clay500))
      else if (presentes.isEmpty)
        Text(s.t('near.none'), style: J.ui(13.5, c: J.clay500))
      else
        Container(
          decoration: BoxDecoration(color: J.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: J.line)),
          child: Column(children: [
            for (var i = 0; i < presentes.length; i++) ...[
              if (i > 0) Divider(height: 1, color: J.line),
              _categorie(s, presentes[i].$1, presentes[i].$2, Map<String, dynamic>.from(cats[presentes[i].$1])),
            ],
          ]),
        ),
      if (statut == 'ok') ...[
        const SizedBox(height: 8),
        Text(s.t('near.osm'), style: J.ui(11.5, c: J.clay500, h: 1.4)),
      ],
      // La carte du Mali est incomplète : chacun peut ajouter ce qui manque
      if (statut == 'ok' || statut == 'indisponible')
        TextButton.icon(
          style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 44)),
          onPressed: () => signalerLieu(context, LatLng(widget.p.lat!, widget.p.lng!)),
          icon: Icon(Icons.add_location_alt_outlined, size: 18, color: J.goldDeep),
          label: Text(s.t('near.missing'), style: J.ui(13.5, c: J.goldDeep, w: FontWeight.w700)),
        ),
    ]);
  }

  Widget _categorie(AppState s, String cle, IconData icone, Map<String, dynamic> c) {
    final lieux = ((c['lieux'] as List?) ?? []).cast<Map>();
    final total = (c['total'] as num?)?.toInt() ?? lieux.length;
    final ouvert = ouverts.contains(cle);
    final visibles = ouvert ? lieux : lieux.take(2).toList();
    return InkWell(
      onTap: lieux.length > 2 ? () => setState(() => ouvert ? ouverts.remove(cle) : ouverts.add(cle)) : null,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(color: J.x(0xFFF5F1E8), borderRadius: BorderRadius.circular(10)),
            child: Icon(icone, size: 19, color: J.goldDeep),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(s.t('near.$cle'), style: J.ui(14.5, w: FontWeight.w700))),
              Text('$total', style: J.ui(14.5, c: J.goldDeep, w: FontWeight.w800)),
            ]),
            for (final l in visibles)
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Row(children: [
                  Expanded(child: Text.rich(TextSpan(text: '${l['nom']}', children: [
                    // Lieu ajouté par un utilisateur et vérifié par l'équipe
                    if (l['communaute'] == true)
                      TextSpan(text: ' · ${s.t('near.community')}', style: J.ui(11.5, c: J.leaf, w: FontWeight.w600)),
                  ]), maxLines: 1, overflow: TextOverflow.ellipsis, style: J.ui(13, c: J.clay600))),
                  const SizedBox(width: 8),
                  Text(_distance(l['distance'] as num), style: J.ui(12.5, c: J.clay500)),
                ]),
              ),
            if (!ouvert && total > visibles.length)
              Padding(padding: const EdgeInsets.only(top: 3),
                  child: Text(s.t('near.more').replaceAll('{n}', '${total - visibles.length}'),
                      style: J.ui(12.5, c: J.goldDeep, w: FontWeight.w600))),
          ])),
        ]),
      ),
    );
  }
}

/* ── Signaler un lieu manquant ───────────────────────────────── */

/// Types proposés, par catégorie (mêmes libellés que le serveur)
const _genres = {
  'ecoles': ['École', 'Jardin d’enfants', 'Lycée / collège', 'Université'],
  'marches': ['Marché', 'Supermarché', 'Alimentation'],
  'sante': ['Centre de santé', 'Pharmacie', 'Hôpital', 'Cabinet médical'],
  'transports': ['Arrêt de transport', 'Gare routière'],
  'culte': ['Lieu de culte'],
  'banques': ['Banque'],
};

/// Formulaire : type, nom, et position en déplaçant la carte sous une cible
/// fixe (plus précis au doigt qu'un toucher sur la carte).
Future<void> signalerLieu(BuildContext context, LatLng depart) async {
  final s = AppScope.of(context);
  final m = ScaffoldMessenger.of(context);
  if (s.user == null) { m.showSnackBar(SnackBar(content: Text(s.t('poi.login')))); return; }
  await showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: J.cream,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
    builder: (_) => _SignalerLieu(depart: depart, messager: m),
  );
}

class _SignalerLieu extends StatefulWidget {
  final LatLng depart;
  final ScaffoldMessengerState messager;
  const _SignalerLieu({required this.depart, required this.messager});
  @override
  State<_SignalerLieu> createState() => _SignalerLieuState();
}

class _SignalerLieuState extends State<_SignalerLieu> {
  String categorie = 'ecoles';
  late String genre = _genres['ecoles']!.first;
  final nom = TextEditingController();
  late LatLng centre = widget.depart;
  bool envoi = false;

  @override
  void dispose() { nom.dispose(); super.dispose(); }

  Future<void> _envoyer() async {
    setState(() => envoi = true);
    try {
      final msg = await Api.proposerLieu(categorie: categorie, genre: genre, nom: nom.text.trim(),
          lat: centre.latitude, lng: centre.longitude);
      if (mounted) Navigator.pop(context);
      widget.messager.showSnackBar(SnackBar(content: Text(msg)));
    } catch (e) {
      widget.messager.showSnackBar(SnackBar(content: Text('$e')));
      if (mounted) setState(() => envoi = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final pret = nom.text.trim().length >= 2 && !envoi;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(s.t('poi.t'), style: J.ui(21, w: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(s.t('poi.sub'), style: J.ui(13, c: J.clay500)),
          const SizedBox(height: 16),
          Text(s.t('poi.type'), style: J.mono(10)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final c in _genres.keys)
              ChoiceChip(
                label: Text(s.t('near.$c')), selected: categorie == c, showCheckmark: false,
                selectedColor: J.ink, labelStyle: J.ui(13, c: categorie == c ? J.onInk : J.ink, w: FontWeight.w600),
                onSelected: (_) => setState(() { categorie = c; genre = _genres[c]!.first; }),
              ),
          ]),
          if (_genres[categorie]!.length > 1) ...[
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: genre, key: ValueKey(categorie),
              decoration: const InputDecoration(border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
              items: [for (final g in _genres[categorie]!) DropdownMenuItem(value: g, child: Text(g))],
              onChanged: (v) { if (v != null) setState(() => genre = v); },
            ),
          ],
          const SizedBox(height: 12),
          TextField(controller: nom, maxLength: 80, onChanged: (_) => setState(() {}),
              decoration: InputDecoration(hintText: s.t('poi.name'), border: const OutlineInputBorder())),
          const SizedBox(height: 4),
          Text(s.t('poi.where'), style: J.mono(10)),
          const SizedBox(height: 2),
          Text(s.t('poi.whereSub'), style: J.ui(12.5, c: J.clay500)),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: SizedBox(height: 230, child: Stack(alignment: Alignment.center, children: [
              FlutterMap(
                options: MapOptions(initialCenter: widget.depart, initialZoom: 16,
                    onPositionChanged: (cam, _) => centre = cam.center),
                children: [fondCarte(), attributionCarte()],
              ),
              // Cible fixe au centre : on déplace la carte dessous
              IgnorePointer(child: Padding(
                padding: const EdgeInsets.only(bottom: 34),
                child: Icon(Icons.location_on, size: 40, color: J.terracotta,
                    shadows: const [Shadow(color: Color(0x66000000), blurRadius: 6)]),
              )),
            ])),
          ),
          const SizedBox(height: 14),
          PillButton(label: envoi ? '…' : s.t('poi.send'), bg: pret ? J.ink : J.line, fg: pret ? J.cream : J.clay500,
              onTap: pret ? _envoyer : null),
        ]),
      )),
    );
  }
}
