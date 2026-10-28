import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../data/api.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/property_card.dart';
import '../widgets/coverflow.dart';
import '../widgets/maps.dart';
import '../widgets/nearby.dart';
import '../widgets/share_badges.dart';
import 'visits.dart';
import 'request_sheet.dart';

Route detailRoute(Property p) => PageRouteBuilder(
      transitionDuration: const Duration(milliseconds: 520),
      reverseTransitionDuration: const Duration(milliseconds: 400),
      pageBuilder: (_, __, ___) => DetailScreen(p),
      transitionsBuilder: (_, a, __, c) => FadeTransition(opacity: CurvedAnimation(parent: a, curve: const Interval(0, .6)), child: c),
    );

const amenityIcons = {
  'parking': Icons.local_parking_rounded, 'electricity': Icons.bolt_rounded, 'water': Icons.water_drop_outlined,
  'airConditioning': Icons.ac_unit_rounded, 'wifi': Icons.wifi_rounded, 'kitchen': Icons.kitchen_outlined,
  'security': Icons.lock_outline_rounded, 'generator': Icons.battery_charging_full_rounded,
  'balcony': Icons.balcony_outlined, 'garden': Icons.local_florist_outlined,
};

class DetailScreen extends StatefulWidget {
  final Property p;
  const DetailScreen(this.p, {super.key});
  @override
  State<DetailScreen> createState() => _DetailScreenState();
}

class _DetailScreenState extends State<DetailScreen> {
  int photo = 0;

  /* L'annonce reçue vient de la liste, qui ne porte pas les coordonnées du
     propriétaire. On recharge donc le détail à l'ouverture. En cas d'échec
     on garde la version de la liste : l'écran reste lisible, seuls les
     boutons de contact manquent. */
  late Property p = widget.p;

  /* Suggestions et loyer du marché : facultatifs, chargés en parallèle.
     Rien ne s'affiche s'ils sont vides (pas assez d'annonces comparables). */
  List<({Property property, String raison})> similaires = [];
  Map<String, dynamic>? marche;

  @override
  void initState() {
    super.initState();
    Api.property(widget.p.id)
        .then((complet) {
          if (!mounted) return;
          setState(() => p = complet);
          AppScope.of(context).voir(complet);   // « récemment vus »
        })
        .catchError((e) {
          if (!mounted) return;
          // Annonce supprimée ou retirée : on la retire des « récemment vus » et on le dit
          if (e is ApiException && e.statusCode == 404) {
            AppScope.of(context).oublierAnnonce(widget.p.id);
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppScope.of(context).t('removed'))));
          }
          /* hors ligne : on reste sur ce qu'on a */
        });
    Api.similaires(widget.p.id)
        .then((l) { if (mounted) setState(() => similaires = l); })
        .catchError((_) {});
    Api.prixDuMarche(widget.p.id)
        .then((m) { if (mounted) setState(() => marche = m); })
        .catchError((_) {});
  }

  Future<void> _signaler(AppState s) async {
    if (s.user == null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.t('rep.login'))));
      return;
    }
    String? motif;
    final details = TextEditingController();
    final envoyer = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: J.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (c) => StatefulBuilder(builder: (c, setS) => Padding(
        padding: EdgeInsets.fromLTRB(20, 18, 20, 20 + MediaQuery.of(c).viewInsets.bottom),
        child: SafeArea(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(s.t('rep.t'), style: J.ui(22, w: FontWeight.w800)),
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final m in const ['fausse_annonce', 'fraude', 'mauvaise_information', 'deja_loue', 'comportement_suspect', 'autre'])
              ChoiceChip(
                label: Text(s.t('rep.$m')), selected: motif == m, showCheckmark: false,
                selectedColor: J.ink, labelStyle: J.ui(13.5, c: motif == m ? J.onInk : J.ink, w: FontWeight.w600),
                onSelected: (_) => setS(() => motif = m),
              ),
          ]),
          const SizedBox(height: 12),
          TextField(controller: details, maxLines: 3, maxLength: 500,
              decoration: InputDecoration(hintText: s.t('rep.details'), border: const OutlineInputBorder())),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: motif == null ? null : () => Navigator.pop(c, true),
            style: FilledButton.styleFrom(backgroundColor: J.terracotta, minimumSize: const Size.fromHeight(52)),
            child: Text(s.t('rep.send')),
          ),
        ])),
      )),
    );
    if (envoyer != true || motif == null || !mounted) return;
    try {
      await Api.signaler(p.id, motif!, details.text.trim());
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.t('rep.ok'))));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Map<String, (String, IconData, Color)> get _verdicts => {
    'bas': (tr(context, 'dt.low'), Icons.trending_down_rounded, J.river),
    'moyen': (tr(context, 'dt.mid'), Icons.check_circle_outline_rounded, J.leaf),
    'eleve': (tr(context, 'dt.high'), Icons.trending_up_rounded, J.goldDeep),
  };

  Widget _marche(Map<String, dynamic> m) {
    final v = _verdicts[m['verdict']] ?? _verdicts['moyen']!;
    int n(Object? x) => x is num ? x.toInt() : 0;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: v.$3.withValues(alpha: .08), borderRadius: BorderRadius.circular(16)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(v.$2, size: 20, color: v.$3),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(v.$1, style: J.sans(14, c: v.$3, w: FontWeight.w700)),
          const SizedBox(height: 3),
          Text(tr(context, 'dt.range').replaceAll('{a}', fcfa(n(m['low']))).replaceAll('{b}', fcfa(n(m['high']))).replaceAll('{n}', '${n(m['comparables'])}'), style: J.sans(12.5, c: J.clay600, w: FontWeight.w400, h: 1.4)),
        ])),
      ]),
    );
  }

  Widget _similaires() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr(context, 'dt.similar'), style: J.mono(10)),
        const SizedBox(height: 10),
        SizedBox(
          height: 222,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            itemCount: similaires.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, i) {
              final s = similaires[i];
              return Pressable(
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => DetailScreen(s.property))),
                child: SizedBox(
                  width: 200,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    ClipRRect(borderRadius: BorderRadius.circular(14),
                        child: SizedBox(height: 120, width: 200, child: PropertyPhoto(s.property))),
                    const SizedBox(height: 8),
                    if (s.raison.isNotEmpty)
                      Row(children: [
                        const Icon(Icons.auto_awesome_rounded, size: 12, color: J.gold),
                        const SizedBox(width: 4),
                        Expanded(child: Text(s.raison, maxLines: 1, overflow: TextOverflow.ellipsis, style: J.sans(11.5, c: J.clay500))),
                      ]),
                    const SizedBox(height: 2),
                    Text(s.property.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: J.sans(14, w: FontWeight.w700)),
                    Text('${s.property.neighborhood}, ${s.property.city}', maxLines: 1, overflow: TextOverflow.ellipsis, style: J.sans(12, c: J.clay500)),
                    Text('${fcfa(s.property.price)} FCFA / mois', style: J.sans(13, w: FontWeight.w700)),
                  ]),
                ),
              );
            },
          ),
        ),
      ]);

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final amen = amenityKeys.where((k) => p.amenities[k] == true).toList();
    final canRent = p.availability && !p.reserved;
    final carrousel = p.images.length > 1;

    return Scaffold(
      backgroundColor: J.cream,
      body: CustomScrollView(physics: const BouncingScrollPhysics(), slivers: [
        SliverAppBar(
          // Plusieurs photos : carrousel en perspective sur fond sombre, un peu plus haut
          expandedHeight: carrousel ? 430 : 380,
          pinned: true,
          stretch: true,
          backgroundColor: J.cream,
          surfaceTintColor: Colors.transparent,
          leading: Padding(padding: const EdgeInsets.all(6), child: _circle(Icons.arrow_back_rounded, () => Navigator.pop(context))),
          actions: [
            Padding(padding: const EdgeInsets.only(right: 8),
                child: Semantics(button: true, label: s.t('share.t'),
                    child: _circle(Icons.share_outlined, () => partagerAnnonce(context, p)))),
            // Signaler une annonce douteuse (conseils de sécurité, n° 7)
            Padding(padding: const EdgeInsets.only(right: 8),
                child: Semantics(button: true, label: s.t('rep.t'),
                    child: _circle(Icons.flag_outlined, () => _signaler(s)))),
            Padding(padding: const EdgeInsets.only(right: 12), child: HeartButton(p.id, size: 44)),
          ],
          flexibleSpace: FlexibleSpaceBar(
            stretchModes: const [StretchMode.zoomBackground],
            background: Hero(
              tag: 'photo-${p.id}',
              child: carrousel
                  ? Container(
                      color: J.night,
                      padding: EdgeInsets.fromLTRB(0, MediaQuery.of(context).padding.top + 62, 0, 18),
                      child: CoverflowGallery(count: p.photoCount, autoplay: !s.lowData, photo: (_, i) => PropertyPhoto(p, index: i)),
                    )
                  : Stack(fit: StackFit.expand, children: [
                PageView.builder(
                  itemCount: p.photoCount,
                  onPageChanged: (i) => setState(() => photo = i),
                  itemBuilder: (_, i) => PropertyPhoto(p, index: i),
                ),
                Positioned(
                  bottom: 18, right: 20,
                  child: Row(children: [
                    for (var i = 0; i < p.photoCount; i++)
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        margin: const EdgeInsets.only(left: 4),
                        height: 4, width: i == photo ? 26 : 12,
                        decoration: BoxDecoration(color: i == photo ? J.cream : J.cream.withOpacity(.4), borderRadius: BorderRadius.circular(2)),
                      ),
                  ]),
                ),
              ]),
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 22, 20, 140),
          sliver: SliverList.list(children: [
            Entrance(child: Text('${s.typeLabel(p.type)} · ${s.t(p.furnished ? 'furnished' : 'unfurnished')}'.toUpperCase(), style: J.mono(10, c: J.goldDeep))),
            const SizedBox(height: 8),
            Entrance(delayMs: 60, child: Text(p.title, style: J.serif(32))),
            const SizedBox(height: 8),
            Entrance(delayMs: 100, child: Text('${p.city} — ${p.neighborhood}', style: J.sans(15, c: J.clay500))),
            const SizedBox(height: 10),
            Entrance(delayMs: 140, child: Row(children: [
              _Pulse(color: canRent ? J.leaf : J.terracotta),
              const SizedBox(width: 8),
              Text(s.t(canRent ? 'avail' : 'notAvail'), style: J.sans(13, c: canRent ? J.leaf : J.terracotta, w: FontWeight.w600)),
            ])),
            if (p.approved || p.ownerVerified) ...[const SizedBox(height: 12), BadgesVerif(p)],
            const SizedBox(height: 20),
            Entrance(delayMs: 180, child: Row(children: [
              _stat('${p.bedrooms > 0 ? p.bedrooms : '—'}', s.t('beds')),
              const SizedBox(width: 8),
              _stat('${p.bathrooms > 0 ? p.bathrooms : '—'}', s.t('baths')),
              const SizedBox(width: 8),
              _stat('${p.area}', 'M²'),
            ])),
            // Économie de données : les photos ne se chargent qu'à la demande
            if (!s.photosVisibles(p.id) && p.images.isNotEmpty) ...[
              const SizedBox(height: 14),
              Pressable(
                onTap: () => s.afficherPhotos(p.id),
                child: Container(
                  height: 48,
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: J.line, width: 1.5)),
                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(Icons.image_outlined, size: 20, color: J.ink),
                    const SizedBox(width: 8),
                    Text('${s.t('photo.show')} (${p.images.length})', style: J.sans(14, w: FontWeight.w700)),
                  ]),
                ),
              ),
            ],
            if (marche != null) ...[const SizedBox(height: 16), _marche(marche!)],
            const SizedBox(height: 20),
            Entrance(delayMs: 220, child: Text(p.description, style: J.sans(15, c: J.clay600, w: FontWeight.w400, h: 1.6))),
            const SizedBox(height: 22),
            if (amen.isNotEmpty) ...[
              Text(s.t('amenities'), style: J.mono(10)),
              const SizedBox(height: 10),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (var i = 0; i < amen.length; i++)
                  Entrance(
                    delayMs: 260 + i * 40,
                    from: const Offset(0, 12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(borderRadius: BorderRadius.circular(999), border: Border.all(color: J.line, width: 1.5)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(amenityIcons[amen[i]], size: 15, color: J.goldDeep),
                        const SizedBox(width: 6),
                        Text(s.amenityLabel(amen[i]), style: J.sans(13, w: FontWeight.w600)),
                      ]),
                    ),
                  ),
              ]),
              const SizedBox(height: 22),
            ],
            // Emplacement : seulement si le propriétaire a posé la position GPS
            if (p.aPosition) ...[
              LocationCard(p, avecCarte: !s.lowData),
              const SizedBox(height: 22),
              Alentours(p),
              const SizedBox(height: 22),
            ],
            Entrance(delayMs: 320, child: _ownerCard(s, p)),
            // Visite sur place : proposée ici, confirmée par le propriétaire
            if (s.user?.role != 'owner' && s.user?.id != p.ownerId && canRent) ...[
              const SizedBox(height: 12),
              PillButton(
                label: s.t('visit.plan'), height: 52, bg: Colors.transparent, fg: J.ink, border: J.ink,
                icon: Icon(Icons.event_available_rounded, size: 20, color: J.ink),
                onTap: () => planifierVisite(context, p),
              ),
            ],
            if (similaires.isNotEmpty) ...[const SizedBox(height: 28), _similaires()],
          ]),
        ),
      ]),
      bottomSheet: Container(
        padding: EdgeInsets.fromLTRB(20, 14, 20, 14 + MediaQuery.of(context).padding.bottom),
        decoration: BoxDecoration(color: J.cream, border: Border(top: BorderSide(color: J.line))),
        child: Row(children: [
          Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${fcfa(p.price)} FCFA', style: J.serif(21)),
            Text('/ ${s.t('month')}'.toUpperCase(), style: J.mono(10)),
          ]),
          const SizedBox(width: 14),
          Expanded(child: PillButton(
            label: s.t(canRent ? 'cta' : 'ctaOff'),
            bg: canRent ? J.ink : J.line, fg: canRent ? J.cream : J.clay500,
            onTap: canRent ? () => showRequestSheet(context, p) : null,
          )),
        ]),
      ),
    );
  }

  Widget _circle(IconData i, VoidCallback f) => Pressable(
        onTap: f,
        child: Container(decoration: BoxDecoration(color: J.cream, shape: BoxShape.circle), child: Icon(i, color: J.ink)),
      );

  Widget _stat(String v, String l) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: J.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: J.line)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(v, style: J.serif(26)),
            const SizedBox(height: 2),
            Text(l, style: J.mono(9.5)),
          ]),
        ),
      );

  Widget _ownerCard(AppState s, Property p) {
    final phone = p.ownerPhone.replaceAll(RegExp(r'[^0-9+]'), '');
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: J.ink, borderRadius: BorderRadius.circular(24)),
      child: Column(children: [
        Row(children: [
          CircleAvatar(radius: 24, backgroundColor: J.gold, child: Text(p.ownerName.isNotEmpty ? p.ownerName[0] : '?', style: J.serif(20))),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(p.ownerName, style: J.sans(15, c: J.cream, w: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(s.t('owner'), style: J.mono(10, c: J.clay200)),
          ])),
        ]),
        /* WhatsApp suit le numéro que le propriétaire a déclaré, pas celui
           de son compte : ce n'est pas forcément la même puce. Sans numéro
           déclaré, pas de bouton — mieux vaut rien qu'une conversation avec
           un numéro absent de WhatsApp. */
        if (phone.isNotEmpty || numeroWhatsApp(p.ownerWhatsapp) != null) ...[
          const SizedBox(height: 14),
          Row(children: [
            if (phone.isNotEmpty)
              Expanded(child: PillButton(label: s.t('call'), height: 46, bg: Colors.transparent, border: J.clay600,
                  icon: Icon(Icons.call_rounded, size: 18, color: J.cream), onTap: () => launchUrl(Uri.parse('tel:$phone')))),
            if (phone.isNotEmpty && numeroWhatsApp(p.ownerWhatsapp) != null) const SizedBox(width: 8),
            if (numeroWhatsApp(p.ownerWhatsapp) != null)
              Expanded(child: PillButton(label: 'WhatsApp', height: 46, bg: J.leaf, fg: Colors.white,
                  onTap: () => launchUrl(
                    Uri.parse('https://wa.me/${numeroWhatsApp(p.ownerWhatsapp)}'
                        '?text=${Uri.encodeComponent('Bonjour ${p.ownerName.split(' ').first}, '
                        'je suis intéressé(e) par votre logement « ${p.title} » '
                        '(${fcfa(p.price)} FCFA/${p.pricePeriod}) vu sur JIGISO.')}'),
                    mode: LaunchMode.externalApplication))),
          ]),
        ],
      ]),
    );
  }
}

class _Pulse extends StatefulWidget {
  final Color color;
  const _Pulse({required this.color});
  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat();
  @override
  void dispose() { c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => SizedBox(
        width: 16, height: 16,
        child: AnimatedBuilder(
          animation: c,
          builder: (_, __) => Stack(alignment: Alignment.center, children: [
            Container(width: 8 + 8 * c.value, height: 8 + 8 * c.value,
                decoration: BoxDecoration(shape: BoxShape.circle, color: widget.color.withOpacity(.35 * (1 - c.value)))),
            Container(width: 8, height: 8, decoration: BoxDecoration(shape: BoxShape.circle, color: widget.color)),
          ]),
        ),
      );
}
