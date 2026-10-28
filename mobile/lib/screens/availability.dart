import 'package:flutter/material.dart';
import '../data/api.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'visits.dart' show jourVisite;

/// Disponibilités du propriétaire pour les visites : jours, horaires, durée
/// d'une visite et jours bloqués. Les locataires ne voient que les créneaux
/// libres qui en découlent.
class AvailabilityScreen extends StatefulWidget {
  const AvailabilityScreen({super.key});
  @override
  State<AvailabilityScreen> createState() => _AvailabilityScreenState();
}

class _AvailabilityScreenState extends State<AvailabilityScreen> {
  Disponibilites? d;
  String? erreur;
  bool envoi = false;

  // Lundi d'abord, comme au Mali ; valeurs du serveur : 0 = dimanche
  static const _ordre = [1, 2, 3, 4, 5, 6, 0];
  static const _lettresFr = {1: 'L', 2: 'M', 3: 'M', 4: 'J', 5: 'V', 6: 'S', 0: 'D'};
  static const _lettresEn = {1: 'M', 2: 'T', 3: 'W', 4: 'T', 5: 'F', 6: 'S', 0: 'S'};
  static const _nomsFr = {1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi', 5: 'vendredi', 6: 'samedi', 0: 'dimanche'};

  @override
  void initState() {
    super.initState();
    Api.disponibilites().then((v) { if (mounted) setState(() => d = v); })
        .catchError((e) { if (mounted) setState(() => erreur = '$e'); });
  }

  void _maj(Disponibilites n) => setState(() => d = n);
  Disponibilites _avec({Set<int>? jours, int? debut, int? fin, int? duree, List<String>? joursBloques}) => Disponibilites(
        configure: true, jours: jours ?? d!.jours, debut: debut ?? d!.debut, fin: fin ?? d!.fin,
        duree: duree ?? d!.duree, joursBloques: joursBloques ?? d!.joursBloques);

  Future<void> _ajouterJour() async {
    final s = AppScope.of(context);
    final now = DateTime.now();
    final j = await showDatePicker(context: context, locale: Locale(s.lang == 'en' ? 'en' : 'fr'),
        firstDate: DateTime(now.year, now.month, now.day), lastDate: now.add(const Duration(days: 90)));
    if (j == null) return;
    final iso = '${j.year}-${j.month.toString().padLeft(2, '0')}-${j.day.toString().padLeft(2, '0')}';
    if (!d!.joursBloques.contains(iso)) _maj(_avec(joursBloques: [...d!.joursBloques, iso]..sort()));
  }

  Future<void> _enregistrer() async {
    final m = ScaffoldMessenger.of(context);
    setState(() => envoi = true);
    try {
      m.showSnackBar(SnackBar(content: Text(await Api.majDisponibilites(d!))));
      if (mounted) Navigator.pop(context);
    } catch (e) {
      m.showSnackBar(SnackBar(content: Text('$e')));
    }
    if (mounted) setState(() => envoi = false);
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return Scaffold(
      backgroundColor: J.bg,
      appBar: AppBar(backgroundColor: J.bg, surfaceTintColor: Colors.transparent,
          title: Text(s.t('avail.t'), style: J.ui(20, w: FontWeight.w800))),
      body: erreur != null
          ? Padding(padding: const EdgeInsets.all(24), child: Text(erreur!, style: J.ui(14, c: J.terracotta)))
          : d == null
              ? Center(child: CircularProgressIndicator(color: J.gold))
              : ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 40), children: [
                  Text(s.t('avail.sub'), style: J.ui(14, c: J.clay500, h: 1.45)),
                  if (!d!.configure) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: J.x(0xFFFBF6EA), borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: J.x(0xFFE7CE97))),
                      child: Text(s.t('avail.default'), style: J.ui(13, c: J.goldDark, w: FontWeight.w600)),
                    ),
                  ],

                  const SizedBox(height: 22),
                  Text(s.t('avail.days'), style: J.mono(10)),
                  const SizedBox(height: 10),
                  Row(children: [
                    for (final j in _ordre) ...[
                      Expanded(child: Pressable(
                        onTap: () {
                          final n = {...d!.jours};
                          n.contains(j) ? n.remove(j) : n.add(j);
                          if (n.isNotEmpty) _maj(_avec(jours: n));
                        },
                        child: Semantics(button: true, selected: d!.jours.contains(j), label: _nomsFr[j], child: AnimatedContainer(
                          duration: const Duration(milliseconds: 160),
                          height: 48,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: d!.jours.contains(j) ? J.ink : Colors.transparent,
                            shape: BoxShape.circle,
                            border: Border.all(color: d!.jours.contains(j) ? J.ink : J.line, width: 1.5),
                          ),
                          child: Text((s.lang == 'en' ? _lettresEn : _lettresFr)[j]!,
                              style: J.ui(15, c: d!.jours.contains(j) ? J.cream : J.ink, w: FontWeight.w700)),
                        )),
                      )),
                      if (j != 0) const SizedBox(width: 6),
                    ],
                  ]),

                  const SizedBox(height: 22),
                  Text(s.t('avail.hours'), style: J.mono(10)),
                  const SizedBox(height: 10),
                  Row(children: [
                    Text(s.t('avail.from'), style: J.ui(15)),
                    const SizedBox(width: 10),
                    Expanded(child: _heure(d!.debut, List.generate(13, (i) => 7 + i).where((h) => h < d!.fin).toList(),
                        (h) => _maj(_avec(debut: h)))),
                    const SizedBox(width: 10),
                    Text(s.t('avail.to'), style: J.ui(15)),
                    const SizedBox(width: 10),
                    Expanded(child: _heure(d!.fin, List.generate(13, (i) => 8 + i).where((h) => h > d!.debut).toList(),
                        (h) => _maj(_avec(fin: h)))),
                  ]),

                  const SizedBox(height: 22),
                  Text(s.t('avail.duration'), style: J.mono(10)),
                  const SizedBox(height: 10),
                  SegmentedButton<int>(
                    segments: const [ButtonSegment(value: 30, label: Text('30 min')), ButtonSegment(value: 60, label: Text('1 h'))],
                    selected: {d!.duree},
                    showSelectedIcon: false,
                    onSelectionChanged: (v) => _maj(_avec(duree: v.first)),
                  ),

                  const SizedBox(height: 22),
                  Text(s.t('avail.blocked'), style: J.mono(10)),
                  const SizedBox(height: 4),
                  Text(s.t('avail.blockedSub'), style: J.ui(13, c: J.clay500)),
                  const SizedBox(height: 10),
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    for (final iso in d!.joursBloques)
                      InputChip(
                        label: Text(jourVisite(s, DateTime.parse('${iso}T00:00:00Z'))),
                        onDeleted: () => _maj(_avec(joursBloques: d!.joursBloques.where((x) => x != iso).toList())),
                      ),
                    ActionChip(avatar: const Icon(Icons.add_rounded, size: 18), label: Text(s.t('avail.addDay')), onPressed: _ajouterJour),
                  ]),

                  const SizedBox(height: 30),
                  PillButton(label: envoi ? '…' : s.t('avail.save'), onTap: envoi ? null : _enregistrer),
                ]),
    );
  }

  Widget _heure(int valeur, List<int> choix, ValueChanged<int> f) => DropdownButtonFormField<int>(
        initialValue: choix.contains(valeur) ? valeur : choix.first,
        decoration: const InputDecoration(border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
        items: [for (final h in choix) DropdownMenuItem(value: h, child: Text('$h h 00'))],
        onChanged: (v) { if (v != null) f(v); },
      );
}
