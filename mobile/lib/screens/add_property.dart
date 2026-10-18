import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import '../data/api.dart';
import '../data/mali_locations.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/location_picker.dart';
import 'detail.dart' show amenityIcons;
import '../widgets/property_card.dart' show typeIcons;

/// Espace propriétaire · Publier un logement — photos puis infos & localisation.
/// Envoi : POST /properties (multipart), mêmes champs que AddPropertyPage du site.
class AddPropertyScreen extends StatefulWidget {
  const AddPropertyScreen({super.key});
  @override
  State<AddPropertyScreen> createState() => _AddPropertyScreenState();
}

class _AddPropertyScreenState extends State<AddPropertyScreen> {
  static const maxPhotos = 10;
  final picker = ImagePicker();
  final photos = <File>[];
  int step = 0;
  final title = TextEditingController(), price = TextEditingController(), area = TextEditingController(), desc = TextEditingController();
  String? type;
  Place? place;
  double? lat, lng;
  int beds = 0, baths = 0;
  bool furnished = false, sending = false;
  final amen = <String, bool>{for (final k in amenityKeys) k: false};

  Future<void> _addPhotos(ImageSource src) async {
    HapticFeedback.selectionClick();
    if (src == ImageSource.gallery) {
      final xs = await picker.pickMultiImage(imageQuality: 82, maxWidth: 2000);
      setState(() => photos.addAll(xs.map((x) => File(x.path)).take(maxPhotos - photos.length)));
    } else {
      final x = await picker.pickImage(source: ImageSource.camera, imageQuality: 82, maxWidth: 2000);
      if (x != null && photos.length < maxPhotos) setState(() => photos.add(File(x.path)));
    }
  }

  String? get _missing {
    if (photos.isEmpty) return 'Ajoutez au moins une photo';
    if (title.text.trim().isEmpty) return 'Ajoutez un titre';
    if (type == null) return 'Choisissez le type';
    if (place == null) return 'Choisissez la localisation';
    if ((int.tryParse(price.text.replaceAll(' ', '')) ?? 0) <= 0) return 'Indiquez le loyer';
    if (desc.text.trim().isEmpty) return 'Ajoutez une description';
    return null;
  }

  Future<void> _submit() async {
    final m = _missing;
    if (m != null) { ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m))); return; }
    HapticFeedback.mediumImpact();
    setState(() => sending = true);
    try {
      await Api.createProperty(
        fields: {
          'title': title.text.trim(), 'type': type!, 'description': desc.text.trim(),
          'price': price.text.replaceAll(' ', ''), 'pricePeriod': 'mois',
          'city': place!.city, 'neighborhood': place!.neighborhood,
          if (place!.region != null) 'region': place!.region!,
          'bedrooms': '$beds', 'bathrooms': '$baths', 'area': area.text.isEmpty ? '0' : area.text,
          'furnished': '$furnished',
        },
        amenities: amen,
        location: lat != null ? {'lat': lat!, 'lng': lng!} : null,
        photos: photos,
      );
      if (!mounted) return;
      AppScope.of(context).load();
      Navigator.pop(context, true);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Annonce envoyée — en attente de validation par Jigiso')));
    } catch (e) {
      if (!mounted) return;
      setState(() => sending = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Envoi impossible : $e')));
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Column(children: [
                Row(children: [
                  IconButton(onPressed: () => step == 0 ? Navigator.pop(context) : setState(() => step = 0),
                      icon: Icon(step == 0 ? Icons.close_rounded : Icons.arrow_back_rounded)),
                  Expanded(child: Text('Nouvelle annonce', style: J.ui(18, w: FontWeight.w800))),
                  Text('${step + 1}/2', style: J.ui(13, c: J.leaf, w: FontWeight.w700)),
                ]),
                const SizedBox(height: 10),
                ClipRRect(borderRadius: BorderRadius.circular(3), child: TweenAnimationBuilder<double>(
                  tween: Tween(end: (step + 1) / 2), duration: const Duration(milliseconds: 350),
                  builder: (_, v, __) => LinearProgressIndicator(value: v, minHeight: 6, color: J.leaf, backgroundColor: const Color(0xFFE6F0EA)),
                )),
              ]),
            ),
            Expanded(child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              transitionBuilder: (c, a) => FadeTransition(opacity: a, child: SlideTransition(position: Tween(begin: const Offset(.06, 0), end: Offset.zero).animate(a), child: c)),
              child: step == 0 ? _photosStep() : _infoStep(),
            )),
          ]),
        ),
        bottomNavigationBar: SafeArea(
          minimum: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: Pressable(
            onTap: sending ? null : () => step == 0 ? (photos.isEmpty ? _addPhotos(ImageSource.gallery) : setState(() => step = 1)) : _submit(),
            child: Container(
              height: 56, alignment: Alignment.center,
              decoration: BoxDecoration(color: J.leaf, borderRadius: BorderRadius.circular(18)),
              child: sending
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                  : Text(step == 0 ? (photos.isEmpty ? 'Ajouter des photos' : 'Continuer') : 'Envoyer pour validation', style: J.ui(16, c: Colors.white, w: FontWeight.w700)),
            ),
          ),
        ),
      );

  Widget _photosStep() => ListView(key: const ValueKey(0), padding: const EdgeInsets.fromLTRB(20, 18, 20, 20), children: [
        Text('Photos du logement', style: J.ui(24, w: FontWeight.w800)),
        const SizedBox(height: 4),
        Text('Jusqu\'à $maxPhotos photos. La première sert de couverture — touchez une photo pour la mettre en couverture, glissez pour réordonner.',
            style: J.ui(14, c: J.clay500, w: FontWeight.w400, h: 1.5)),
        const SizedBox(height: 16),
        ReorderableWrapGrid(
          photos: photos,
          onCover: (i) => setState(() { final f = photos.removeAt(i); photos.insert(0, f); }),
          onRemove: (i) => setState(() => photos.removeAt(i)),
          onReorder: (a, b) => setState(() { final f = photos.removeAt(a); photos.insert(b > a ? b - 1 : b, f); }),
          onAdd: photos.length < maxPhotos ? () => _addPhotos(ImageSource.gallery) : null,
        ),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(child: _srcBtn(Icons.photo_camera_outlined, 'Appareil photo', () => _addPhotos(ImageSource.camera))),
          const SizedBox(width: 10),
          Expanded(child: _srcBtn(Icons.photo_library_outlined, 'Galerie', () => _addPhotos(ImageSource.gallery))),
        ]),
        const SizedBox(height: 10),
        Text('${photos.length}/$maxPhotos photos${photos.length >= 6 ? ' · idéal' : ' · 6 recommandées'}', style: J.ui(12, c: photos.length >= 6 ? J.leaf : J.clay500, w: FontWeight.w600)),
      ]);

  Widget _srcBtn(IconData i, String l, VoidCallback f) => Pressable(
        onTap: f,
        child: Container(
          height: 52,
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: J.soft, width: 1.5)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(i, color: J.leaf), const SizedBox(width: 8), Text(l, style: J.ui(14, w: FontWeight.w700))]),
        ),
      );

  Widget _infoStep() => ListView(key: const ValueKey(1), padding: const EdgeInsets.fromLTRB(20, 18, 20, 20), children: [
        _label('Titre de l\'annonce'),
        _field(title, 'Ex. Maison 3 chambres avec cour'),
        const SizedBox(height: 16),
        _label('Type'),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final t in propertyTypes) _chip(AppScope.of(context).typeLabel(t), typeIcons[t]!, type == t, () => setState(() => type = t)),
        ]),
        const SizedBox(height: 16),
        _label('Localisation'),
        Pressable(
          onTap: () async {
            final p = await showLocationPicker(context, current: place, accent: J.leaf, allowGps: false);
            if (p != null) setState(() => place = p);
          },
          child: Container(
            height: 58, padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(color: place != null ? const Color(0xFFF4F7F5) : const Color(0xFFF8F6F1), borderRadius: BorderRadius.circular(16),
                border: Border.all(color: place != null ? J.leaf : J.soft, width: 1.5)),
            child: Row(children: [
              Icon(Icons.location_on_rounded, color: place != null ? J.leaf : J.clay300),
              const SizedBox(width: 10),
              Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Région · commune · quartier', style: J.ui(11, c: J.clay500)),
                Text(place?.label ?? 'Choisir…', style: J.ui(14, w: FontWeight.w700)),
              ])),
              const Icon(Icons.expand_more_rounded, color: J.clay500),
            ]),
          ),
        ),
        const SizedBox(height: 8),
        Pressable(
          onTap: () async {
            final p = await currentPlace(context);
            if (p != null) setState(() { lat = p.lat; lng = p.lng; });
          },
          child: Container(
            height: 48,
            decoration: BoxDecoration(color: lat != null ? const Color(0xFFE6F0EA) : Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: lat != null ? J.leaf : J.soft, width: 1.5)),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(lat != null ? Icons.check_circle_rounded : Icons.my_location_rounded, size: 20, color: J.leaf),
              const SizedBox(width: 8),
              Text(lat != null ? 'Position GPS enregistrée' : 'Je suis sur place : enregistrer la position GPS', style: J.ui(13, w: FontWeight.w700)),
            ]),
          ),
        ),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_label('Loyer / mois'), _field(price, '0', suffix: 'FCFA', number: true)])),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_label('Surface'), _field(area, '0', suffix: 'm²', number: true)])),
        ]),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(child: _stepper('Chambres', beds, (v) => setState(() => beds = v))),
          const SizedBox(width: 10),
          Expanded(child: _stepper('Salles de bain', baths, (v) => setState(() => baths = v))),
        ]),
        const SizedBox(height: 12),
        SwitchListTile(contentPadding: EdgeInsets.zero, value: furnished, activeColor: J.leaf, onChanged: (v) => setState(() => furnished = v),
            title: Text('Meublé', style: J.ui(15, w: FontWeight.w700))),
        _label('Équipements'),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final k in amenityKeys) _chip(AppScope.of(context).amenityLabel(k), amenityIcons[k]!, amen[k]!, () => setState(() => amen[k] = !amen[k]!)),
        ]),
        const SizedBox(height: 16),
        _label('Description'),
        _field(desc, 'Décrivez le logement, le quartier, l\'accès…', lines: 4),
      ]);

  Widget _label(String t) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(t, style: J.ui(13, c: J.clay600, w: FontWeight.w600)));

  Widget _field(TextEditingController c, String hint, {String? suffix, bool number = false, int lines = 1}) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(color: const Color(0xFFF8F6F1), borderRadius: BorderRadius.circular(16), border: Border.all(color: J.soft, width: 1.5)),
        child: Row(children: [
          Expanded(child: TextField(controller: c, maxLines: lines, keyboardType: number ? TextInputType.number : TextInputType.text,
              inputFormatters: number ? [FilteringTextInputFormatter.digitsOnly] : null,
              style: J.ui(15, w: number ? FontWeight.w700 : FontWeight.w500),
              decoration: InputDecoration(border: InputBorder.none, hintText: hint, hintStyle: J.ui(15, c: J.clay300), contentPadding: const EdgeInsets.symmetric(vertical: 15)))),
          if (suffix != null) Text(suffix, style: J.ui(12, c: J.clay300, w: FontWeight.w700)),
        ]),
      );

  Widget _chip(String l, IconData i, bool on, VoidCallback f) => Pressable(
        onTap: () { HapticFeedback.selectionClick(); f(); },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          height: 38, padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(color: on ? J.leaf : Colors.white, borderRadius: BorderRadius.circular(999), border: Border.all(color: on ? J.leaf : J.soft, width: 1.5)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(i, size: 17, color: on ? Colors.white : J.ink), const SizedBox(width: 5), Text(l, style: J.ui(13, c: on ? Colors.white : J.ink, w: FontWeight.w600))]),
        ),
      );

  Widget _stepper(String l, int v, ValueChanged<int> on) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _label(l),
        Container(
          height: 52, padding: const EdgeInsets.symmetric(horizontal: 6),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: J.soft, width: 1.5)),
          child: Row(children: [
            _sq(Icons.remove_rounded, const Color(0xFFF5F1E8), J.ink, () => on(v > 0 ? v - 1 : 0)),
            Expanded(child: Center(child: AnimatedSwitcher(duration: const Duration(milliseconds: 150), child: Text('$v', key: ValueKey(v), style: J.ui(17, w: FontWeight.w800))))),
            _sq(Icons.add_rounded, J.leaf, Colors.white, () => on(v + 1)),
          ]),
        ),
      ]);

  Widget _sq(IconData i, Color bg, Color fg, VoidCallback f) => Pressable(
        onTap: () { HapticFeedback.selectionClick(); f(); },
        child: Container(width: 40, height: 40, decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)), child: Icon(i, size: 20, color: fg)),
      );
}

/// Grille de photos : la première en grand (couverture), appui long pour déplacer
class ReorderableWrapGrid extends StatelessWidget {
  final List<File> photos;
  final ValueChanged<int> onCover, onRemove;
  final void Function(int from, int to) onReorder;
  final VoidCallback? onAdd;
  const ReorderableWrapGrid({super.key, required this.photos, required this.onCover, required this.onRemove, required this.onReorder, this.onAdd});

  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (_, c) {
        final w = (c.maxWidth - 20) / 3;
        Widget tile(int i) {
          final big = i == 0;
          final size = big ? w * 2 + 10 : w;
          final img = ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: SizedBox(width: size, height: size, child: Stack(fit: StackFit.expand, children: [
              Image.file(photos[i], fit: BoxFit.cover),
              if (big) Positioned(top: 10, left: 10, child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(color: J.leaf, borderRadius: BorderRadius.circular(999)),
                child: Row(children: [const Icon(Icons.star_rounded, size: 14, color: Colors.white), const SizedBox(width: 4), Text('Couverture', style: J.ui(11, c: Colors.white, w: FontWeight.w700))]),
              )),
              Positioned(top: 6, right: 6, child: GestureDetector(
                onTap: () => onRemove(i),
                child: Container(width: 28, height: 28, decoration: BoxDecoration(color: J.ink.withOpacity(.6), shape: BoxShape.circle), child: const Icon(Icons.close_rounded, size: 16, color: Colors.white)),
              )),
            ])),
          );
          return DragTarget<int>(
            onAcceptWithDetails: (d) => onReorder(d.data, i),
            builder: (_, cand, __) => LongPressDraggable<int>(
              data: i,
              feedback: Opacity(opacity: .85, child: Material(color: Colors.transparent, child: SizedBox(width: w, height: w, child: ClipRRect(borderRadius: BorderRadius.circular(18), child: Image.file(photos[i], fit: BoxFit.cover))))),
              childWhenDragging: Opacity(opacity: .3, child: img),
              child: GestureDetector(onTap: big ? null : () => onCover(i), child: AnimatedScale(scale: cand.isNotEmpty ? .94 : 1, duration: const Duration(milliseconds: 150), child: img)),
            ),
          );
        }

        Widget addTile(bool big) => GestureDetector(
              onTap: onAdd,
              child: Container(
                width: big ? w * 2 + 10 : w, height: big ? w * 2 + 10 : w,
                decoration: BoxDecoration(color: const Color(0xFFF4F7F5), borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0xFFB9D3C2), width: 2)),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.add_a_photo_outlined, color: J.leaf, size: big ? 36 : 26),
                  if (big) ...[const SizedBox(height: 8), Text('Photo principale', style: J.ui(14, w: FontWeight.w700)), Text('Touchez pour ajouter', style: J.ui(12, c: J.clay500))],
                ]),
              ),
            );

        return Wrap(spacing: 10, runSpacing: 10, children: [
          for (var i = 0; i < photos.length; i++) tile(i),
          if (onAdd != null) addTile(photos.isEmpty),
        ]);
      });
}
