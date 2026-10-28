import 'dart:math';

/// Distance à vol d'oiseau entre deux points GPS, en kilomètres (formule de
/// haversine). La distance par la route est plus longue : l'interface dit
/// donc toujours « environ ».
double distanceKm(double lat1, double lng1, double lat2, double lng2) {
  const r = 6371.0;
  double rad(double d) => d * pi / 180;
  final dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  final a = pow(sin(dLat / 2), 2) + cos(rad(lat1)) * cos(rad(lat2)) * pow(sin(dLng / 2), 2);
  return 2 * r * asin(sqrt(a));
}

/// « ≈ 850 m », « ≈ 2,4 km », « ≈ 35 km ».
String formatDistance(double km) {
  if (km < 1) return '≈ ${(km * 1000 / 50).round() * 50} m';
  if (km < 10) return '≈ ${km.toStringAsFixed(1).replaceAll('.', ',')} km';
  return '≈ ${km.round()} km';
}
