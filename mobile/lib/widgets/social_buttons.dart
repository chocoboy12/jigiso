import 'package:flutter/material.dart';
import '../theme.dart';
import '../state/app_state.dart';
import 'dart:io' show Platform;

/// Boutons Google / Facebook / Apple.
/// Côté natif, brancher : google_sign_in, flutter_facebook_auth, sign_in_with_apple
/// puis envoyer le jeton obtenu à Api.socialLogin(provider, token).
enum SocialProvider { google, facebook, apple }

class SocialButtons extends StatelessWidget {
  final bool compact; // true = rangée d'icônes (inscription), false = boutons pleine largeur (connexion)
  final void Function(SocialProvider) onTap;
  const SocialButtons({super.key, this.compact = false, required this.onTap});

  static Widget icon(SocialProvider p, double s) => switch (p) {
        SocialProvider.google => SizedBox(width: s, height: s, child: Center(child: Text('G',
            style: TextStyle(fontSize: s * .95, fontWeight: FontWeight.w800, height: 1,
                foreground: Paint()..shader = const LinearGradient(colors: [Color(0xFF4285F4), Color(0xFFEA4335), Color(0xFFFBBC05), Color(0xFF34A853)],
                    stops: [.25, .5, .7, .9]).createShader(Rect.fromLTWH(0, 0, s, s)))))),
        SocialProvider.facebook => Icon(Icons.facebook_rounded, size: s, color: const Color(0xFF1877F2)),
        SocialProvider.apple => Icon(Icons.apple, size: s, color: Colors.white),
      };

  static const labels = {SocialProvider.google: 'Google', SocialProvider.facebook: 'Facebook', SocialProvider.apple: 'Apple'};

  @override
  Widget build(BuildContext context) {
    Widget btn(SocialProvider p) {
      final dark = p == SocialProvider.apple;
      return Pressable(
        onTap: () => onTap(p),
        child: Container(
          height: compact ? 50 : 52,
          decoration: BoxDecoration(color: dark ? Colors.black : J.surface, borderRadius: BorderRadius.circular(16),
              border: dark ? null : Border.all(color: J.soft, width: 1.5)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            icon(p, compact ? 22 : 20),
            if (!compact) ...[
              const SizedBox(width: 10),
              Text('Continuer avec ${labels[p]}', style: J.ui(15, c: dark ? J.onInk : J.ink, w: FontWeight.w700)),
            ],
          ]),
        ),
      );
    }

    final cfg = AppScope.of(context).config;
    final ps = SocialProvider.values.where((p) => cfg.flag(p.name) && (p != SocialProvider.apple || Platform.isIOS || cfg.flag('appleOnAndroid'))).toList();
    if (ps.isEmpty) return const SizedBox.shrink();
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Row(children: [
        Expanded(child: Divider(color: J.soft)),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: Text(compact ? 'ou s\'inscrire avec' : 'ou', style: J.ui(13, c: J.clay300))),
        Expanded(child: Divider(color: J.soft)),
      ]),
      const SizedBox(height: 14),
      if (compact)
        Row(children: [for (var i = 0; i < ps.length; i++) ...[if (i > 0) const SizedBox(width: 10), Expanded(child: btn(ps[i]))]])
      else
        for (var i = 0; i < ps.length; i++) ...[if (i > 0) const SizedBox(height: 10), btn(ps[i])],
    ]);
  }
}
