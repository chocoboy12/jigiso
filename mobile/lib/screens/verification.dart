import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import '../data/api.dart';
import '../theme.dart';

/// Écrans 08 / 09 — Vérification du propriétaire :
/// photo de profil, type de pièce (CNI, carte NINA, passeport), recto/verso, selfie.
/// Envoi : POST /verification/identity (multipart id_front, id_back, selfie, docType)
/// + photo de profil via PUT /users/profile (profileImage).
class VerificationScreen extends StatefulWidget {
  const VerificationScreen({super.key});
  @override
  State<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends State<VerificationScreen> {
  final picker = ImagePicker();
  String doc = 'nina';
  final files = <String, File>{};
  bool sending = false;

  static const docs = [
    ('cni', 'Carte d\'identité', Icons.badge_outlined),
    ('nina', 'Carte NINA', Icons.credit_card_rounded),
    ('passport', 'Passeport', Icons.menu_book_rounded),
  ];

  List<String> get need => ['photo', 'id_front', if (doc != 'passport') 'id_back', 'selfie'];
  int get done => need.where(files.containsKey).length;
  bool get ready => done == need.length;

  Future<void> _pick(String key, {bool selfie = false}) async {
    HapticFeedback.selectionClick();
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (c) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
        const SizedBox(height: 8),
        ListTile(leading: const Icon(Icons.photo_camera_outlined), title: const Text('Prendre une photo'), onTap: () => Navigator.pop(c, ImageSource.camera)),
        if (!selfie) ListTile(leading: const Icon(Icons.photo_library_outlined), title: const Text('Choisir dans la galerie'), onTap: () => Navigator.pop(c, ImageSource.gallery)),
        const SizedBox(height: 8),
      ])),
    );
    if (source == null) return;
    final x = await picker.pickImage(source: source, imageQuality: 80, maxWidth: 1800,
        preferredCameraDevice: selfie || key == 'photo' ? CameraDevice.front : CameraDevice.rear);
    if (x != null) setState(() => files[key] = File(x.path));
  }

  Future<void> _submit() async {
    if (!ready || sending) return;
    HapticFeedback.mediumImpact();
    setState(() => sending = true);
    try {
      await Api.submitIdentity(docType: doc, profilePhoto: files['photo']!, front: files['id_front']!, back: files['id_back'], selfie: files['selfie']!);
    } catch (e) {
      if (!mounted) return;
      setState(() => sending = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Envoi impossible : $e')));
      return;
    }
    if (!mounted) return;
    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => VerificationStatusScreen(docLabel: docs.firstWhere((d) => d.$1 == doc).$2)));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 120), children: [
            Row(children: [
              _square(Icons.arrow_back_rounded, () => Navigator.pop(context)),
              const SizedBox(width: 12),
              Expanded(child: Text('Vérification', style: J.ui(18, w: FontWeight.w800))),
              Text('$done/${need.length}', style: J.ui(13, c: J.gold, w: FontWeight.w700)),
            ]),
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(3),
              child: TweenAnimationBuilder<double>(
                tween: Tween(end: done / need.length), duration: const Duration(milliseconds: 400), curve: Curves.easeOutCubic,
                builder: (_, v, __) => LinearProgressIndicator(value: v, minHeight: 6, backgroundColor: const Color(0xFFF0EBE1), color: J.gold),
              ),
            ),
            const SizedBox(height: 18),
            Text('Confirmez votre identité', style: J.ui(24, w: FontWeight.w800, h: 1.15)),
            const SizedBox(height: 4),
            Text('Les locataires font confiance aux propriétaires vérifiés. Vos documents restent privés.', style: J.ui(14, c: J.clay500, w: FontWeight.w400, h: 1.5)),
            const SizedBox(height: 18),
            // Photo de profil
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: J.bg, borderRadius: BorderRadius.circular(20)),
              child: Row(children: [
                Pressable(
                  onTap: () => _pick('photo'),
                  child: Stack(clipBehavior: Clip.none, children: [
                    CircleAvatar(
                      radius: 36,
                      backgroundColor: Colors.white,
                      backgroundImage: files['photo'] != null ? FileImage(files['photo']!) : null,
                      child: files['photo'] == null ? const Icon(Icons.add_a_photo_outlined, color: J.clay300, size: 28) : null,
                    ),
                    Positioned(right: -2, bottom: -2, child: Container(
                      width: 26, height: 26,
                      decoration: BoxDecoration(color: J.ink, shape: BoxShape.circle, border: Border.all(color: J.bg, width: 2)),
                      child: const Icon(Icons.photo_camera_rounded, size: 14, color: J.gold),
                    )),
                  ]),
                ),
                const SizedBox(width: 14),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Photo de profil', style: J.ui(15, w: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text('Visage bien visible, sans lunettes', style: J.ui(12, c: J.clay500)),
                  const SizedBox(height: 2),
                  Text(files['photo'] != null ? 'Ajoutée ✓' : 'À ajouter', style: J.ui(12, c: files['photo'] != null ? J.leaf : J.terracotta, w: FontWeight.w700)),
                ])),
              ]),
            ),
            const SizedBox(height: 18),
            Text('Type de pièce', style: J.ui(15, w: FontWeight.w700)),
            const SizedBox(height: 10),
            Row(children: [
              for (var i = 0; i < docs.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(child: Pressable(
                  onTap: () => setState(() { doc = docs[i].$1; if (doc == 'passport') files.remove('id_back'); }),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
                    decoration: BoxDecoration(color: doc == docs[i].$1 ? const Color(0xFFFFFCF5) : Colors.white, borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: doc == docs[i].$1 ? J.gold : J.soft, width: 2)),
                    child: Column(children: [
                      Icon(docs[i].$3, size: 26, color: doc == docs[i].$1 ? J.gold : J.clay500),
                      const SizedBox(height: 6),
                      Text(docs[i].$2, textAlign: TextAlign.center, style: J.ui(12, w: FontWeight.w700)),
                    ]),
                  ),
                )),
              ],
            ]),
            const SizedBox(height: 14),
            Row(children: [
              Expanded(child: _slot('id_front', doc == 'passport' ? 'Page photo' : 'Recto', doc == 'passport' ? 'Passeport ouvert' : 'Face avec photo')),
              const SizedBox(width: 10),
              Expanded(child: doc == 'passport'
                  ? _disabledSlot()
                  : _slot('id_back', 'Verso', 'Face arrière')),
            ]),
            const SizedBox(height: 12),
            Pressable(
              onTap: () => _pick('selfie', selfie: true),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: files['selfie'] != null ? const Color(0xFFEAF3ED) : J.bg, borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: files['selfie'] != null ? J.leaf : J.line, width: 2)),
                child: Row(children: [
                  Container(width: 48, height: 48, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                      child: Icon(files['selfie'] != null ? Icons.check_circle_rounded : Icons.face_retouching_natural_outlined, color: files['selfie'] != null ? J.leaf : J.clay300)),
                  const SizedBox(width: 14),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Selfie avec la pièce', style: J.ui(14, w: FontWeight.w700)),
                    Text('Tenez la pièce à côté de votre visage', style: J.ui(12, c: J.clay500)),
                  ])),
                ]),
              ),
            ),
            const SizedBox(height: 14),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(Icons.lock_outline_rounded, size: 16, color: J.leaf),
              const SizedBox(width: 6),
              Expanded(child: Text('Chiffré et visible uniquement par l\'équipe Jigiso. Examen sous 24 à 48 h.', style: J.ui(12, c: J.clay500, h: 1.45))),
            ]),
          ]),
        ),
        bottomSheet: Container(
          color: Colors.white,
          padding: EdgeInsets.fromLTRB(20, 12, 20, 12 + MediaQuery.of(context).padding.bottom),
          child: Pressable(
            onTap: _submit,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              height: 56,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: ready ? J.ink : J.soft, borderRadius: BorderRadius.circular(18)),
              child: sending
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: J.gold))
                  : Text(ready ? 'Envoyer pour vérification' : 'Encore ${need.length - done} élément${need.length - done > 1 ? 's' : ''}',
                      style: J.ui(16, c: ready ? Colors.white : J.clay300, w: FontWeight.w700)),
            ),
          ),
        ),
      );

  Widget _square(IconData i, VoidCallback f) => Pressable(onTap: f, child: Container(
        width: 44, height: 44,
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: J.soft, width: 1.5)),
        child: Icon(i)));

  Widget _slot(String key, String label, String hint) {
    final f = files[key];
    return Pressable(
      onTap: () => _pick(key),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: 118,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(color: f != null ? const Color(0xFFEAF3ED) : J.bg, borderRadius: BorderRadius.circular(18), border: Border.all(color: f != null ? J.leaf : J.line, width: 2)),
        child: f != null
            ? Stack(fit: StackFit.expand, children: [
                Image.file(f, fit: BoxFit.cover),
                Positioned(right: 8, top: 8, child: Container(padding: const EdgeInsets.all(2), decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                    child: const Icon(Icons.check_circle_rounded, color: J.leaf, size: 20))),
                Positioned(left: 8, bottom: 8, child: Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: J.ink.withOpacity(.6), borderRadius: BorderRadius.circular(999)), child: Text(label, style: J.ui(11, c: Colors.white, w: FontWeight.w700)))),
              ])
            : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(Icons.add_a_photo_outlined, color: J.clay300, size: 28),
                const SizedBox(height: 6),
                Text(label, style: J.ui(13, w: FontWeight.w700)),
                Text(hint, style: J.ui(11, c: J.clay500)),
              ]),
      ),
    );
  }

  Widget _disabledSlot() => Container(
        height: 118,
        decoration: BoxDecoration(color: const Color(0xFFF5F2EC), borderRadius: BorderRadius.circular(18), border: Border.all(color: J.soft, width: 2)),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.block_rounded, color: J.line, size: 28),
          const SizedBox(height: 6),
          Text('Verso', style: J.ui(13, w: FontWeight.w700)),
          Text('Inutile pour un passeport', style: J.ui(11, c: J.clay500)),
        ]),
      );
}

class VerificationStatusScreen extends StatelessWidget {
  final String docLabel;
  const VerificationStatusScreen({super.key, required this.docLabel});

  @override
  Widget build(BuildContext context) {
    final steps = [
      ('Compte créé', 'Email confirmé', 'done'),
      ('Photo & pièces reçues', '$docLabel, selfie', 'done'),
      ('En cours d\'examen', 'Sous 24 à 48 h', 'now'),
      ('Propriétaire vérifié', 'Badge sur vos annonces', 'todo'),
    ];
    return Scaffold(
      backgroundColor: J.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Align(alignment: Alignment.centerLeft, child: IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close_rounded))),
            const SizedBox(height: 8),
            Entrance(child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(28), boxShadow: J.softShadow),
              child: Column(children: [
                Stack(clipBehavior: Clip.none, children: [
                  const CircleAvatar(radius: 48, backgroundColor: J.leaf, child: Icon(Icons.person_rounded, color: Colors.white, size: 48)),
                  Positioned(right: -4, bottom: -4, child: Container(width: 34, height: 34,
                      decoration: BoxDecoration(color: J.gold, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 3)),
                      child: const Icon(Icons.hourglass_top_rounded, size: 18, color: J.ink))),
                ]),
                const SizedBox(height: 14),
                Text('En cours d\'examen', style: J.ui(22, w: FontWeight.w800)),
                const SizedBox(height: 6),
                Text('Nous vérifions votre $docLabel. Vous recevrez un SMS dès que c\'est fait.', textAlign: TextAlign.center, style: J.ui(14, c: J.clay500, w: FontWeight.w400, h: 1.5)),
              ]),
            )),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), boxShadow: J.softShadow),
              child: Column(children: [
                for (var i = 0; i < steps.length; i++)
                  Entrance(delayMs: 150 + i * 120, from: const Offset(-16, 0), child: IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Column(children: [
                      Container(
                        width: 30, height: 30,
                        decoration: BoxDecoration(shape: BoxShape.circle, color: steps[i].$3 == 'done' ? J.leaf : steps[i].$3 == 'now' ? J.gold : const Color(0xFFF0EBE1)),
                        child: Icon(steps[i].$3 == 'done' ? Icons.check_rounded : steps[i].$3 == 'now' ? Icons.hourglass_top_rounded : Icons.verified_outlined,
                            size: 17, color: steps[i].$3 == 'done' ? Colors.white : steps[i].$3 == 'now' ? J.ink : J.clay300),
                      ),
                      if (i < steps.length - 1) Expanded(child: Container(width: 2, color: steps[i].$3 == 'done' ? J.leaf : J.soft)),
                    ]),
                    const SizedBox(width: 14),
                    Padding(
                      padding: const EdgeInsets.only(top: 4, bottom: 16),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(steps[i].$1, style: J.ui(15, c: steps[i].$3 == 'todo' ? J.clay300 : J.ink, w: FontWeight.w700)),
                        Text(steps[i].$2, style: J.ui(12, c: J.clay500)),
                      ]),
                    ),
                  ]))),
              ]),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: const Color(0xFFEAF3ED), borderRadius: BorderRadius.circular(18)),
              child: Row(children: [
                const Icon(Icons.verified_rounded, color: J.leaf),
                const SizedBox(width: 10),
                Expanded(child: Text('Une fois vérifié, le badge apparaît sur toutes vos annonces.', style: J.ui(13, c: J.leaf, w: FontWeight.w600, h: 1.4))),
              ]),
            ),
            const SizedBox(height: 12),
            Pressable(
              onTap: () => Navigator.pop(context),
              child: Container(height: 56, alignment: Alignment.center, decoration: BoxDecoration(color: J.ink, borderRadius: BorderRadius.circular(18)),
                  child: Text('Retour au tableau de bord', style: J.ui(16, c: Colors.white, w: FontWeight.w700))),
            ),
          ]),
        ),
      ),
    );
  }
}
