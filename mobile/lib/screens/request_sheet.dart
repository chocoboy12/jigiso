import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../data/api.dart';
import '../data/models.dart';
import '../main.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'success.dart';

const _months = ['JANV', 'FÉVR', 'MARS', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'];

void showRequestSheet(BuildContext context, Property p) => showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: J.night.withOpacity(.6),
      builder: (_) => RequestSheet(p),
    );

/// Le 1er et le 15 des prochains mois
List<DateTime> nextMoveInDates() {
  final now = DateTime.now();
  final out = <DateTime>[];
  var d = DateTime(now.year, now.month, now.day < 15 ? 15 : 1);
  if (now.day >= 15) d = DateTime(now.year, now.month + 1, 1);
  while (out.length < 4) {
    out.add(d);
    d = d.day == 1 ? DateTime(d.year, d.month, 15) : DateTime(d.year, d.month + 1, 1);
  }
  return out;
}

class RequestSheet extends StatefulWidget {
  final Property p;
  const RequestSheet(this.p, {super.key});
  @override
  State<RequestSheet> createState() => _RequestSheetState();
}

class _RequestSheetState extends State<RequestSheet> {
  final dates = nextMoveInDates();
  final msg = TextEditingController();
  int? date;          // index dans [dates], ou [_autre] pour une date choisie au calendrier
  DateTime? autreDate;
  static const _autre = -1;
  int? dur;
  bool sending = false;

  bool get ready => date != null && dur != null;
  DateTime get moveIn => date == _autre ? autreDate! : dates[date!];

  /// Calendrier : n'importe quel jour entre demain et dans un an.
  Future<void> _choisirDate() async {
    HapticFeedback.selectionClick();
    final demain = DateTime.now().add(const Duration(days: 1));
    final d = await showDatePicker(
      context: context,
      // Le calendrier système n'existe pas en bambara : il s'affiche alors en français
      locale: Locale(AppScope.of(context).lang == 'en' ? 'en' : 'fr'),
      initialDate: autreDate ?? demain,
      firstDate: DateTime(demain.year, demain.month, demain.day),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      helpText: AppScope.of(context).t('req.moveIn'),
      builder: (c, child) => Theme(
        data: Theme.of(c).copyWith(colorScheme: Theme.of(c).colorScheme.copyWith(primary: J.ink, onPrimary: J.cream, secondary: J.gold)),
        child: child!,
      ),
    );
    if (d != null) setState(() { autreDate = d; date = _autre; });
  }

  Future<void> _send() async {
    if (!ready || sending) return;
    HapticFeedback.mediumImpact();
    setState(() => sending = true);
    final s = AppScope.of(context);
    final nav = Navigator.of(context);
    try {
      await s.sendRequest(RentalRequest(property: widget.p, moveIn: moveIn, duration: durations[dur!], message: msg.text));
    } catch (e) {
      if (!mounted) return;
      setState(() => sending = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(Api.token == null ? 'Connectez-vous pour envoyer une demande' : '$e')));
      return;
    }
    nav.pop();
    nav.push(fadeRoute(SuccessScreen(widget.p)));
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: EdgeInsets.fromLTRB(20, 12, 20, 20 + MediaQuery.of(context).padding.bottom),
        decoration: BoxDecoration(color: J.cream, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Center(child: Container(width: 40, height: 5, decoration: BoxDecoration(color: J.line, borderRadius: BorderRadius.circular(3)))),
          const SizedBox(height: 16),
          Text(s.t('req.title'), style: J.serif(28)),
          const SizedBox(height: 4),
          Text('${widget.p.title} · ${widget.p.ownerName}', style: J.sans(14, c: J.clay500)),
          const SizedBox(height: 18),
          Text(s.t('req.moveIn'), style: J.mono(10)),
          const SizedBox(height: 8),
          Row(children: [
            for (var i = 0; i < dates.length; i++) ...[
              if (i > 0) const SizedBox(width: 6),
              Expanded(child: _tile(i == date, () => setState(() => date = i), Column(mainAxisSize: MainAxisSize.min, children: [
                Text('${dates[i].day}', style: J.serif(22, c: i == date ? J.cream : J.ink)),
                Text(_months[dates[i].month - 1], style: J.mono(9.5, c: i == date ? J.gold : J.clay500)),
              ]), height: 64)),
            ],
          ]),
          const SizedBox(height: 6),
          // Autre date : le 1er et le 15 ne conviennent pas à tout le monde
          _tile(date == _autre, _choisirDate, Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(Icons.calendar_month_rounded, size: 18, color: date == _autre ? J.gold : J.ink),
            const SizedBox(width: 8),
            Text(
              date == _autre
                  ? '${autreDate!.day} ${_months[autreDate!.month - 1]} ${autreDate!.year} · ${s.lang == 'fr' ? 'modifier' : 'change'}'
                  : tr(context, 'rq.otherDate'),
              style: J.sans(14, c: date == _autre ? J.cream : J.ink, w: FontWeight.w600),
            ),
          ]), height: 44),
          const SizedBox(height: 16),
          Text(s.t('req.duration'), style: J.mono(10)),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (var i = 0; i < durations.length; i++)
              _tile(i == dur, () => setState(() => dur = i),
                  Padding(padding: const EdgeInsets.symmetric(horizontal: 14), child: Text(durations[i], style: J.sans(14, c: i == dur ? J.cream : J.ink, w: FontWeight.w600))),
                  height: 40, pill: true),
          ]),
          const SizedBox(height: 16),
          Text(s.t('req.msg'), style: J.mono(10)),
          const SizedBox(height: 8),
          TextField(
            controller: msg,
            maxLines: 2,
            style: J.sans(15),
            decoration: InputDecoration(
              hintText: s.t('req.msgPh'),
              hintStyle: J.sans(15, c: J.clay300),
              filled: true, fillColor: J.card,
              contentPadding: const EdgeInsets.all(12),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: J.line)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: J.gold, width: 1.5)),
            ),
          ),
          const SizedBox(height: 18),
          Pressable(
            onTap: _send,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 260),
              height: 56,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: ready ? J.ink : J.line, borderRadius: BorderRadius.circular(999)),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: sending
                    ? const SizedBox(key: ValueKey('l'), width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: J.gold))
                    : Text(s.t(ready ? 'req.send' : 'req.pick'), key: ValueKey(ready), style: J.sans(16, c: ready ? J.cream : J.clay500, w: FontWeight.w700)),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _tile(bool on, VoidCallback f, Widget child, {double height = 46, bool pill = false}) => Pressable(
        onTap: () { HapticFeedback.selectionClick(); f(); },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          height: height,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: on ? J.ink : Colors.transparent, borderRadius: BorderRadius.circular(pill ? 999 : 14), border: Border.all(color: on ? J.ink : J.line, width: 1.5)),
          child: child,
        ),
      );
}
