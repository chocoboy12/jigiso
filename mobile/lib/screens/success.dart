import 'package:flutter/material.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme.dart';

class SuccessScreen extends StatefulWidget {
  final Property p;
  const SuccessScreen(this.p, {super.key});
  @override
  State<SuccessScreen> createState() => _SuccessScreenState();
}

class _SuccessScreenState extends State<SuccessScreen> with SingleTickerProviderStateMixin {
  late final c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..forward();
  @override
  void dispose() { c.dispose(); super.dispose(); }

  void _back(int tab) {
    AppScope.of(context).goTab(tab);
    Navigator.of(context).popUntil((r) => r.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return Scaffold(
      backgroundColor: J.ink,
      body: Stack(children: [
        const Positioned.fill(child: GridBackdrop()),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 60, 24, 24),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Align(
                alignment: Alignment.centerLeft,
                child: ScaleTransition(
                  scale: CurvedAnimation(parent: c, curve: Curves.elasticOut),
                  child: Container(width: 76, height: 76, decoration: const BoxDecoration(color: J.leaf, shape: BoxShape.circle),
                      child: const Icon(Icons.check_rounded, color: J.cream, size: 40)),
                ),
              ),
              const SizedBox(height: 24),
              Entrance(delayMs: 200, child: Text(s.t('done.t'), style: J.serif(48, c: J.cream))),
              const SizedBox(height: 14),
              Entrance(delayMs: 320, child: Text('${widget.p.ownerName} ${s.t('done.s')}', style: J.sans(16, c: J.line, w: FontWeight.w400, h: 1.5))),
              const Spacer(),
              Entrance(delayMs: 440, child: PillButton(label: s.t('done.see'), bg: J.gold, fg: J.ink, onTap: () => _back(2))),
              const SizedBox(height: 8),
              Entrance(delayMs: 500, child: PillButton(label: s.t('done.keep'), bg: Colors.transparent, fg: J.cream, onTap: () => _back(0))),
            ]),
          ),
        ),
      ]),
    );
  }
}
