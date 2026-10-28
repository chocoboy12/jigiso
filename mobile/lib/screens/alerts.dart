import 'package:flutter/material.dart';
import '../data/api.dart';
import '../state/app_state.dart';
import '../theme.dart';

/// Mes alertes : chaque alerte envoie un e-mail dès qu'un logement publié
/// correspond (ville, type, budget). On peut la mettre en pause ou la supprimer.
/// On les crée depuis l'accueil (« Enregistrer cette recherche »).
class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});
  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  List<Map<String, dynamic>>? alertes;
  String? erreur;

  @override
  void initState() { super.initState(); _charger(); }

  Future<void> _charger() async {
    try {
      final l = await Api.alertes();
      if (mounted) setState(() { alertes = l; erreur = null; });
    } catch (e) {
      if (mounted) setState(() => erreur = '$e');
    }
  }

  String _criteres(AppState s, Map<String, dynamic> a) {
    final c = (a['criteria'] as Map?) ?? {};
    return [
      c['type'] == null ? s.t('all') : s.typeLabel('${c['type']}'),
      if (c['city'] != null) '${c['city']}',
      if (c['maxPrice'] != null) '${s.t('upTo')} ${fcfa((c['maxPrice'] as num).toInt())} FCFA',
    ].join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return Scaffold(
      backgroundColor: J.bg,
      appBar: AppBar(backgroundColor: J.bg, surfaceTintColor: Colors.transparent,
          title: Text(s.t('alerts.t'), style: J.ui(20, w: FontWeight.w800))),
      body: RefreshIndicator(
        color: J.gold,
        onRefresh: _charger,
        child: ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 40), children: [
          Text(s.t('alerts.sub'), style: J.ui(14, c: J.clay500)),
          const SizedBox(height: 16),
          if (erreur != null)
            Text(erreur!, style: J.ui(14, c: J.terracotta))
          else if (alertes == null)
            const Padding(padding: EdgeInsets.only(top: 40), child: Center(child: CircularProgressIndicator(color: J.gold)))
          else if (alertes!.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: J.line, width: 1.5)),
              child: Text(s.t('alerts.empty'), textAlign: TextAlign.center, style: J.ui(14, c: J.clay500)),
            )
          else
            for (final a in alertes!)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.fromLTRB(16, 10, 6, 10),
                decoration: BoxDecoration(color: J.card, borderRadius: BorderRadius.circular(18), border: Border.all(color: J.soft, width: 1.5)),
                child: Row(children: [
                  Icon(a['isActive'] == true ? Icons.notifications_active_outlined : Icons.notifications_paused_outlined,
                      color: a['isActive'] == true ? J.goldDeep : J.clay300),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${a['name']}', style: J.ui(15, w: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(_criteres(s, a), style: J.ui(12.5, c: J.clay500)),
                    Text(s.t(a['isActive'] == true ? 'alerts.active' : 'alerts.paused'),
                        style: J.ui(12, c: a['isActive'] == true ? J.leaf : J.clay500, w: FontWeight.w600)),
                  ])),
                  Switch(
                    value: a['isActive'] == true, activeThumbColor: J.gold,
                    onChanged: (_) async {
                      await Api.basculerAlerte('${a['_id']}').catchError((_) {});
                      _charger();
                    },
                  ),
                  IconButton(
                    tooltip: s.t('saved.remove'),
                    icon: Icon(Icons.delete_outline_rounded, color: J.terracotta),
                    onPressed: () async {
                      await Api.supprimerAlerte('${a['_id']}').catchError((_) {});
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.t('alerts.deleted'))));
                      _charger();
                    },
                  ),
                ]),
              ),
        ]),
      ),
    );
  }
}
