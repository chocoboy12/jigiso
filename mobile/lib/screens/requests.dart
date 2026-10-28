import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'visits.dart';

/// Onglet sélecteur Demandes / Visites, partagé avec l'espace propriétaire.
Widget ongletsDemandesVisites(AppState s, bool visites, ValueChanged<bool> choix) => SegmentedButton<bool>(
      segments: [
        ButtonSegment(value: false, icon: const Icon(Icons.description_outlined, size: 18), label: Text(s.t('reqs.tabReq'))),
        ButtonSegment(value: true, icon: const Icon(Icons.event_rounded, size: 18),
            label: Text(s.visitesEnAttente > 0 ? '${s.t('reqs.tabVis')} (${s.visitesEnAttente})' : s.t('reqs.tabVis'))),
      ],
      selected: {visites},
      showSelectedIcon: false,
      onSelectionChanged: (v) => choix(v.first),
    );

class RequestsScreen extends StatefulWidget {
  const RequestsScreen({super.key});
  @override
  State<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends State<RequestsScreen> {
  bool visites = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Arrivée depuis le bandeau « Prochaine visite » de l'accueil
    final s = AppScope.of(context);
    if (s.ouvrirVisites) { s.ouvrirVisites = false; visites = true; }
  }

  static final _status = {
    'pending': (J.x(0xFFF3E6C8), J.goldDark),
    'accepted': (J.leaf, Colors.white),
    'rejected': (J.terracotta, Colors.white),
    'cancelled': (J.line, J.clay600),
  };

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return SafeArea(
      bottom: false,
      child: ListView(padding: const EdgeInsets.fromLTRB(20, 24, 20, 120), children: [
        Entrance(child: Text(s.t('reqs.t'), style: J.serif(34))),
        const SizedBox(height: 14),
        ongletsDemandesVisites(s, visites, (v) => setState(() => visites = v)),
        const SizedBox(height: 18),
        if (visites) const VisitsList()
        else if (s.requests.isEmpty)
          Entrance(delayMs: 100, child: Container(
            padding: const EdgeInsets.all(36),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(24), border: Border.all(color: J.line, width: 1.5)),
            child: Text(s.t('reqs.empty'), textAlign: TextAlign.center, style: J.sans(14, c: J.clay500)),
          )),
        if (!visites) for (var i = 0; i < s.requests.length; i++)
          Builder(builder: (_) {
            final r = s.requests[i];
            final st = _status[r.status]!;
            return Entrance(
              delayMs: 60 * i,
              child: Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: J.card, borderRadius: BorderRadius.circular(16), boxShadow: J.cardShadow),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(r.property.title, style: J.serif(17, h: 1.2)),
                      const SizedBox(height: 3),
                      Text('${r.property.ownerName} · ${r.property.neighborhood}', style: J.sans(13, c: J.clay500)),
                    ])),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
                      decoration: BoxDecoration(color: st.$1, borderRadius: BorderRadius.circular(999)),
                      child: Text(s.t('st.${r.status}'), style: J.mono(9.5, c: st.$2)),
                    ),
                  ]),
                  Padding(padding: EdgeInsets.symmetric(vertical: 10), child: Divider(height: 1, color: J.x(0xFFEAE3D4))),
                  Row(children: [
                    Text('${s.t('moveIn')} : ', style: J.sans(13, c: J.clay600)),
                    Text('${r.moveIn.day}/${r.moveIn.month}/${r.moveIn.year}', style: J.sans(13, w: FontWeight.w700)),
                    const SizedBox(width: 16),
                    Text('${s.t('duration')} : ', style: J.sans(13, c: J.clay600)),
                    Text(r.duration, style: J.sans(13, w: FontWeight.w700)),
                  ]),
                ]),
              ),
            );
          }),
      ]),
    );
  }
}
