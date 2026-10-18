import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme.dart';

const typeIcons = {
  'maison': Icons.home_outlined, 'appartement': Icons.apartment_rounded, 'studio': Icons.bed_outlined,
  'chambre': Icons.door_front_door_outlined, 'villa': Icons.villa_outlined, 'bureau': Icons.work_outline_rounded,
  'terrain': Icons.landscape_outlined,
};

/// Photo d'annonce, ou hachures teintées par type si l'annonce n'en a pas
class PropertyPhoto extends StatelessWidget {
  final Property p;
  final int index;
  const PropertyPhoto(this.p, {super.key, this.index = 0});
  @override
  Widget build(BuildContext context) {
    final tint = J.typeTint[p.type] ?? J.clay600;
    final label = p.photoLabels.isNotEmpty ? 'photo · ${p.photoLabels[index % p.photoLabels.length]}' : null;
    if (p.images.isEmpty) return Hatch(color: tint, label: label);
    return Image.network(p.images[index % p.images.length], fit: BoxFit.cover,
        loadingBuilder: (c, child, prog) => prog == null ? child : Hatch(color: tint),
        errorBuilder: (_, __, ___) => Hatch(color: tint));
  }
}

class HeartButton extends StatefulWidget {
  final String id;
  final double size;
  const HeartButton(this.id, {super.key, this.size = 44});
  @override
  State<HeartButton> createState() => _HeartButtonState();
}

class _HeartButtonState extends State<HeartButton> with SingleTickerProviderStateMixin {
  late final c = AnimationController(vsync: this, duration: const Duration(milliseconds: 420));
  @override
  void dispose() { c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final on = s.isFav(widget.id);
    return GestureDetector(
      onTap: () { HapticFeedback.lightImpact(); s.toggleFav(widget.id); c.forward(from: 0); },
      child: AnimatedBuilder(
        animation: c,
        builder: (_, child) => Transform.scale(scale: 1 + .3 * Curves.elasticOut.transform(c.value) * (1 - c.value), child: child),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          width: widget.size, height: widget.size,
          decoration: BoxDecoration(shape: BoxShape.circle, color: on ? J.terracotta : J.cream.withOpacity(.92)),
          child: Icon(on ? Icons.favorite_rounded : Icons.favorite_border_rounded, size: widget.size * .42, color: on ? J.cream : J.clay500),
        ),
      ),
    );
  }
}

class Tag extends StatelessWidget {
  final String text;
  final Color bg, fg;
  const Tag(this.text, {super.key, required this.bg, required this.fg});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
        child: Text(text, style: J.mono(10, c: fg)),
      );
}

/// Carte d'annonce — pastille du loyer à cheval sur la photo, comme le site
class PropertyCard extends StatelessWidget {
  final Property p;
  final VoidCallback onTap;
  const PropertyCard(this.p, {super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final specs = [
      if (p.bedrooms > 0) '${p.bedrooms} ${s.t('ch')}',
      if (p.area > 0) '${p.area} m²',
      s.t(p.furnished ? 'furnished' : 'unfurnished'),
    ].join('  ·  ');
    return Pressable(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(color: J.card, borderRadius: BorderRadius.circular(16), boxShadow: J.cardShadow),
        clipBehavior: Clip.antiAlias,
        child: Column(children: [
          SizedBox(
            height: 210,
            child: Stack(fit: StackFit.expand, children: [
              Hero(tag: 'photo-${p.id}', child: PropertyPhoto(p)),
              Positioned(top: 12, left: 12, child: p.reserved
                  ? Tag(s.t('reserved'), bg: J.gold, fg: J.ink)
                  : p.approved ? Tag(s.t('verified'), bg: J.leaf, fg: J.cream) : const SizedBox()),
              Positioned(top: 10, right: 10, child: HeartButton(p.id)),
            ]),
          ),
          Transform.translate(
            offset: const Offset(0, -36),
            child: Container(
              width: 74, height: 74,
              decoration: BoxDecoration(color: J.ink, shape: BoxShape.circle, border: Border.all(color: J.card, width: 4)),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text('${(p.price / 1000).round()}k', style: J.serif(16, c: J.cream)),
                const SizedBox(height: 3),
                Text('FCFA/${s.t('month')}'.toUpperCase(), style: J.mono(7.5, c: J.clay200)),
              ]),
            ),
          ),
          Transform.translate(
            offset: const Offset(0, -26),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Column(children: [
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(typeIcons[p.type], size: 12, color: J.goldDeep),
                  const SizedBox(width: 5),
                  Text(s.typeLabel(p.type).toUpperCase(), style: J.mono(10, c: J.goldDeep)),
                  if (p.rating > 0) Text('  · ${p.rating.toStringAsFixed(1).replaceAll('.', ',')}★', style: J.sans(11, c: J.clay300)),
                ]),
                const SizedBox(height: 6),
                Text(p.title, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: J.serif(20, h: 1.2)),
                const SizedBox(height: 5),
                Text('${p.neighborhood} · ${p.city}', style: J.sans(13, c: J.clay500)),
                const SizedBox(height: 10),
                Text(specs, style: J.sans(13, c: J.clay500)),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

/// Grande carte d'annonce — photo en tête, informations dessous.
///
/// Inspirée des listes de locations grand public : la photo occupe l'essentiel,
/// le reste tient en trois lignes lisibles d'un coup d'œil. Rien n'est affiché
/// qui ne vienne de l'annonce : la note n'apparaît que si le logement a été
/// évalué, jamais un « 0 » ou une moyenne inventée.
class ListingCard extends StatefulWidget {
  final Property p;
  final VoidCallback onTap;
  const ListingCard(this.p, {super.key, required this.onTap});
  @override
  State<ListingCard> createState() => _ListingCardState();
}

class _ListingCardState extends State<ListingCard> {
  final _pages = PageController();
  int _i = 0;

  @override
  void dispose() { _pages.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final p = widget.p;
    final n = p.photoCount;

    return Pressable(
      onTap: widget.onTap,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: AspectRatio(
            aspectRatio: 1.08,
            child: Stack(children: [
              Positioned.fill(child: PageView.builder(
                controller: _pages,
                itemCount: n,
                onPageChanged: (i) => setState(() => _i = i),
                itemBuilder: (_, i) => PropertyPhoto(p, index: i),
              )),
              Positioned(top: 10, right: 10, child: HeartButton(p.id, size: 38)),
              if (p.reserved)
                Positioned(top: 14, left: 14, child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: J.gold, borderRadius: BorderRadius.circular(999)),
                  child: Text(s.t('reserved'), style: J.ui(10, w: FontWeight.w800, c: J.ink)),
                )),
              /* Points de défilement : seulement s'il y a plusieurs photos —
                 un point unique ne dit rien et encombre l'image. */
              if (n > 1) Positioned(
                bottom: 12, left: 0, right: 0,
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  for (var i = 0; i < (n > 5 ? 5 : n); i++) ...[
                    if (i > 0) const SizedBox(width: 5),
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: i == _i % 5 ? 7 : 6, height: i == _i % 5 ? 7 : 6,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withOpacity(i == _i % 5 ? 1 : .55),
                      ),
                    ),
                  ],
                ]),
              ),
            ]),
          ),
        ),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: Text('${p.neighborhood}, ${p.city}',
              maxLines: 1, overflow: TextOverflow.ellipsis,
              style: J.ui(15.5, w: FontWeight.w700))),
          // La note ne s'affiche que si le logement a réellement été évalué.
          if (p.rating > 0) ...[
            const SizedBox(width: 8),
            const Icon(Icons.star_rounded, size: 16, color: J.ink),
            const SizedBox(width: 3),
            Text(p.rating.toStringAsFixed(2).replaceAll('.', ','), style: J.ui(14, w: FontWeight.w600)),
          ],
        ]),
        const SizedBox(height: 3),
        Text(p.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: J.ui(14, c: J.clay500)),
        const SizedBox(height: 2),
        Text([
          if (p.bedrooms > 0) '${p.bedrooms} ${s.t(p.bedrooms > 1 ? 'beds' : 'bed').toLowerCase()}',
          if (p.bathrooms > 0) '${p.bathrooms} ${s.t(p.bathrooms > 1 ? 'baths' : 'bath').toLowerCase()}',
          if (p.area > 0) '${p.area} m²',
        ].join(' · '), style: J.ui(14, c: J.clay500)),
        const SizedBox(height: 6),
        Text.rich(TextSpan(
          text: '${fcfa(p.price)} FCFA',
          style: J.ui(15, w: FontWeight.w800),
          children: [TextSpan(text: ' / ${s.t('month')}', style: J.ui(14, c: J.clay500, w: FontWeight.w400))],
        )),
      ]),
    );
  }
}
