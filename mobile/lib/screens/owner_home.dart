import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../data/api.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/property_card.dart' show PropertyPhoto;
import 'add_property.dart';
import 'profile.dart';
import 'shell.dart';
import 'verification.dart';

/// Espace propriétaire — séparé de l'espace locataire (accent vert, navigation propre).
/// Toutes les données viennent de l'API : aucune donnée inventée.
class OwnerShell extends StatefulWidget {
  const OwnerShell({super.key});
  @override
  State<OwnerShell> createState() => _OwnerShellState();
}

class _OwnerShellState extends State<OwnerShell> {
  int tab = 0;
  final data = OwnerData();

  @override
  void initState() { super.initState(); data.load(); }

  Future<void> _publish() async {
    final ok = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => const AddPropertyScreen()));
    if (ok == true) { data.load(); } else { data.checkDraft(); }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: data,
        builder: (_, __) => Scaffold(
          backgroundColor: const Color(0xFFF4F7F5),
          extendBody: true,
          body: AnimatedSwitcher(
            duration: const Duration(milliseconds: 250),
            child: KeyedSubtree(key: ValueKey(tab), child: switch (tab) {
              0 => OwnerDashboard(data: data, onPublish: _publish, onTab: (i) => setState(() => tab = i)),
              1 => OwnerListings(data: data, onPublish: _publish),
              2 => OwnerRequests(data: data),
              _ => const ProfileScreen(),
            }),
          ),
          bottomNavigationBar: KitNavBar(
            index: tab,
            onTap: (i) => setState(() => tab = i),
            items: const [(Icons.dashboard_rounded, 'Tableau'), (Icons.holiday_village_outlined, 'Annonces'), (Icons.inbox_outlined, 'Demandes'), (Icons.person_outline_rounded, 'Profil')],
            badges: [0, 0, data.pending, 0],
            accent: J.leaf,
            fabIcon: Icons.add_rounded, fabBg: J.leaf, fabFg: Colors.white,
            onFab: _publish,
          ),
        ),
      );
}

class OwnerData extends ChangeNotifier {
  bool loading = true;
  String? error;
  List<Property> listings = [];
  List<Map<String, dynamic>> requests = [];
  Map<String, dynamic> stats = {};
  Map<String, dynamic>? verification;
  /// Une annonce commencée et pas encore envoyée (brouillon local).
  bool draft = false;

  Future<void> checkDraft() async { draft = await AddPropertyScreen.hasDraft(); notifyListeners(); }

  int get pending => requests.where((r) => r['status'] == 'pending').length;

  Future<void> load() async {
    loading = true; error = null; notifyListeners();
    checkDraft();
    try {
      final r = await Future.wait([Api.myProperties(), Api.rentalRequests(), Api.ownerStats().catchError((_) => <String, dynamic>{}), Api.verificationStatus().catchError((_) => <String, dynamic>{})]);
      listings = r[0] as List<Property>;
      requests = r[1] as List<Map<String, dynamic>>;
      stats = r[2] as Map<String, dynamic>;
      verification = r[3] as Map<String, dynamic>;
    } catch (e) {
      error = 'Impossible de joindre le serveur.';
    }
    loading = false; notifyListeners();
  }

  Future<void> decide(String id, bool accept) async {
    await Api.updateRequest(id, accept ? 'accepted' : 'rejected');
    final i = requests.indexWhere((r) => '${r['_id']}' == id);
    if (i >= 0) requests[i] = {...requests[i], 'status': accept ? 'accepted' : 'rejected'};
    notifyListeners();
  }
}

class OwnerDashboard extends StatelessWidget {
  final OwnerData data;
  final VoidCallback onPublish;
  final ValueChanged<int> onTab;
  const OwnerDashboard({super.key, required this.data, required this.onPublish, required this.onTab});

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final verified = data.verification?['verified'] == true || (data.verification?['missing'] as List?)?.isEmpty == true;
    final views = data.listings.fold<int>(0, (a, p) => a + p.views);
    return RefreshIndicator(
      color: J.leaf,
      onRefresh: data.load,
      child: ListView(padding: EdgeInsets.zero, children: [
        Container(
          padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 14, 20, 22),
          decoration: const BoxDecoration(color: Color(0xFF123F25), borderRadius: BorderRadius.vertical(bottom: Radius.circular(28))),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              CircleAvatar(radius: 23, backgroundColor: Colors.white.withOpacity(.12), child: Text(initials(s.user?.name ?? ''), style: J.ui(16, c: Colors.white, w: FontWeight.w700))),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Espace propriétaire', style: J.ui(12, c: const Color(0xFFA8C9B4))),
                Text('Bonjour ${(s.user?.name ?? '').split(' ').first}', style: J.ui(18, c: Colors.white, w: FontWeight.w800)),
              ])),
            ]),
            const SizedBox(height: 18),
            Row(children: [
              _stat('${data.listings.length}', 'Annonces'), const SizedBox(width: 8),
              _stat(fcfa(views), 'Vues'), const SizedBox(width: 8),
              _stat('${data.pending}', 'Demandes'),
            ]),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 130),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (data.error != null) _errorBox(data.error!, data.load),
            if (data.draft) ...[
              Pressable(
                onTap: onPublish,
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: const Color(0xFFFBF6EA), borderRadius: BorderRadius.circular(20), border: Border.all(color: J.gold, width: 1.5)),
                  child: Row(children: [
                    Container(width: 44, height: 44, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                        child: const Icon(Icons.edit_note_rounded, color: J.gold)),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Annonce en cours', style: J.ui(15, w: FontWeight.w800)),
                      Text('Reprenez là où vous vous êtes arrêté', style: J.ui(12, c: J.clay500)),
                    ])),
                    Text('Reprendre', style: J.ui(14, c: J.gold, w: FontWeight.w800)),
                    const Icon(Icons.chevron_right_rounded, color: J.gold),
                  ]),
                ),
              ),
              const SizedBox(height: 14),
            ],
            if (!verified && !data.loading) ...[
              Pressable(
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const VerificationScreen())),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: const Color(0xFFFBF6EA), borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE7CE97), width: 1.5)),
                  child: Row(children: [
                    Container(width: 44, height: 44, decoration: BoxDecoration(color: J.gold, borderRadius: BorderRadius.circular(14)), child: const Icon(Icons.verified_user_outlined, color: J.ink)),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Vérifiez votre compte', style: J.ui(14, w: FontWeight.w700)),
                      Text('Photo + CNI, carte NINA ou passeport', style: J.ui(12, c: J.goldDark)),
                    ])),
                    const Icon(Icons.chevron_right_rounded, color: J.goldDeep),
                  ]),
                ),
              ),
              const SizedBox(height: 14),
            ],
            if (data.loading)
              const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator(color: J.leaf)))
            else if (data.listings.isEmpty)
              _firstListing(onPublish)
            else ...[
              _head('Mes annonces', 'Tout voir', () => onTab(1)),
              for (final p in data.listings.take(3)) ListingRow(p),
            ],
            const SizedBox(height: 18),
            _head('Demandes reçues', data.requests.isEmpty ? null : 'Tout voir', () => onTab(2)),
            if (!data.loading && data.requests.isEmpty)
              const EmptyBox(icon: Icons.inbox_outlined, title: 'Aucune demande pour l\'instant', body: 'Les demandes des locataires arriveront ici.')
            else
              for (final r in data.requests.where((r) => r['status'] == 'pending').take(3)) RequestCard(r, data: data),
          ]),
        ),
      ]),
    );
  }

  Widget _stat(String v, String l) => Expanded(child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Colors.white.withOpacity(.1), borderRadius: BorderRadius.circular(14)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(v, style: J.ui(20, c: Colors.white, w: FontWeight.w800)),
          Text(l, style: J.ui(11, c: const Color(0xFFA8C9B4))),
        ]),
      ));

  Widget _firstListing(VoidCallback f) => Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), boxShadow: J.softShadow),
        child: Column(children: [
          Container(width: 64, height: 64, decoration: BoxDecoration(color: const Color(0xFFE6F0EA), borderRadius: BorderRadius.circular(20)), child: const Icon(Icons.add_home_outlined, size: 32, color: J.leaf)),
          const SizedBox(height: 12),
          Text('Publiez votre premier logement', style: J.ui(18, w: FontWeight.w800)),
          const SizedBox(height: 6),
          Text('Ajoutez des photos, la localisation et le loyer. L\'équipe Jigiso valide l\'annonce avant sa mise en ligne.', textAlign: TextAlign.center, style: J.ui(13, c: J.clay500, w: FontWeight.w400, h: 1.5)),
          const SizedBox(height: 14),
          Pressable(onTap: f, child: Container(
            height: 48, padding: const EdgeInsets.symmetric(horizontal: 20),
            decoration: BoxDecoration(color: J.leaf, borderRadius: BorderRadius.circular(16)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.add_a_photo_outlined, color: Colors.white, size: 20), const SizedBox(width: 6), Text('Publier un logement', style: J.ui(14, c: Colors.white, w: FontWeight.w700))]),
          )),
        ]),
      );
}

Widget _head(String t, String? more, VoidCallback f) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(children: [
        Text(t, style: J.ui(18, w: FontWeight.w800)),
        const Spacer(),
        if (more != null) GestureDetector(onTap: f, child: Text(more, style: J.ui(13, c: J.leaf, w: FontWeight.w600))),
      ]),
    );

Widget _errorBox(String msg, VoidCallback retry) => Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: const Color(0xFFF9E9E2), borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        const Icon(Icons.wifi_off_rounded, color: J.terracotta),
        const SizedBox(width: 10),
        Expanded(child: Text(msg, style: J.ui(13, c: J.terracotta, w: FontWeight.w600))),
        TextButton(onPressed: retry, child: Text('Réessayer', style: J.ui(13, c: J.terracotta, w: FontWeight.w700))),
      ]),
    );

class EmptyBox extends StatelessWidget {
  final IconData icon;
  final String title, body;
  const EmptyBox({super.key, required this.icon, required this.title, required this.body});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(26),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFE1D8C8), width: 1.5)),
        child: Column(children: [
          Container(width: 56, height: 56, decoration: BoxDecoration(color: const Color(0xFFF5F1E8), borderRadius: BorderRadius.circular(18)), child: Icon(icon, color: J.clay300, size: 28)),
          const SizedBox(height: 10),
          Text(title, textAlign: TextAlign.center, style: J.ui(16, w: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(body, textAlign: TextAlign.center, style: J.ui(13, c: J.clay500, w: FontWeight.w400, h: 1.5)),
        ]),
      );
}

class ListingRow extends StatelessWidget {
  final Property p;
  const ListingRow(this.p, {super.key});
  @override
  Widget build(BuildContext context) {
    final st = {'approved': ('En ligne', const Color(0xFFEAF3ED), J.leaf), 'pending': ('En validation', const Color(0xFFFBF6EA), J.goldDeep),
      'rejected': ('Refusée', const Color(0xFFF9E9E2), J.terracotta), 'rented': ('Louée', const Color(0xFFE6EFF4), J.river)}[p.status] ?? ('—', J.soft, J.clay500);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: J.softShadow),
      child: Row(children: [
        ClipRRect(borderRadius: BorderRadius.circular(14), child: SizedBox(width: 70, height: 70, child: PropertyPhoto(p))),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(p.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: J.ui(15, w: FontWeight.w700)),
          const SizedBox(height: 3),
          Text('${p.neighborhood}, ${p.city} · ${fcfa(p.price)} FCFA', maxLines: 1, overflow: TextOverflow.ellipsis, style: J.ui(12, c: J.clay500)),
          const SizedBox(height: 3),
          Row(children: [const Icon(Icons.visibility_outlined, size: 14, color: J.clay300), const SizedBox(width: 4), Text('${p.views} vues', style: J.ui(12, c: J.clay300))]),
        ])),
        Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5), decoration: BoxDecoration(color: st.$2, borderRadius: BorderRadius.circular(999)),
            child: Text(st.$1, style: J.ui(11, c: st.$3, w: FontWeight.w700))),
        const SizedBox(width: 6),
      ]),
    );
  }
}

class RequestCard extends StatefulWidget {
  final Map<String, dynamic> r;
  final OwnerData data;
  const RequestCard(this.r, {super.key, required this.data});
  @override
  State<RequestCard> createState() => _RequestCardState();
}

class _RequestCardState extends State<RequestCard> {
  bool busy = false;
  @override
  Widget build(BuildContext context) {
    final r = widget.r;
    final tenant = (r['tenant'] is Map ? r['tenant']['name'] : null) ?? 'Locataire';
    final prop = r['property'] is Map ? r['property']['title'] ?? '' : '';
    final st = r['status'] ?? 'pending';
    final moveIn = DateTime.tryParse('${r['moveInDate']}');
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: J.softShadow),
      child: Column(children: [
        Row(children: [
          CircleAvatar(radius: 21, backgroundColor: const Color(0xFFE6F0EA), child: Text(initials(tenant), style: J.ui(14, c: J.leaf, w: FontWeight.w700))),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tenant, style: J.ui(15, w: FontWeight.w700)),
            Text(prop, maxLines: 1, overflow: TextOverflow.ellipsis, style: J.ui(12, c: J.clay500)),
          ])),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          const Icon(Icons.calendar_month_outlined, size: 16, color: J.leaf), const SizedBox(width: 4),
          Text(moveIn != null ? '${moveIn.day}/${moveIn.month}/${moveIn.year}' : '—', style: J.ui(12, c: J.clay600)),
          const SizedBox(width: 14),
          const Icon(Icons.schedule_rounded, size: 16, color: J.leaf), const SizedBox(width: 4),
          Text('${r['duration'] ?? '—'}', style: J.ui(12, c: J.clay600)),
        ]),
        if ((r['message'] ?? '').toString().isNotEmpty) ...[
          const SizedBox(height: 10),
          Align(alignment: Alignment.centerLeft, child: Text('« ${r['message']} »', style: J.ui(13, c: J.clay600, w: FontWeight.w400, h: 1.4))),
        ],
        const SizedBox(height: 12),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 250),
          child: st == 'pending'
              ? Row(key: const ValueKey('p'), children: [
                  Expanded(child: _btn('Refuser', Colors.white, J.terracotta, () => _decide(false), border: true)),
                  const SizedBox(width: 8),
                  Expanded(child: _btn('Accepter', J.leaf, Colors.white, () => _decide(true))),
                ])
              : Container(
                  key: ValueKey(st), height: 44,
                  decoration: BoxDecoration(color: st == 'accepted' ? const Color(0xFFEAF3ED) : const Color(0xFFF9E9E2), borderRadius: BorderRadius.circular(14)),
                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(st == 'accepted' ? Icons.check_circle_rounded : Icons.cancel_rounded, size: 18, color: st == 'accepted' ? J.leaf : J.terracotta),
                    const SizedBox(width: 6),
                    Text(st == 'accepted' ? 'Acceptée — logement réservé' : st == 'cancelled' ? 'Annulée' : 'Refusée',
                        style: J.ui(14, c: st == 'accepted' ? J.leaf : J.terracotta, w: FontWeight.w700)),
                  ]),
                ),
        ),
      ]),
    );
  }

  Future<void> _decide(bool ok) async {
    if (busy) return;
    HapticFeedback.mediumImpact();
    setState(() => busy = true);
    try { await widget.data.decide('${widget.r['_id']}', ok); }
    catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Action impossible, réessayez'))); }
    if (mounted) setState(() => busy = false);
  }

  Widget _btn(String l, Color bg, Color fg, VoidCallback f, {bool border = false}) => Pressable(
        onTap: f,
        child: Container(height: 44, alignment: Alignment.center,
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14), border: border ? Border.all(color: J.soft, width: 1.5) : null),
            child: busy ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: fg)) : Text(l, style: J.ui(14, c: fg, w: FontWeight.w700))),
      );
}

class OwnerListings extends StatelessWidget {
  final OwnerData data;
  final VoidCallback onPublish;
  const OwnerListings({super.key, required this.data, required this.onPublish});
  @override
  Widget build(BuildContext context) => RefreshIndicator(
        color: J.leaf,
        onRefresh: data.load,
        child: ListView(padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 16, 20, 130), children: [
          Text('Mes annonces', style: J.ui(26, w: FontWeight.w800)),
          const SizedBox(height: 16),
          if (data.error != null) _errorBox(data.error!, data.load),
          if (data.loading) const Center(child: CircularProgressIndicator(color: J.leaf))
          else if (data.listings.isEmpty) const EmptyBox(icon: Icons.holiday_village_outlined, title: 'Aucune annonce', body: 'Touchez + pour publier votre premier logement.')
          else for (final p in data.listings) ListingRow(p),
        ]),
      );
}

class OwnerRequests extends StatelessWidget {
  final OwnerData data;
  const OwnerRequests({super.key, required this.data});
  @override
  Widget build(BuildContext context) => RefreshIndicator(
        color: J.leaf,
        onRefresh: data.load,
        child: ListView(padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 16, 20, 130), children: [
          Text('Demandes reçues', style: J.ui(26, w: FontWeight.w800)),
          const SizedBox(height: 16),
          if (data.error != null) _errorBox(data.error!, data.load),
          if (data.loading) const Center(child: CircularProgressIndicator(color: J.leaf))
          else if (data.requests.isEmpty) const EmptyBox(icon: Icons.inbox_outlined, title: 'Aucune demande pour l\'instant', body: 'Les demandes des locataires arriveront ici.')
          else for (final r in data.requests) RequestCard(r, data: data),
        ]),
      );
}
