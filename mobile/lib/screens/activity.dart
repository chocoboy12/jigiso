import 'package:flutter/material.dart';
import '../data/api.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'detail.dart';

/// Activité du compte : demandes, visites, favoris, alertes, annonces et
/// connexions, la plus récente en haut. Une connexion échouée ou un compte
/// bloqué ressortent en rouge : c'est le signe d'un accès qui n'était peut-être pas vous.
class ActivityScreen extends StatefulWidget {
  const ActivityScreen({super.key});
  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  List<Map<String, dynamic>>? items;
  String? erreur;

  static const _icones = {
    'demande': Icons.description_outlined,
    'visite': Icons.event_rounded,
    'favori': Icons.favorite_border_rounded,
    'alerte': Icons.notifications_none_rounded,
    'avis': Icons.star_border_rounded,
    'signalement': Icons.flag_outlined,
    'annonce': Icons.home_work_outlined,
    'securite': Icons.shield_outlined,
  };

  @override
  void initState() { super.initState(); _charger(); }

  Future<void> _charger() async {
    try {
      final l = await Api.activite();
      if (mounted) setState(() { items = l; erreur = null; });
    } catch (e) {
      if (mounted) setState(() => erreur = '$e');
    }
  }

  String _quand(DateTime d) {
    final l = d.toLocal();
    String z(int n) => n.toString().padLeft(2, '0');
    return '${z(l.day)}/${z(l.month)}/${l.year} · ${z(l.hour)}:${z(l.minute)}';
  }

  Future<void> _ouvrir(String id) async {
    final nav = Navigator.of(context);
    final m = ScaffoldMessenger.of(context);
    try {
      nav.push(detailRoute(await Api.property(id)));
    } catch (e) {
      m.showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return Scaffold(
      backgroundColor: J.bg,
      appBar: AppBar(backgroundColor: J.bg, surfaceTintColor: Colors.transparent,
          title: Text(s.t('act.t'), style: J.ui(20, w: FontWeight.w800))),
      body: RefreshIndicator(
        color: J.gold,
        onRefresh: _charger,
        child: ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 40), children: [
          Text(s.t('act.sub'), style: J.ui(14, c: J.clay500)),
          const SizedBox(height: 16),
          if (erreur != null)
            Text(erreur!, style: J.ui(14, c: J.terracotta))
          else if (items == null)
            const Padding(padding: EdgeInsets.only(top: 40), child: Center(child: CircularProgressIndicator(color: J.gold)))
          else if (items!.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: J.line, width: 1.5)),
              child: Text(s.t('act.empty'), textAlign: TextAlign.center, style: J.ui(14, c: J.clay500)),
            )
          else
            for (var i = 0; i < items!.length; i++) _ligne(s, items![i], derniere: i == items!.length - 1),
        ]),
      ),
    );
  }

  /// Une ligne de frise : pastille + trait vertical, texte à droite.
  Widget _ligne(AppState s, Map<String, dynamic> a, {required bool derniere}) {
    final alerte = a['alerte'] == true;
    final couleur = alerte ? J.terracotta : J.ink;
    final date = DateTime.tryParse('${a['date']}');
    final id = a['propertyId'] as String?;
    return IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Column(children: [
        Container(
          width: 36, height: 36,
          decoration: BoxDecoration(shape: BoxShape.circle,
              color: alerte ? J.terracotta.withValues(alpha: .12) : J.card, border: Border.all(color: alerte ? J.terracotta : J.line)),
          child: Icon(_icones[a['kind']] ?? Icons.circle_outlined, size: 18, color: couleur),
        ),
        if (!derniere) Expanded(child: Container(width: 1.5, color: J.line)),
      ]),
      const SizedBox(width: 12),
      Expanded(child: Pressable(
        onTap: id == null ? null : () => _ouvrir(id),
        child: Padding(
          padding: const EdgeInsets.only(bottom: 18, top: 6),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${a['title'] ?? ''}', style: J.ui(14.5, c: couleur, w: FontWeight.w700)),
            if (a['detail'] != null) Text('${a['detail']}', style: J.ui(13, c: J.clay600)),
            if (date != null) Text(_quand(date), style: J.ui(12, c: J.clay500)),
            if (alerte) Padding(padding: const EdgeInsets.only(top: 4),
                child: Text(s.t('act.alert'), style: J.ui(12.5, c: J.terracotta, w: FontWeight.w600))),
          ]),
        ),
      )),
    ]));
  }
}
