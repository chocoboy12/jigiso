import 'package:flutter/material.dart';
import 'dart:io' show Platform;
import 'package:url_launcher/url_launcher.dart';
import '../state/app_state.dart';
import '../theme.dart';

/// Écrans imposés par l'admin : maintenance et mise à jour obligatoire
class AppGate extends StatelessWidget {
  final Widget child;
  const AppGate({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final c = s.config;
    return Stack(children: [
      child,
      if (c.maintenance)
        Positioned.fill(child: Material(
          color: J.ink,
          child: SafeArea(child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Container(width: 72, height: 72, decoration: const BoxDecoration(color: J.gold, shape: BoxShape.circle),
                  child: const Icon(Icons.construction_rounded, color: J.night, size: 34)),
              const SizedBox(height: 20),
              Text(tr(context, 'gate.maint'), style: J.ui(24, c: J.cream, w: FontWeight.w800)),
              const SizedBox(height: 10),
              Text(c.maintenanceMessage, textAlign: TextAlign.center, style: J.ui(15, c: J.line, w: FontWeight.w400, h: 1.5)),
              const SizedBox(height: 28),
              TextButton(onPressed: s.load, child: Text('Réessayer', style: J.ui(15, c: J.gold, w: FontWeight.w700))),
            ]),
          )),
        ))
      else if (s.mustUpdate)
        Positioned.fill(child: Material(
          color: Colors.black54,
          child: Align(alignment: Alignment.bottomCenter, child: Container(
            width: double.infinity,
            padding: EdgeInsets.fromLTRB(24, 24, 24, 24 + MediaQuery.of(context).padding.bottom),
            decoration: BoxDecoration(color: J.surface, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(tr(context, 'gate.update'), style: J.ui(22, w: FontWeight.w800)),
              const SizedBox(height: 8),
              Text(tr(context, 'gate.updateSub').replaceAll('{v}', c.currentVersion), style: J.ui(14, c: J.clay500, w: FontWeight.w400, h: 1.5)),
              const SizedBox(height: 20),
              Pressable(
                onTap: () {
                  final url = Platform.isIOS ? c.appStore : c.playStore;
                  if (url.isNotEmpty) launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
                },
                child: Container(height: 56, alignment: Alignment.center, decoration: BoxDecoration(color: J.ink, borderRadius: BorderRadius.circular(18)),
                    child: Text(tr(context, 'gate.updateBtn'), style: J.ui(16, c: J.onInk, w: FontWeight.w700))),
              ),
            ]),
          )),
        )),
    ]);
  }
}
