import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../data/geo.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'property_card.dart';
import 'location_picker.dart' show currentPlace;

/* Fond de carte OpenStreetMap : libre, sans clé. Sa politique d'usage exige
   un identifiant d'application et la mention des contributeurs. */
TileLayer _fond() => TileLayer(
      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      userAgentPackageName: 'ml.jigiso.app',
      maxZoom: 19,
    );

Widget _attribution() => const SimpleAttributionWidget(source: Text('OpenStreetMap'));

/// Fond de carte et mention OSM, pour les autres cartes de l'app
TileLayer fondCarte() => _fond();
Widget attributionCarte() => _attribution();

/// Ouvre l'itinéraire vers une annonce dans l'application de cartes du
/// téléphone (Google Maps sur Android). Seules les coordonnées du logement
/// sont transmises ; la position de la personne, Maps la demande lui-même.
Future<void> ouvrirItineraire(BuildContext context, Property p) async {
  final s = AppScope.of(context);
  final ok = await launchUrl(
    Uri.parse('https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}'),
    mode: LaunchMode.externalApplication,
  );
  if (!ok && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.t('dir.fail'))));
  }
}

/// Carte des résultats : une étiquette de prix par annonce géolocalisée.
/// Toucher une étiquette affiche l'annonce en bas ; la toucher ouvre le détail.
class ResultsMap extends StatefulWidget {
  final List<Property> annonces;
  final void Function(Property) ouvrir;
  /// Vrai tant qu'un doigt est posé sur la carte : la page qui la contient
  /// doit alors cesser de défiler, sinon elle « vole » le geste (zoom, glisser).
  final ValueChanged<bool>? surCarte;
  const ResultsMap({super.key, required this.annonces, required this.ouvrir, this.surCarte});
  @override
  State<ResultsMap> createState() => _ResultsMapState();
}

class _ResultsMapState extends State<ResultsMap> {
  Property? choisie;
  final carte = MapController();
  bool localisation = false;
  int _doigts = 0;

  void _zoom(double pas) {
    final c = carte.camera;
    carte.move(c.center, (c.zoom + pas).clamp(4.0, 18.0));
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final placees = widget.annonces.where((p) => p.aPosition).toList();
    final sansPosition = widget.annonces.length - placees.length;
    final ref = s.pointRef;

    // Cadrage : toutes les annonces (et le point de référence s'il existe)
    final points = [for (final p in placees) LatLng(p.lat!, p.lng!), if (ref != null) LatLng(ref.lat, ref.lng)];
    void toucherFond(TapPosition _, LatLng __) => setState(() => choisie = null);
    // Sans aucun point : Bamako. Un seul : centré dessus. Plusieurs : tous visibles.
    final cadre = points.isEmpty
        ? MapOptions(initialCenter: const LatLng(12.6392, -8.0029), initialZoom: 12, onTap: toucherFond)
        : points.length == 1
            ? MapOptions(initialCenter: points.first, initialZoom: 15, onTap: toucherFond)
            : MapOptions(onTap: toucherFond,
                initialCameraFit: CameraFit.coordinates(coordinates: points, padding: const EdgeInsets.all(48), maxZoom: 16));

    return Column(children: [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: SizedBox(
            height: 420,
            child: Stack(children: [
            // Doigt sur la carte : la page ne défile plus, la carte reçoit le geste
            Listener(
              onPointerDown: (_) { if (_doigts++ == 0) widget.surCarte?.call(true); },
              onPointerUp: (_) { if (--_doigts <= 0) { _doigts = 0; widget.surCarte?.call(false); } },
              onPointerCancel: (_) { _doigts = 0; widget.surCarte?.call(false); },
              child: FlutterMap(
              mapController: carte,
              options: cadre,
              children: [
                _fond(),
                MarkerLayer(markers: [
                  if (ref != null)
                    Marker(
                      point: LatLng(ref.lat, ref.lng), width: 44, height: 44,
                      child: Semantics(
                        label: ref.label,
                        child: Container(
                          decoration: BoxDecoration(color: J.river.withValues(alpha: .18), shape: BoxShape.circle),
                          alignment: Alignment.center,
                          child: Container(width: 20, height: 20, decoration: BoxDecoration(color: J.river, shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 3),
                              boxShadow: const [BoxShadow(color: Color(0x55000000), blurRadius: 4)])),
                        ),
                      ),
                    ),
                  for (final p in placees)
                    Marker(
                      point: LatLng(p.lat!, p.lng!), width: 92, height: 34,
                      child: GestureDetector(
                        onTap: () => setState(() => choisie = p),
                        child: Semantics(
                          button: true, label: '${p.title}, ${fcfa(p.price)} FCFA',
                          child: Container(
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: choisie?.id == p.id ? J.ink : J.surface,
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: J.ink, width: 1.5),
                              boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 6, offset: Offset(0, 2))],
                            ),
                            child: MediaQuery.withNoTextScaling(child: Text(
                              _prixCourt(p.price),
                              style: J.ui(12.5, w: FontWeight.w800, c: choisie?.id == p.id ? J.cream : J.ink),
                            )),
                          ),
                        ),
                      ),
                    ),
                ]),
                _attribution(),
              ],
            ),
            ),
            // Zoom : boutons + et −, en plus du pincement à deux doigts
            Positioned(
              right: 12, top: 12,
              child: Container(
                decoration: BoxDecoration(color: J.surface, borderRadius: BorderRadius.circular(14),
                    boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 6)]),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  IconButton(tooltip: s.t('map.zoomIn'), icon: const Icon(Icons.add_rounded), onPressed: () => _zoom(1)),
                  const SizedBox(width: 30, child: Divider(height: 1)),
                  IconButton(tooltip: s.t('map.zoomOut'), icon: const Icon(Icons.remove_rounded), onPressed: () => _zoom(-1)),
                ]),
              ),
            ),
            // « Ma position » : point bleu et carte recentrée, sans changer la recherche
            Positioned(
              right: 12, bottom: 34,
              child: Semantics(
                button: true, label: s.t('map.me'),
                child: FloatingActionButton.small(
                  heroTag: 'ma-position',
                  backgroundColor: J.surface, foregroundColor: J.river,
                  onPressed: localisation ? null : () async {
                    setState(() => localisation = true);
                    final p = await currentPlace(context);
                    if (!mounted) return;
                    setState(() => localisation = false);
                    if (p == null) return;
                    // La carte est recréée sur ce nouveau point (clé = point de référence)
                    s.setPositionUtilisateur(p.lat!, p.lng!);
                  },
                  child: localisation
                      ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.5, color: J.river))
                      : const Icon(Icons.my_location_rounded),
                ),
              ),
            ),
            ]),
          ),
        ),
      ),
      if (placees.isEmpty)
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 10, 24, 0),
          child: Text(s.t('map.none'), style: J.ui(12.5, c: J.clay500)),
        ),
      if (placees.any((p) => p.positionApprochee))
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 10, 24, 0),
          child: Text(s.t('map.approx'), style: J.ui(12.5, c: J.clay500)),
        ),
      if (sansPosition > 0 && placees.isNotEmpty)
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 10, 24, 0),
          child: Text('$sansPosition ${s.t(sansPosition > 1 ? 'map.noLocN' : 'map.noLoc1')}',
              style: J.ui(12.5, c: J.clay500)),
        ),
      if (choisie != null)
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
          child: ListingCard(choisie!, onTap: () => widget.ouvrir(choisie!)),
        ),
    ]);
  }

  /// « 150 000 » → « 150k » : l'étiquette doit tenir sur la carte.
  static String _prixCourt(int prix) =>
      prix >= 1000000 ? '${(prix / 1000000).toStringAsFixed(1).replaceAll('.0', '')} M' : '${(prix / 1000).round()}k';
}

/// Emplacement d'une annonce : petite carte, distance et bouton d'itinéraire.
class LocationCard extends StatelessWidget {
  final Property p;
  /// Faux en mode économie de données : on garde distance et itinéraire, sans télécharger la carte
  final bool avecCarte;
  const LocationCard(this.p, {super.key, this.avecCarte = true});

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final point = LatLng(p.lat!, p.lng!);
    final d = s.distanceDe(p);
    final approx = p.positionApprochee;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(s.t('loc.t'), style: J.mono(10)),
      const SizedBox(height: 10),
      if (avecCarte) ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: SizedBox(
          height: 190,
          // Carte figée : elle situe, le bouton « Itinéraire » sert à s'y rendre
          // Clé : si l'adresse exacte arrive après le point approché, la carte se recentre
          child: FlutterMap(
            key: ValueKey('${point.latitude},${point.longitude},$approx'),
            options: MapOptions(initialCenter: point, initialZoom: approx ? 14.2 : 15,
                interactionOptions: const InteractionOptions(
                    flags: InteractiveFlag.pinchZoom | InteractiveFlag.doubleTapZoom)),
            children: [
              _fond(),
              // Position approchée : un secteur, jamais une épingle qui ferait croire à l'adresse
              if (approx)
                CircleLayer(circles: [
                  CircleMarker(point: point, radius: 400, useRadiusInMeter: true,
                      color: J.gold.withValues(alpha: .18), borderColor: J.gold, borderStrokeWidth: 2),
                ])
              else
                MarkerLayer(markers: [
                  Marker(point: point, width: 40, height: 40,
                      child: const Icon(Icons.location_on, size: 40, color: J.gold)),
                ]),
              _attribution(),
            ],
          ),
        ),
      ),
      const SizedBox(height: 8),
      if (approx) ...[
        Row(children: [
          Icon(Icons.shield_outlined, size: 16, color: J.goldDeep),
          const SizedBox(width: 6),
          Text(s.t('loc.approxT'), style: J.ui(13.5, c: J.goldDeep, w: FontWeight.w700)),
        ]),
        const SizedBox(height: 2),
        Text(s.t('loc.approxSub'), style: J.ui(12.5, c: J.clay500, h: 1.4)),
        if (d != null) Text('${formatDistance(d)} ${s.t('dist.from')} ${s.pointRef!.label}', style: J.ui(12.5, c: J.clay500)),
      ] else
        Text([
          if (d != null) '${formatDistance(d)} ${s.t('dist.from')} ${s.pointRef!.label}',
          s.t('loc.exact'),
        ].join(' · '), style: J.ui(12.5, c: J.clay500)),
      const SizedBox(height: 10),
      Pressable(
        onTap: () => ouvrirItineraire(context, p),
        child: Container(
          height: 50,
          decoration: BoxDecoration(color: J.ink, borderRadius: BorderRadius.circular(16)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.directions_rounded, color: J.gold),
            const SizedBox(width: 8),
            Text(s.t(approx ? 'dir.zone' : 'dir.go'), style: J.ui(15, c: J.onInk, w: FontWeight.w700)),
          ]),
        ),
      ),
    ]);
  }
}
