import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme.dart';

/// Adresse publique du site (les liens partagés y mènent).
const siteUrl = String.fromEnvironment('SITE_URL', defaultValue: 'https://imobilier-18139.web.app');

String lienAnnonce(Property p) => '$siteUrl/logements/${p.id}';

/// Partager une annonce : WhatsApp, autres applications, ou copier le lien.
Future<void> partagerAnnonce(BuildContext context, Property p) {
  final s = AppScope.of(context);
  final texte = '${p.title} — ${p.neighborhood}, ${p.city}\n'
      '${fcfa(p.price)} FCFA / ${s.t('month')}\n'
      '${s.t('share.see')} : ${lienAnnonce(p)}';
  return showModalBottomSheet(
    context: context,
    backgroundColor: J.cream,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: (c) => SafeArea(child: Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(s.t('share.t'), style: J.ui(20, w: FontWeight.w800)),
        const SizedBox(height: 4),
        Text(p.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: J.ui(13.5, c: J.clay500)),
        const SizedBox(height: 14),
        _ligne(Icons.chat_rounded, J.leaf, s.t('share.whatsapp'), () {
          Navigator.pop(c);
          launchUrl(Uri.parse('https://wa.me/?text=${Uri.encodeComponent(texte)}'), mode: LaunchMode.externalApplication);
        }),
        _ligne(Icons.ios_share_rounded, J.ink, s.t('share.other'), () {
          Navigator.pop(c);
          SharePlus.instance.share(ShareParams(text: texte, subject: p.title));
        }),
        _ligne(Icons.link_rounded, J.goldDeep, s.t('share.copy'), () {
          Clipboard.setData(ClipboardData(text: lienAnnonce(p)));
          Navigator.pop(c);
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.t('share.copied'))));
        }),
      ]),
    )),
  );
}

Widget _ligne(IconData i, Color c, String label, VoidCallback f) => Pressable(
      onTap: f,
      child: Container(
        constraints: const BoxConstraints(minHeight: 56),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(color: J.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: J.line)),
        child: Row(children: [
          Icon(i, color: c),
          const SizedBox(width: 12),
          Expanded(child: Text(label, style: J.ui(15, w: FontWeight.w700))),
        ]),
      ),
    );

/// Badges de confiance sur la fiche : annonce relue par l'équipe, identité
/// du propriétaire contrôlée. Toucher un badge explique ce qu'il garantit.
class BadgesVerif extends StatelessWidget {
  final Property p;
  const BadgesVerif(this.p, {super.key});

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final badges = [
      if (p.approved) (Icons.verified_rounded, s.t('badge.listing'), s.t('badge.listingSub')),
      if (p.ownerVerified) (Icons.badge_rounded, s.t('badge.owner'), s.t('badge.ownerSub')),
    ];
    if (badges.isEmpty) return const SizedBox.shrink();
    return Wrap(spacing: 8, runSpacing: 8, children: [
      for (final (icone, titre, detail) in badges)
        Pressable(
          onTap: () => showDialog(context: context, builder: (c) => AlertDialog(
            icon: Icon(icone, color: J.leaf, size: 32),
            title: Text(titre, style: J.ui(18, w: FontWeight.w800)),
            content: Text(detail, style: J.ui(14.5, c: J.clay600, h: 1.45)),
            actions: [TextButton(onPressed: () => Navigator.pop(c), child: const Text('OK'))],
          )),
          child: Semantics(button: true, label: titre, child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(color: J.leaf.withValues(alpha: .12), borderRadius: BorderRadius.circular(999)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(icone, size: 17, color: J.leaf),
              const SizedBox(width: 6),
              Text(titre, style: J.ui(13, c: J.leaf, w: FontWeight.w700)),
            ]),
          )),
        ),
    ]);
  }
}

/// Pastille compacte pour les cartes d'annonce (propriétaire vérifié).
class BadgeMini extends StatelessWidget {
  final String label;
  const BadgeMini(this.label, {super.key});
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.verified_rounded, size: 14, color: J.leaf),
        const SizedBox(width: 3),
        Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis,
            style: J.ui(11.5, c: J.leaf, w: FontWeight.w700))),
      ]);
}
