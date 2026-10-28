import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../data/api.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme.dart';

/* Les visites sont en heure de Bamako (UTC) : on formate les DateTime UTC
   tels quels, sans conversion vers le fuseau du téléphone. */
const _moisFr = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const _moisEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _joursFr = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const _joursEn = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

String jourVisite(AppState s, DateTime d) => s.lang == 'en'
    ? '${_joursEn[d.weekday - 1]} ${_moisEn[d.month - 1]} ${d.day}'
    : '${_joursFr[d.weekday - 1]} ${d.day} ${_moisFr[d.month - 1]}';
String heureVisite(DateTime d) => '${d.hour.toString().padLeft(2, '0')} h ${d.minute.toString().padLeft(2, '0')}';
String quandVisite(AppState s, DateTime d) => '${jourVisite(s, d)} · ${heureVisite(d)}';

/// Choisir un créneau libre chez le propriétaire de [propertyId].
/// Renvoie l'horaire (UTC = heure de Bamako) et, si [avecNote], un mot.
Future<({DateTime date, String note})?> choisirCreneau(BuildContext context, {
  required String propertyId, required String titre, required String bouton, String? visitId, bool avecNote = false,
}) => showModalBottomSheet<({DateTime date, String note})>(
      context: context,
      isScrollControlled: true,
      backgroundColor: J.cream,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (_) => _Creneaux(propertyId: propertyId, titre: titre, bouton: bouton, visitId: visitId, avecNote: avecNote),
    );

class _Creneaux extends StatefulWidget {
  final String propertyId, titre, bouton;
  final String? visitId;
  final bool avecNote;
  const _Creneaux({required this.propertyId, required this.titre, required this.bouton, this.visitId, required this.avecNote});
  @override
  State<_Creneaux> createState() => _CreneauxState();
}

class _CreneauxState extends State<_Creneaux> {
  static const _nbJours = 14;
  int page = 0;                       // par tranches de deux semaines, jusqu'à ~3 mois
  List<(DateTime, List<DateTime>)>? jours;
  int duree = 60;
  String? erreur;
  int? jourChoisi;
  DateTime? choisi;
  final note = TextEditingController();

  @override
  void initState() { super.initState(); _charger(); }
  @override
  void dispose() { note.dispose(); super.dispose(); }

  Future<void> _charger() async {
    setState(() { jours = null; erreur = null; jourChoisi = null; choisi = null; });
    try {
      final r = await Api.creneaux(widget.propertyId,
          depuis: DateTime.now().toUtc().add(Duration(days: page * _nbJours)), jours: _nbJours, visitId: widget.visitId);
      if (!mounted) return;
      setState(() {
        jours = r.jours; duree = r.duree;
        final premier = r.jours.indexWhere((j) => j.$2.isNotEmpty);
        jourChoisi = premier < 0 ? null : premier;
      });
    } catch (e) {
      if (mounted) setState(() => erreur = '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final creneaux = jourChoisi == null ? const <DateTime>[] : jours![jourChoisi!].$2;
    final aucun = jours != null && jours!.every((j) => j.$2.isEmpty);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(widget.titre, style: J.ui(21, w: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(s.t('visit.slotsSub').replaceAll('{d}', '$duree'), style: J.ui(13, c: J.clay500)),
          const SizedBox(height: 14),
          if (erreur != null)
            Text(erreur!, style: J.ui(14, c: J.terracotta))
          else if (jours == null)
            Padding(padding: const EdgeInsets.all(30), child: Center(child: CircularProgressIndicator(color: J.gold)))
          else ...[
            // Jours : lettre du jour, numéro, nombre de créneaux libres
            SizedBox(
              height: 86,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: jours!.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final (d, l) = jours![i];
                  final on = i == jourChoisi;
                  final vide = l.isEmpty;
                  return Pressable(
                    onTap: vide ? null : () { HapticFeedback.selectionClick(); setState(() { jourChoisi = i; choisi = null; }); },
                    child: Semantics(button: true, selected: on, label: '${jourVisite(s, d)}, ${l.length}', child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      width: 62,
                      decoration: BoxDecoration(
                        color: on ? J.ink : vide ? Colors.transparent : J.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: on ? J.ink : J.line, width: 1.5),
                      ),
                      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Text((s.lang == 'en' ? _joursEn : _joursFr)[d.weekday - 1].substring(0, 3).toUpperCase(),
                            style: J.mono(9.5, c: on ? J.cream : J.clay500)),
                        const SizedBox(height: 2),
                        Text('${d.day}', style: J.ui(20, c: on ? J.cream : vide ? J.clay300 : J.ink, w: FontWeight.w800)),
                        Text(vide ? '—' : '${l.length}', style: J.ui(11, c: on ? J.gold : vide ? J.clay300 : J.leaf, w: FontWeight.w700)),
                      ]),
                    )),
                  );
                },
              ),
            ),
            const SizedBox(height: 6),
            Row(children: [
              if (page > 0) TextButton.icon(onPressed: () { page--; _charger(); },
                  icon: const Icon(Icons.chevron_left_rounded), label: Text(s.t('visit.prev'))),
              const Spacer(),
              if (page < 5) TextButton.icon(onPressed: () { page++; _charger(); },
                  icon: const Icon(Icons.chevron_right_rounded), label: Text(s.t('visit.next'))),
            ]),
            if (aucun)
              Padding(padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(s.t('visit.noSlots'), textAlign: TextAlign.center, style: J.ui(14, c: J.clay500)))
            else if (jourChoisi != null) ...[
              Text(jourVisite(s, jours![jourChoisi!].$1).toUpperCase(), style: J.mono(10)),
              const SizedBox(height: 10),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final c in creneaux)
                  Pressable(
                    onTap: () { HapticFeedback.selectionClick(); setState(() => choisi = c); },
                    child: Semantics(button: true, selected: choisi == c, child: AnimatedContainer(
                      duration: const Duration(milliseconds: 160),
                      width: 92, height: 46,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: choisi == c ? J.gold : J.card,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: choisi == c ? J.gold : J.line, width: 1.5),
                      ),
                      child: Text(heureVisite(c), style: J.ui(15, c: choisi == c ? J.night : J.ink, w: FontWeight.w700)),
                    )),
                  ),
              ]),
            ],
          ],
          if (widget.avecNote) ...[
            const SizedBox(height: 16),
            TextField(controller: note, maxLines: 2, maxLength: 300,
                decoration: InputDecoration(hintText: s.t('visit.note'), border: const OutlineInputBorder())),
          ],
          const SizedBox(height: 12),
          PillButton(
            label: choisi == null ? s.t('visit.pick') : '${widget.bouton} · ${heureVisite(choisi!)}',
            bg: choisi == null ? J.line : J.ink, fg: choisi == null ? J.clay500 : J.cream,
            onTap: choisi == null ? null : () => Navigator.pop(context, (date: choisi!, note: note.text.trim())),
          ),
        ]),
      )),
    );
  }
}

/// Demander une visite depuis une annonce : créneau libre + mot facultatif.
Future<void> planifierVisite(BuildContext context, Property p) async {
  final s = AppScope.of(context);
  final m = ScaffoldMessenger.of(context);
  if (s.user == null) {
    m.showSnackBar(SnackBar(content: Text(s.t('visit.login'))));
    return;
  }
  final r = await choisirCreneau(context, propertyId: p.id, titre: s.t('visit.plan'), bouton: s.t('visit.send'), avecNote: true);
  if (r == null) return;
  try {
    await Api.proposerVisite(p.id, r.date, r.note);
    m.showSnackBar(SnackBar(content: Text(s.t('visit.sentOk'))));
    s.chargerVisites();
  } catch (e) {
    m.showSnackBar(SnackBar(content: Text('$e')));
  }
}

/// Agenda des visites, par jour : à venir d'abord, puis passées / clôturées.
class VisitsList extends StatefulWidget {
  const VisitsList({super.key});
  @override
  State<VisitsList> createState() => _VisitsListState();
}

class _VisitsListState extends State<VisitsList> {
  String? enCours;   // visite dont une action est en cours d'envoi

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) { if (mounted) AppScope.of(context).chargerVisites(); });
  }

  Future<void> _agir(AppState s, Visite v, String action, {DateTime? date}) async {
    setState(() => enCours = v.id);
    try {
      await Api.majVisite(v.id, action, date: date);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.t('visit.done'))));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
    await s.chargerVisites();
    if (mounted) setState(() => enCours = null);
  }

  /// Choisir un autre horaire : contre-proposition (propriétaire) ou déplacement (locataire)
  Future<void> _autreHoraire(AppState s, Visite v) async {
    final proprio = v.role == 'proprietaire';
    final r = await choisirCreneau(context,
        propertyId: v.property?.id ?? '', visitId: v.id,
        titre: s.t(proprio ? 'visit.otherTime' : 'visit.moveT'),
        bouton: s.t(proprio ? 'visit.sendAlt' : 'visit.moveSend'));
    if (r != null && mounted) await _agir(s, v, proprio ? 'proposer' : 'deplacer', date: r.date);
  }

  Future<void> _annuler(AppState s, Visite v) async {
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
      title: Text(s.t('visit.cancelQ'), style: J.ui(18, w: FontWeight.w800)),
      content: Text(s.t('visit.cancelSub'), style: J.ui(14, c: J.clay600)),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: Text(s.t('visit.keep'))),
        TextButton(onPressed: () => Navigator.pop(c, true), child: Text(s.t('visit.cancel'), style: TextStyle(color: J.terracotta))),
      ],
    ));
    if (ok == true && mounted) await _agir(s, v, 'annuler');
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    if (s.user == null) return _vide(s.t('visit.login'));
    if (s.erreurVisites != null && s.visites.isEmpty) return _vide(s.erreurVisites!);
    if (!s.visitesChargees) return Padding(padding: const EdgeInsets.only(top: 40), child: Center(child: CircularProgressIndicator(color: J.gold)));
    if (s.visites.isEmpty) return _vide(s.t('visit.empty'));

    final aVenir = s.visites.where((v) => v.aVenir && v.active).toList()..sort((a, b) => a.quand.compareTo(b.quand));
    final autres = s.visites.where((v) => !(v.aVenir && v.active)).toList()..sort((a, b) => b.quand.compareTo(a.quand));

    List<Widget> parJour(List<Visite> l) {
      final out = <Widget>[];
      String? courant;
      for (final v in l) {
        final j = jourVisite(s, v.quand);
        if (j != courant) {
          courant = j;
          out.add(Padding(padding: const EdgeInsets.only(top: 14, bottom: 8),
              child: Text(j[0].toUpperCase() + j.substring(1), style: J.ui(15, w: FontWeight.w800))));
        }
        out.add(_carte(s, v));
      }
      return out;
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (aVenir.any((v) => v.statut == 'confirmee'))
        Row(children: [
          Icon(Icons.notifications_active_outlined, size: 16, color: J.clay500),
          const SizedBox(width: 6),
          Expanded(child: Text(s.t('visit.reminders'), style: J.ui(12.5, c: J.clay500))),
        ]),
      if (aVenir.isNotEmpty) ...[const SizedBox(height: 10), Text(s.t('visit.upcoming'), style: J.mono(10)), ...parJour(aVenir)],
      if (autres.isNotEmpty) ...[const SizedBox(height: 18), Text(s.t('visit.past'), style: J.mono(10)), ...parJour(autres)],
    ]);
  }

  Widget _vide(String texte) => Container(
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(24), border: Border.all(color: J.line, width: 1.5)),
        child: Text(texte, textAlign: TextAlign.center, style: J.ui(14, c: J.clay500)),
      );

  Widget _carte(AppState s, Visite v) {
    final couleurs = {
      'proposee': (J.x(0xFFF3E6C8), J.goldDark),
      'contreproposee': (J.x(0xFFE6EFF4), J.river),
      'confirmee': (J.leaf, Colors.white),
      'refusee': (J.terracotta, Colors.white),
      'annulee': (J.line, J.clay600),
    }[v.statut] ?? (J.line, J.clay600);
    final aVenir = v.aVenir && v.active;
    final proprio = v.role == 'proprietaire';
    final occupe = enCours == v.id;
    final contre = v.statut == 'contreproposee' && v.dateAlternative != null;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: J.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: J.soft, width: 1.5)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(heureVisite(v.quand), style: J.ui(18, w: FontWeight.w800)),
          const SizedBox(width: 10),
          Expanded(child: Text(v.property?.title ?? '—', maxLines: 1, overflow: TextOverflow.ellipsis, style: J.ui(14, w: FontWeight.w700))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
            decoration: BoxDecoration(color: couleurs.$1, borderRadius: BorderRadius.circular(999)),
            child: Text(s.t('st.${v.statut}'), style: J.mono(9.5, c: couleurs.$2)),
          ),
        ]),
        const SizedBox(height: 4),
        Text([
          if (v.property != null) '${v.property!.neighborhood}, ${v.property!.city}',
          if (v.autreNom.isNotEmpty) '${s.t('visit.with')} ${v.autreNom}',
          if (v.statut == 'annulee' && v.annuleePar.isNotEmpty) s.t(v.annuleePar == 'proprietaire' ? 'visit.byOwner' : 'visit.byTenant'),
        ].join(' · '), style: J.ui(12.5, c: J.clay500)),
        // Autre horaire proposé : ce qui est en jeu, et ce qu'il remplace
        if (contre && aVenir) Container(
          margin: const EdgeInsets.only(top: 10),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: J.x(0xFFE6EFF4), borderRadius: BorderRadius.circular(12)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(s.t(proprio ? 'visit.altWaiting' : 'visit.altFromOwner'), style: J.ui(12.5, c: J.river, w: FontWeight.w600)),
            const SizedBox(height: 2),
            Text(quandVisite(s, v.dateAlternative!), style: J.ui(15, w: FontWeight.w800)),
            Text('${s.t('visit.instead')} ${quandVisite(s, v.date)}', style: J.ui(12, c: J.clay500)),
          ]),
        ),
        if (v.note.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6),
            child: Text('« ${v.note} »', style: J.ui(13, c: J.clay600))),
        if (v.reponse.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4),
            child: Text('« ${v.reponse} »', style: J.ui(13, c: J.clay600))),
        if (aVenir) ...[
          const SizedBox(height: 10),
          if (occupe)
            Padding(padding: const EdgeInsets.all(8), child: SizedBox(width: 20, height: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: J.gold)))
          else
            Wrap(spacing: 8, runSpacing: 8, children: [
              // Propriétaire
              if (proprio && v.statut == 'proposee') ...[
                FilledButton(onPressed: () => _agir(s, v, 'confirmer'), style: FilledButton.styleFrom(backgroundColor: J.leaf, foregroundColor: Colors.white),
                    child: Text(s.t('visit.confirm'))),
                OutlinedButton(onPressed: () => _autreHoraire(s, v), child: Text(s.t('visit.otherTime'))),
                OutlinedButton(onPressed: () => _agir(s, v, 'refuser'), child: Text(s.t('visit.refuse'))),
              ],
              if (proprio && v.statut == 'confirmee')
                OutlinedButton(onPressed: () => _autreHoraire(s, v), child: Text(s.t('visit.otherTime'))),
              // Locataire
              if (!proprio && contre)
                FilledButton(onPressed: () => _agir(s, v, 'accepter'), style: FilledButton.styleFrom(backgroundColor: J.leaf, foregroundColor: Colors.white),
                    child: Text(s.t('visit.accept'))),
              if (!proprio)
                OutlinedButton.icon(onPressed: () => _autreHoraire(s, v),
                    icon: const Icon(Icons.edit_calendar_outlined, size: 18), label: Text(s.t('visit.move'))),
              // Les deux
              if (v.autreTel.isNotEmpty && v.statut == 'confirmee')
                OutlinedButton.icon(
                  onPressed: () => launchUrl(Uri.parse('tel:${v.autreTel.replaceAll(RegExp(r'[^0-9+]'), '')}')),
                  icon: const Icon(Icons.call_outlined, size: 18), label: Text(s.t('call')),
                ),
              TextButton(onPressed: () => _annuler(s, v),
                  child: Text(s.t('visit.cancel'), style: TextStyle(color: J.terracotta))),
            ]),
        ],
      ]),
    );
  }
}

/// Bandeau « Prochaine visite » et visites qui attendent une réponse.
/// Rien à afficher : rien du tout.
class BandeauVisites extends StatelessWidget {
  final VoidCallback onTap;
  const BandeauVisites({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final v = s.prochaineVisite;
    final attente = s.visitesEnAttente;
    if (v == null && attente == 0) return const SizedBox.shrink();
    return Pressable(
      onTap: () { s.ouvrirVisites = true; onTap(); },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: J.card, borderRadius: BorderRadius.circular(18), border: Border.all(color: J.soft, width: 1.5)),
        child: Row(children: [
          Container(
            width: 46, height: 46,
            decoration: BoxDecoration(color: v != null ? J.leaf : J.gold, borderRadius: BorderRadius.circular(14)),
            child: Icon(v != null ? Icons.event_available_rounded : Icons.pending_actions_rounded, color: Colors.white),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (v != null) ...[
              Text(s.t('visit.next7').toUpperCase(), style: J.mono(9.5, c: J.leaf)),
              const SizedBox(height: 2),
              Text(quandVisite(s, v.date), style: J.ui(15, w: FontWeight.w800)),
              Text([v.property?.title, if (v.autreNom.isNotEmpty) '${s.t('visit.with')} ${v.autreNom}'].whereType<String>().join(' · '),
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: J.ui(12.5, c: J.clay500)),
            ],
            if (attente > 0) Padding(
              padding: EdgeInsets.only(top: v != null ? 4 : 0),
              child: Text(s.t('visit.toAnswer').replaceAll('{n}', '$attente'),
                  style: J.ui(13, c: J.goldDeep, w: FontWeight.w700)),
            ),
          ])),
          Icon(Icons.chevron_right_rounded, color: J.clay500),
        ]),
      ),
    );
  }
}
