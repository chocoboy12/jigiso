import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import '../data/api.dart';
import '../data/mali_locations.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/location_picker.dart';
import 'detail.dart' show amenityIcons;
import '../widgets/property_card.dart' show typeIcons;

/// Espace propriétaire · Publier un logement — photos, infos & localisation,
/// puis contrat de location (exigé par le serveur pour publier).
/// Envoi : POST /properties (multipart), mêmes champs que AddPropertyPage du site.
class AddPropertyScreen extends StatefulWidget {
  const AddPropertyScreen({super.key});

  /// Vrai si une annonce commencée attend d'être reprise (voir le brouillon ci-dessous).
  static Future<bool> hasDraft() async {
    try {
      return File('${(await getApplicationDocumentsDirectory()).path}/brouillon_annonce/brouillon.json').existsSync();
    } catch (_) { return false; }
  }

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
  /// Adresse exacte publique ? Par défaut non : le public voit un secteur de ± 400 m
  bool positionExacte = false;
  final amen = <String, bool>{for (final k in amenityKeys) k: false};

  // Contrat — mêmes champs que ContractForm du site (voir parseContract côté serveur)
  final minDuration = TextEditingController(), notice = TextEditingController(),
      deposit = TextEditingController(), advance = TextEditingController(), payDay = TextEditingController(),
      obligations = TextEditingController(), termination = TextEditingController(),
      rules = TextEditingController(), extra = TextEditingController();
  final charges = <String>{};

  // Contact affiché sur l'annonce (boutons Appeler / WhatsApp) — ce sont les
  // numéros du profil : les modifier ici met le profil à jour à l'envoi.
  final contactPhone = TextEditingController(), contactWhatsapp = TextEditingController();

  /// « +22370000000 » → « 70 00 00 00 » ; les 8 chiffres locaux, groupés par deux.
  static String _local(String brut) {
    var d = brut.replaceAll(RegExp(r'\D'), '');
    if (d.startsWith('223') && d.length > 8) d = d.substring(3);
    return d.replaceAllMapped(RegExp(r'(\d{2})(?=\d)'), (m) => '${m[1]} ');
  }
  static String _digits(String brut) {
    final d = brut.replaceAll(RegExp(r'\D'), '');
    return d.startsWith('223') && d.length > 8 ? d.substring(3) : d;
  }

  /* ── Brouillon ─────────────────────────────────────────────
     Tout est enregistré sur le téléphone au fil de la saisie (photos
     comprises, recopiées dans les documents de l'app : le cache
     d'image_picker peut être vidé par le système). Si l'écran se ferme,
     si l'app est tuée, on reprend là où on s'était arrêté en rouvrant
     « Publier ». Le brouillon est effacé après un envoi réussi. */
  bool _draftReady = false;        // pas d'écriture avant la relecture : on écraserait le brouillon
  Timer? _saveTimer;
  Future<void> _saveChain = Future.value();

  static Future<Directory> _draftDir() async {
    final d = Directory('${(await getApplicationDocumentsDirectory()).path}/brouillon_annonce');
    if (!await d.exists()) await d.create(recursive: true);
    return d;
  }

  List<TextEditingController> get _controllers =>
      [title, price, area, desc, minDuration, notice, deposit, advance, payDay, obligations, termination, rules, extra, contactPhone, contactWhatsapp];

  @override
  void initState() {
    super.initState();
    for (final c in _controllers) { c.addListener(_scheduleSave); }
    _restoreDraft();
  }

  // Chaque changement d'état (étape, type, photos, équipements…) déclenche une sauvegarde.
  @override
  void setState(VoidCallback fn) { super.setState(fn); _scheduleSave(); }

  void _scheduleSave() {
    if (!_draftReady || sending) return;
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 600), _flushDraft);
  }

  /// Capture l'état tout de suite (synchrone), puis l'écrit à la suite des écritures précédentes.
  void _flushDraft() {
    if (!_draftReady) return;
    final snap = {
      'step': step, 'title': title.text, 'price': price.text, 'area': area.text, 'desc': desc.text,
      'type': type, 'beds': beds, 'baths': baths, 'furnished': furnished, 'lat': lat, 'lng': lng, 'exacte': positionExacte,
      'amen': amen, 'charges': charges.toList(),
      'contactPhone': contactPhone.text, 'contactWhatsapp': contactWhatsapp.text,
      'place': place?.toJson(),
      'contract': {for (final e in {
        'minDuration': minDuration, 'notice': notice, 'deposit': deposit, 'advance': advance, 'payDay': payDay,
        'obligations': obligations, 'termination': termination, 'rules': rules, 'extra': extra}.entries) e.key: e.value.text},
    };
    final paths = photos.map((f) => f.path).toList();
    _saveChain = _saveChain.then((_) => _writeDraft(snap, paths)).catchError((_) {});
  }

  Future<void> _writeDraft(Map<String, dynamic> snap, List<String> paths) async {
    final dir = await _draftDir();
    final json = File('${dir.path}/brouillon.json');
    final empty = paths.isEmpty && (snap['title'] as String).isEmpty && (snap['desc'] as String).isEmpty
        && (snap['price'] as String).isEmpty && snap['type'] == null && snap['place'] == null;
    if (empty) { await _clearDraft(); return; }

    final kept = <String>[];
    for (final p in paths) {
      if (p.startsWith(dir.path)) { kept.add(p); continue; }
      final ext = p.contains('.') ? p.substring(p.lastIndexOf('.')) : '.jpg';
      final copy = await File(p).copy('${dir.path}/photo_${DateTime.now().microsecondsSinceEpoch}$ext');
      kept.add(copy.path);
      // La même image, désormais à un emplacement durable
      final i = photos.indexWhere((f) => f.path == p);
      if (i >= 0) photos[i] = copy;
    }
    await for (final e in dir.list()) {
      if (e is File && e.path.contains('/photo_') && !kept.contains(e.path)) await e.delete();
    }
    snap['photos'] = kept;
    await json.writeAsString(jsonEncode(snap));
  }

  static Future<void> _clearDraft() async {
    try {
      final d = Directory('${(await getApplicationDocumentsDirectory()).path}/brouillon_annonce');
      if (await d.exists()) await d.delete(recursive: true);
    } catch (_) {}
  }

  Future<void> _restoreDraft() async {
    try {
      final f = File('${(await _draftDir()).path}/brouillon.json');
      if (await f.exists()) {
        final j = jsonDecode(await f.readAsString()) as Map<String, dynamic>;
        final c = (j['contract'] as Map?) ?? {};
        String t(Object? v) => v is String ? v : '';
        title.text = t(j['title']); price.text = t(j['price']); area.text = t(j['area']); desc.text = t(j['desc']);
        minDuration.text = t(c['minDuration']); notice.text = t(c['notice']); deposit.text = t(c['deposit']);
        advance.text = t(c['advance']); payDay.text = t(c['payDay']); obligations.text = t(c['obligations']);
        termination.text = t(c['termination']); rules.text = t(c['rules']); extra.text = t(c['extra']);
        contactPhone.text = t(j['contactPhone']); contactWhatsapp.text = t(j['contactWhatsapp']);
        final pl = j['place'] as Map?;
        if (!mounted) return;
        super.setState(() {
          step = (j['step'] as int? ?? 0).clamp(0, 2);
          type = j['type'] as String?;
          beds = j['beds'] as int? ?? 0; baths = j['baths'] as int? ?? 0;
          furnished = j['furnished'] == true; positionExacte = j['exacte'] == true;
          lat = (j['lat'] as num?)?.toDouble(); lng = (j['lng'] as num?)?.toDouble();
          (j['amen'] as Map? ?? {}).forEach((k, v) { if (amen.containsKey(k)) amen[k as String] = v == true; });
          charges..clear()..addAll(((j['charges'] as List?) ?? []).cast<String>());
          photos..clear()..addAll(((j['photos'] as List?) ?? []).cast<String>().map(File.new).where((f) => f.existsSync()));
          place = pl == null ? null : Place.fromJson(pl);
        });
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(tr(context, 'ap.draftBack')),
          duration: const Duration(seconds: 6),
          action: SnackBarAction(label: 'Recommencer', onPressed: _startOver),
        ));
      }
    } catch (_) {/* brouillon illisible : on repart d'un formulaire vide */}
    _prefillContact();
    _draftReady = true;
  }

  /// Pré-remplit le contact avec les numéros du profil s'ils n'ont pas été saisis.
  void _prefillContact() {
    if (!mounted) return;
    final u = AppScope.of(context).user;
    if (u == null) return;
    if (contactPhone.text.isEmpty) contactPhone.text = _local(u.phone);
    if (contactWhatsapp.text.isEmpty) contactWhatsapp.text = _local(u.whatsapp);
  }

  Future<void> _startOver() async {
    _draftReady = false;
    _saveTimer?.cancel();
    await _saveChain;
    await _clearDraft();
    if (!mounted) return;
    for (final c in _controllers) { c.clear(); }
    super.setState(() {
      step = 0; type = null; place = null; lat = null; lng = null; beds = 0; baths = 0; furnished = false;
      photos.clear(); charges.clear(); amen.updateAll((_, __) => false);
    });
    _prefillContact();
    _draftReady = true;
  }
  static const chargeLabels = {
    'eau': 'ap.chEau', 'electricite': 'ap.chElec', 'internet': 'ap.chNet',
    'ordures': 'ap.chTrash', 'gardiennage': 'ap.chGuard', 'entretien': 'ap.chUpkeep',
  };

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
    if (photos.isEmpty) return tr(context, 'ap.e1');
    return _missingInfo ?? _missingContract;
  }

  String? get _missingInfo {
    if (title.text.trim().isEmpty) return tr(context, 'ap.e2');
    if (type == null) return tr(context, 'ap.e3');
    if (place == null) return tr(context, 'ap.e4');
    if ((int.tryParse(price.text.replaceAll(' ', '')) ?? 0) <= 0) return tr(context, 'ap.e5');
    if (desc.text.trim().isEmpty) return tr(context, 'ap.e6');
    if (_digits(contactPhone.text).length != 8) return tr(context, 'ap.e7');
    final wa = _digits(contactWhatsapp.text);
    if (wa.isNotEmpty && wa.length != 8) return tr(context, 'ap.e8');
    return null;
  }

  /// Bornes identiques au serveur : sinon il refuse avec un message global.
  String? get _missingContract {
    int? n(TextEditingController c) => int.tryParse(c.text.trim());
    if (minDuration.text.trim().isEmpty) return tr(context, 'ap.e9');
    if (notice.text.trim().isEmpty) return tr(context, 'ap.e10');
    final d = n(payDay);
    if (d == null || d < 1 || d > 31) return tr(context, 'ap.e11');
    final cau = n(deposit);
    if (cau == null || cau > 24) return tr(context, 'ap.e12');
    final av = n(advance);
    if (av == null || av > 24) return tr(context, 'ap.e13');
    if (obligations.text.trim().isEmpty) return tr(context, 'ap.e14');
    if (termination.text.trim().isEmpty) return tr(context, 'ap.e15');
    return null;
  }

  Map<String, dynamic> get _contract => {
        'minimumDuration': minDuration.text.trim(),
        'noticePeriod': notice.text.trim(),
        'depositMonths': int.parse(deposit.text.trim()),
        'advanceMonths': int.parse(advance.text.trim()),
        'paymentDay': int.parse(payDay.text.trim()),
        'chargesIncluded': charges.toList(),
        'obligations': obligations.text.trim(),
        'rules': rules.text.split('\n').map((l) => l.trim()).where((l) => l.isNotEmpty).toList(),
        'terminationTerms': termination.text.trim(),
        'extraTerms': extra.text.trim(),
      };

  void _next() {
    if (step == 0) {
      if (photos.isEmpty) { _addPhotos(ImageSource.gallery); return; }
      setState(() => step = 1);
    } else if (step == 1) {
      final m = _missingInfo;
      if (m != null) { ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m))); return; }
      FocusScope.of(context).unfocus();
      setState(() => step = 2);
    } else {
      _submit();
    }
  }

  Future<void> _submit() async {
    final m = _missing;
    if (m != null) { ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m))); return; }
    HapticFeedback.mediumImpact();
    setState(() => sending = true);
    try {
      // Numéros modifiés dans le formulaire → profil mis à jour avant l'annonce,
      // pour que les boutons Appeler / WhatsApp affichent les bons.
      final app = AppScope.of(context);
      final u = app.user;
      final tel = _digits(contactPhone.text), wa = _digits(contactWhatsapp.text);
      if (u != null && (tel != _digits(u.phone) || wa != _digits(u.whatsapp))) {
        app.updateUser(await Api.updateProfile(phone: '+223$tel', whatsapp: wa.isEmpty ? '' : '+223$wa'));
      }
      await Api.createProperty(
        fields: {
          'title': title.text.trim(), 'type': type!, 'description': desc.text.trim(),
          'price': price.text.replaceAll(' ', ''), 'pricePeriod': 'mois',
          'city': place!.city, 'neighborhood': place!.neighborhood,
          if (place!.region != null) 'region': place!.region!,
          'bedrooms': '$beds', 'bathrooms': '$baths', 'area': area.text.isEmpty ? '0' : area.text,
          'furnished': '$furnished',
          'locationPrecision': positionExacte ? 'exact' : 'approx',
        },
        amenities: amen,
        contract: _contract,
        location: lat != null ? {'lat': lat!, 'lng': lng!} : null,
        photos: photos,
      );
      _draftReady = false;
      _saveTimer?.cancel();
      await _saveChain;
      await _clearDraft();
      if (!mounted) return;
      AppScope.of(context).load();
      Navigator.pop(context, true);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr(context, 'ap.sent'))));
    } catch (e) {
      if (!mounted) return;
      _draftReady = true;
      setState(() => sending = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${tr(context, 'err.send')} $e')));
    }
  }

  @override
  void dispose() {
    // Dernière écriture si un enregistrement était en attente
    if (_saveTimer?.isActive ?? false) { _saveTimer!.cancel(); _flushDraft(); }
    for (final c in [title, price, area, desc, minDuration, notice, deposit, advance, payDay, obligations, termination, rules, extra]) {
      c.dispose();
    }
    super.dispose();
  }

  /// Quelque chose a déjà été saisi : le perdre d'un geste serait frustrant.
  bool get _dirty => photos.isNotEmpty || title.text.isNotEmpty || desc.text.isNotEmpty || price.text.isNotEmpty
      || minDuration.text.isNotEmpty || obligations.text.isNotEmpty || termination.text.isNotEmpty;

  /// Retour (bouton, geste ou touche Android) : étape précédente ; à la
  /// première étape on sort, et le brouillon garde la saisie pour plus tard.
  Future<void> _back() async {
    if (sending) return;
    if (step > 0) { setState(() => step--); return; }
    final messenger = ScaffoldMessenger.of(context);
    final saved = _dirty;
    _saveTimer?.cancel();
    _flushDraft();
    Navigator.pop(context);
    if (saved) {
      messenger.showSnackBar(SnackBar(content: Text(tr(context, 'ap.draftSaved'))));
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) { if (!didPop) _back(); },
      child: Scaffold(
        backgroundColor: J.surface,
        body: SafeArea(
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Column(children: [
                Row(children: [
                  IconButton(onPressed: _back,
                      icon: Icon(step == 0 ? Icons.close_rounded : Icons.arrow_back_rounded)),
                  Expanded(child: Text(tr(context, 'ap.new'), style: J.ui(18, w: FontWeight.w800))),
                  Text('${step + 1}/3', style: J.ui(13, c: J.leaf, w: FontWeight.w700)),
                ]),
                const SizedBox(height: 10),
                ClipRRect(borderRadius: BorderRadius.circular(3), child: TweenAnimationBuilder<double>(
                  tween: Tween(end: (step + 1) / 3), duration: const Duration(milliseconds: 350),
                  builder: (_, v, __) => LinearProgressIndicator(value: v, minHeight: 6, color: J.leaf, backgroundColor: J.x(0xFFE6F0EA)),
                )),
              ]),
            ),
            Expanded(child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              transitionBuilder: (c, a) => FadeTransition(opacity: a, child: SlideTransition(position: Tween(begin: const Offset(.06, 0), end: Offset.zero).animate(a), child: c)),
              child: step == 0 ? _photosStep() : step == 1 ? _infoStep() : _contractStep(),
            )),
          ]),
        ),
        bottomNavigationBar: SafeArea(
          minimum: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: Pressable(
            onTap: sending ? null : _next,
            child: Container(
              height: 56, alignment: Alignment.center,
              decoration: BoxDecoration(color: J.leaf, borderRadius: BorderRadius.circular(18)),
              child: sending
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                  : Text(step == 0 ? (photos.isEmpty ? tr(context, 'ap.addPhotos') : tr(context, 'ap.continue')) : step == 1 ? tr(context, 'ap.continueContract') : tr(context, 'ap.submit'), style: J.ui(16, c: Colors.white, w: FontWeight.w700)),
            ),
          ),
        ),
      ));

  Widget _photosStep() => ListView(key: const ValueKey(0), padding: const EdgeInsets.fromLTRB(20, 18, 20, 20), children: [
        Text(tr(context, 'ap.photos'), style: J.ui(24, w: FontWeight.w800)),
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
          Expanded(child: _srcBtn(Icons.photo_camera_outlined, tr(context, 'ap.camera'), () => _addPhotos(ImageSource.camera))),
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
        _label(tr(context, 'ap.title')),
        _field(title, tr(context, 'ap.titlePh')),
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
            decoration: BoxDecoration(color: place != null ? J.x(0xFFF4F7F5) : J.x(0xFFF8F6F1), borderRadius: BorderRadius.circular(16),
                border: Border.all(color: place != null ? J.leaf : J.soft, width: 1.5)),
            child: Row(children: [
              Icon(Icons.location_on_rounded, color: place != null ? J.leaf : J.clay300),
              const SizedBox(width: 10),
              Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'ap.placeSub'), style: J.ui(11, c: J.clay500)),
                Text(place?.label ?? 'Choisir…', style: J.ui(14, w: FontWeight.w700)),
              ])),
              Icon(Icons.expand_more_rounded, color: J.clay500),
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
            decoration: BoxDecoration(color: lat != null ? J.x(0xFFE6F0EA) : J.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: lat != null ? J.leaf : J.soft, width: 1.5)),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(lat != null ? Icons.check_circle_rounded : Icons.my_location_rounded, size: 20, color: J.leaf),
              const SizedBox(width: 8),
              Text(lat != null ? tr(context, 'ap.gpsOk') : tr(context, 'ap.gpsHere'), style: J.ui(13, w: FontWeight.w700)),
            ]),
          ),
        ),
        if (lat != null)
          SwitchListTile(
            contentPadding: EdgeInsets.zero, value: positionExacte, activeThumbColor: J.leaf,
            onChanged: (v) => setState(() => positionExacte = v),
            title: Text(AppScope.of(context).t('add.exact'), style: J.ui(14.5, w: FontWeight.w700)),
            subtitle: Text(AppScope.of(context).t('add.exactSub'), style: J.ui(12.5, c: J.clay500, h: 1.4)),
          ),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_label(tr(context, 'ap.rent')), _field(price, '0', suffix: 'FCFA', number: true)])),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_label(tr(context, 'ap.area')), _field(area, '0', suffix: 'm²', number: true)])),
        ]),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(child: _stepper(tr(context, 'ap.beds'), beds, (v) => setState(() => beds = v))),
          const SizedBox(width: 10),
          Expanded(child: _stepper(tr(context, 'ap.baths'), baths, (v) => setState(() => baths = v))),
        ]),
        const SizedBox(height: 12),
        SwitchListTile(contentPadding: EdgeInsets.zero, value: furnished, activeColor: J.leaf, onChanged: (v) => setState(() => furnished = v),
            title: Text(tr(context, 'sc.furnished'), style: J.ui(15, w: FontWeight.w700))),
        _label(tr(context, 'ap.amenities')),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final k in amenityKeys) _chip(AppScope.of(context).amenityLabel(k), amenityIcons[k]!, amen[k]!, () => setState(() => amen[k] = !amen[k]!)),
        ]),
        const SizedBox(height: 16),
        _label(tr(context, 'ap.desc')),
        _field(desc, tr(context, 'ap.descPh'), lines: 4),
        const SizedBox(height: 22),
        Text('Contact', style: J.ui(16, w: FontWeight.w800)),
        const SizedBox(height: 4),
        Text(tr(context, 'ap.contactInfo'),
            style: J.ui(13, c: J.clay500, h: 1.45)),
        const SizedBox(height: 12),
        _label('Téléphone'),
        _field(contactPhone, '70 00 00 00', prefix: '+223', phone: true),
        const SizedBox(height: 12),
        _label(tr(context, 'ap.waOpt')),
        _field(contactWhatsapp, '76 00 00 00', prefix: '+223', phone: true),
        const SizedBox(height: 8),
        Text(tr(context, 'ap.waInfo'),
            style: J.ui(12, c: J.clay500, h: 1.45)),
      ]);

  /// Étape 3 — le contrat de location, présenté article par article comme sur le site.
  Widget _contractStep() {
    final loyer = int.tryParse(price.text.replaceAll(' ', '')) ?? 0;
    final mois = (int.tryParse(deposit.text) ?? 0) + (int.tryParse(advance.text) ?? 0);
    return ListView(key: const ValueKey(2), padding: const EdgeInsets.fromLTRB(20, 18, 20, 20), children: [
      Text(tr(context, 'ap.contract'), style: J.ui(24, w: FontWeight.w800)),
      const SizedBox(height: 4),
      Text(tr(context, 'ap.contractSub'),
          style: J.ui(14, c: J.clay500, w: FontWeight.w400, h: 1.5)),
      _article('2', tr(context, 'ap.a2')),
      Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_label(tr(context, 'ap.minDur')), _field(minDuration, '12 mois')])),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_label('Préavis'), _field(notice, '1 mois')])),
      ]),
      _article('3', tr(context, 'ap.a3')),
      Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_label(tr(context, 'ap.payDay')), _field(payDay, '5', number: true, onChanged: true)])),
        const SizedBox(width: 8),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_label(tr(context, 'ap.deposit')), _field(deposit, '2', suffix: 'mois', number: true, onChanged: true)])),
        const SizedBox(width: 8),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_label(tr(context, 'ap.advance')), _field(advance, '3', suffix: 'mois', number: true, onChanged: true)])),
      ]),
      if (loyer > 0 && mois > 0) ...[
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(color: J.x(0xFFFBF6EA), borderRadius: BorderRadius.circular(14)),
          child: Text(tr(context, 'ap.toPay').replaceAll('{v}', _fcfa(loyer * mois)).replaceAll('{m}', '$mois'), style: J.ui(13, w: FontWeight.w700)),
        ),
      ],
      const SizedBox(height: 12),
      _label(tr(context, 'ap.charges')),
      Wrap(spacing: 6, runSpacing: 6, children: [
        for (final e in chargeLabels.entries)
          _chip(tr(context, e.value), charges.contains(e.key) ? Icons.check_rounded : Icons.add_rounded, charges.contains(e.key),
              () => setState(() => charges.contains(e.key) ? charges.remove(e.key) : charges.add(e.key))),
      ]),
      const SizedBox(height: 6),
      Text(tr(context, 'ap.chargesInfo'), style: J.ui(12, c: J.clay500)),
      _article('4', tr(context, 'ap.a4')),
      _field(obligations, 'Ex. le bailleur garantit l\'accès à l\'eau et à l\'électricité et prend en charge les grosses réparations. Le locataire entretient le logement et paie à la date convenue.', lines: 5),
      const SizedBox(height: 12),
      _label(tr(context, 'ap.rules')),
      _field(rules, 'Pas d\'animaux\nPas de musique après 22 h', lines: 3),
      _article('5', 'Résiliation'),
      _field(termination, 'Ex. en cas de deux mois d\'impayés, de dégradation ou de sous-location non autorisée, le bail peut être résilié après mise en demeure de 15 jours.', lines: 4),
      _article('6', tr(context, 'ap.a6')),
      _field(extra, tr(context, 'ap.a6Ph'), lines: 3),
      const SizedBox(height: 14),
      Text(tr(context, 'ap.legal'),
          style: J.ui(12, c: J.clay500, h: 1.45)),
    ]);
  }

  Widget _article(String n, String t) => Padding(
        padding: const EdgeInsets.only(top: 22, bottom: 10),
        child: Text('$n. $t', style: J.ui(16, w: FontWeight.w800)),
      );

  static String _fcfa(int v) => v.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ' ');

  Widget _label(String t) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(t, style: J.ui(13, c: J.clay600, w: FontWeight.w600)));

  Widget _field(TextEditingController c, String hint, {String? suffix, String? prefix, bool number = false, bool phone = false, int lines = 1, bool onChanged = false}) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(color: J.x(0xFFF8F6F1), borderRadius: BorderRadius.circular(16), border: Border.all(color: J.soft, width: 1.5)),
        child: Row(children: [
          if (prefix != null) ...[Text(prefix, style: J.ui(15, w: FontWeight.w700)), const SizedBox(width: 10)],
          Expanded(child: TextField(controller: c, maxLines: lines, onChanged: onChanged ? (_) => setState(() {}) : null,
              keyboardType: number ? TextInputType.number : phone ? TextInputType.phone : TextInputType.text,
              inputFormatters: number ? [FilteringTextInputFormatter.digitsOnly] : phone ? [FilteringTextInputFormatter.allow(RegExp(r'[0-9 ]'))] : null,
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
          decoration: BoxDecoration(color: on ? J.leaf : J.surface, borderRadius: BorderRadius.circular(999), border: Border.all(color: on ? J.leaf : J.soft, width: 1.5)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(i, size: 17, color: on ? J.onInk : J.ink), const SizedBox(width: 5), Text(l, style: J.ui(13, c: on ? J.onInk : J.ink, w: FontWeight.w600))]),
        ),
      );

  Widget _stepper(String l, int v, ValueChanged<int> on) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _label(l),
        Container(
          height: 52, padding: const EdgeInsets.symmetric(horizontal: 6),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: J.soft, width: 1.5)),
          child: Row(children: [
            _sq(Icons.remove_rounded, J.x(0xFFF5F1E8), J.ink, () => on(v > 0 ? v - 1 : 0)),
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
                child: Container(width: 28, height: 28, decoration: BoxDecoration(color: J.night.withOpacity(.6), shape: BoxShape.circle), child: const Icon(Icons.close_rounded, size: 16, color: Colors.white)),
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
                decoration: BoxDecoration(color: J.x(0xFFF4F7F5), borderRadius: BorderRadius.circular(18), border: Border.all(color: J.x(0xFFB9D3C2), width: 2)),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.add_a_photo_outlined, color: J.leaf, size: big ? 36 : 26),
                  if (big) ...[const SizedBox(height: 8), Text(tr(context, 'ap.mainPhoto'), style: J.ui(14, w: FontWeight.w700)), Text(tr(context, 'ap.tapAdd'), style: J.ui(12, c: J.clay500))],
                ]),
              ),
            );

        return Wrap(spacing: 10, runSpacing: 10, children: [
          for (var i = 0; i < photos.length; i++) tile(i),
          if (onAdd != null) addTile(photos.isEmpty),
        ]);
      });
}
