import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../data/api.dart';
import '../main.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/jigiso_logo.dart';
import 'verification.dart';
import 'shell.dart';
import 'owner_home.dart';

/// Écran 02 — Bienvenue, choix du profil (locataire / propriétaire).
///
/// En haut, une photo sous un dégradé sombre porte la promesse ; en bas, un
/// panneau clair qui remonte sur la photo porte le choix du profil et les
/// actions. Le panneau défile sur les petits écrans plutôt que de rogner.
class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});
  /// Photos de l'en-tête, préchargées par le splash
  static List<String> get photos => _WelcomeScreenState.photos;
  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  String role = 'tenant';

  static const _fond = Color(0xFF14120E);
  static const _or = Color(0xFFE2A84A);
  static const _orFonce = Color(0xFFC8892A);

  /* Photos de l'en-tête (paysage, cadrées pour un en-tête en portrait).
     Elles se relaient toutes les 4 secondes ; avec « réduire les animations »
     activé sur le téléphone, la première reste fixe. */
  static const _photos = [
    ('assets/images/bienvenue.jpg', Alignment(0.45, -0.3), 'Villa moderne avec piscine'),
    ('assets/images/bienvenue2.jpg', Alignment(-0.1, 0), 'Salon lumineux avec canapé en cuir'),
    ('assets/images/bienvenue3.jpg', Alignment(-0.3, -0.3), 'Maison avec terrasse et piscine'),
  ];
  static List<String> get photos => [for (final p in _photos) p.$1];
  int _photo = 0;
  Timer? _defile;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _defile?.cancel();
    if (!MediaQuery.of(context).disableAnimations) {
      _defile = Timer.periodic(const Duration(seconds: 4), (_) {
        if (mounted) setState(() => _photo = (_photo + 1) % _photos.length);
      });
    }
  }

  @override
  void dispose() { _defile?.cancel(); super.dispose(); }

  void _continuer() => Navigator.of(context).push(slideRoute(AuthScreen(register: true, role: role)));

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final mq = MediaQuery.of(context);
    // En-tête : environ la moitié de l'écran (430 px sur un écran de 844)
    final haut = (mq.size.height * 0.51).clamp(330.0, 470.0);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: _fond,
        body: CustomScrollView(
          physics: const ClampingScrollPhysics(),
          slivers: [SliverFillRemaining(
            hasScrollBody: false,
            child: Stack(children: [
              // Photos qui se relaient toutes les 4 secondes, en fondu, puis le dégradé
              Positioned(left: 0, right: 0, top: 0, height: haut + 20, child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 900),
                child: Image.asset(_photos[_photo].$1, key: ValueKey(_photo), fit: BoxFit.cover,
                    width: double.infinity, height: double.infinity, gaplessPlayback: true,
                    alignment: _photos[_photo].$2, semanticLabel: _photos[_photo].$3),
              )),
              Positioned(left: 0, right: 0, top: 0, height: haut + 20, child: const DecoratedBox(
                decoration: BoxDecoration(gradient: LinearGradient(
                  begin: Alignment.topCenter, end: Alignment.bottomCenter,
                  colors: [Color(0x7314120E), Color(0x0014120E), Color(0x0014120E), Color(0xC714120E), Color(0xF014120E), _fond],
                  stops: [0, .2, .34, .55, .72, .88],
                )),
              )),
              Positioned(left: 0, right: 0, top: 0, height: haut, child: _entete(s, mq.padding.top)),
              // Le panneau remonte de 24 px sur la photo
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                SizedBox(height: haut - 24),
                Expanded(child: _panneau(s, mq.padding.bottom)),
              ]),
            ]),
          )],
        ),
      ),
    );
  }

  /* ── En-tête sombre : logo, langue, promesse ── */
  Widget _entete(AppState s, double hautSysteme) => Padding(
        padding: EdgeInsets.fromLTRB(24, hautSysteme + 16, 24, 48),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 44, height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: const JigisoLogo(parts: LogoParts.mark, height: 26),
            ),
            const Spacer(),
            /* Langue dès le premier écran : imposer d'aller dans le profil
               pour en changer suppose d'avoir déjà compris l'interface. */
            Container(
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                // Fond sombre : les lettres restent lisibles même sur un ciel clair
                color: const Color(0x8C14120E),
                border: Border.all(color: Colors.white.withValues(alpha: .14)),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                for (final l in const ['fr', 'bm', 'en'])
                  Semantics(button: true, selected: s.lang == l, child: Pressable(
                    onTap: () { HapticFeedback.selectionClick(); s.setLang(l); },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      constraints: const BoxConstraints(minWidth: 44),
                      height: 36,
                      alignment: Alignment.center,
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      margin: EdgeInsets.only(left: l == 'fr' ? 0 : 2),
                      decoration: BoxDecoration(
                        color: s.lang == l ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(l.toUpperCase(), style: J.ui(13, w: FontWeight.w600,
                          c: s.lang == l ? _fond : const Color(0xFFCFC8BC))),
                    ),
                  )),
              ]),
            ),
          ]),
          const Spacer(),
          Row(children: [
            Container(width: 18, height: 2, color: _or),
            const SizedBox(width: 8),
            Text(s.t('wel2.kicker').toUpperCase(),
                style: J.ui(12, c: _or, w: FontWeight.w600).copyWith(letterSpacing: 12 * .08)),
          ]),
          const SizedBox(height: 14),
          Entrance(delayMs: 120, child: Text(s.t('wel2.title'),
              style: J.ui(30, c: Colors.white, w: FontWeight.w700, h: 1.12).copyWith(letterSpacing: -0.9))),
          const SizedBox(height: 14),
          Entrance(delayMs: 200, child: Text(s.t('wel2.sub'),
              style: J.ui(15, c: const Color(0xFFB9B2A6), w: FontWeight.w400, h: 1.5))),
          const SizedBox(height: 20),
          Wrap(spacing: 18, runSpacing: 8, children: [
            for (final cle in const ['wel2.c1', 'wel2.c2', 'wel2.c3'])
              Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.check_rounded, size: 15, color: _or),
                const SizedBox(width: 6),
                Text(s.t(cle), style: J.ui(13, c: const Color(0xFFE8E3DA), w: FontWeight.w500)),
              ]),
          ]),
        ]),
      );

  /* ── Panneau clair : profil et actions ── */
  Widget _panneau(AppState s, double basSysteme) => Container(
        padding: EdgeInsets.fromLTRB(24, 26, 24, 18 + basSysteme),
        decoration: BoxDecoration(color: J.surface, borderRadius: const BorderRadius.vertical(top: Radius.circular(26))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(s.t('wel2.you'), style: J.ui(13, c: J.x(0xFF5E584F), w: FontWeight.w600)),
          const SizedBox(height: 12),
          _carte('tenant', Icons.search_rounded, s.t('wel2.tenant'), s.t('wel2.tenantSub')),
          const SizedBox(height: 10),
          _carte('owner', Icons.home_outlined, s.t('wel2.owner'), s.t('wel2.ownerSub')),
          const Spacer(),
          const SizedBox(height: 20),
          Pressable(
            onTap: _continuer,
            child: Semantics(button: true, child: Container(
              height: 54,
              decoration: BoxDecoration(color: J.sombre ? J.ink : _fond, borderRadius: BorderRadius.circular(14)),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Flexible(child: Text(s.t(role == 'tenant' ? 'wel2.ctaTenant' : 'wel2.ctaOwner'),
                    overflow: TextOverflow.ellipsis,
                    style: J.ui(16, c: J.sombre ? J.onInk : Colors.white, w: FontWeight.w600))),
                const SizedBox(width: 10),
                const Icon(Icons.arrow_forward_rounded, size: 19, color: _or),
              ]),
            )),
          ),
          const SizedBox(height: 8),
          // Découvrir les annonces avant de créer un compte
          SizedBox(height: 48, child: TextButton(
            onPressed: () => Navigator.of(context).pushAndRemoveUntil(fadeRoute(const Shell()), (_) => false),
            child: Text(s.t('wel2.guest'), style: J.ui(15, w: FontWeight.w600)),
          )),
          /* Cible de 48 px : une ligne de 14 px seule serait trop petite
             pour un doigt, et sans `opaque` seuls les glyphes réagiraient. */
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => Navigator.of(context).push(slideRoute(const AuthScreen(register: false))),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text.rich(TextSpan(text: s.t('wel2.has'), style: J.ui(14, c: J.x(0xFF5E584F)), children: [
                TextSpan(text: s.t('wel2.login'), style: J.ui(14, c: J.goldDeep, w: FontWeight.w600)
                    .copyWith(decoration: TextDecoration.underline)),
              ]), textAlign: TextAlign.center),
            ),
          ),
        ]),
      );

  Widget _carte(String v, IconData icone, String titre, String sous) {
    final on = role == v;
    return Semantics(
      inMutuallyExclusiveGroup: true, checked: on, button: true,
      child: Pressable(
        onTap: () { HapticFeedback.selectionClick(); setState(() => role = v); },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          constraints: const BoxConstraints(minHeight: 68),
          padding: const EdgeInsets.fromLTRB(12, 12, 16, 12),
          decoration: BoxDecoration(
            color: on ? J.x(0xFFFFF9EF) : J.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: on ? _orFonce : J.x(0xFFE6E0D6), width: 1.5),
          ),
          child: Row(children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 42, height: 42,
              decoration: BoxDecoration(color: on ? _orFonce : J.x(0xFFF4F0E9), borderRadius: BorderRadius.circular(10)),
              child: Icon(icone, size: 21, color: on ? _fond : J.x(0xFF5E584F)),
            ),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(titre, style: J.ui(15, w: FontWeight.w700)),
              const SizedBox(height: 2),
              Text(sous, style: J.ui(13, c: J.x(0xFF5E584F), w: FontWeight.w400)),
            ])),
            // Bouton radio : anneau, point plein quand choisi
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 22, height: 22,
              alignment: Alignment.center,
              decoration: BoxDecoration(shape: BoxShape.circle,
                  border: Border.all(color: on ? _orFonce : J.x(0xFFCFC6B7), width: 2)),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 10, height: 10,
                decoration: BoxDecoration(shape: BoxShape.circle, color: on ? _orFonce : Colors.transparent),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

/// Écrans 03 / 04 — Inscription et connexion (même API que le site)
class AuthScreen extends StatefulWidget {
  final bool register;
  final String role;
  const AuthScreen({super.key, required this.register, this.role = 'tenant'});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  late bool register = widget.register;
  late String role = widget.role;
  final name = TextEditingController(), phone = TextEditingController(), email = TextEditingController(), pass = TextEditingController();
  bool showPw = false, loading = false;
  String? error;

  Future<void> _submit() async {
    setState(() => error = null);
    if (register && (name.text.isEmpty || phone.text.isEmpty)) return setState(() => error = tr(context, 'au.needName'));
    if (email.text.isEmpty || pass.text.isEmpty) return setState(() => error = tr(context, 'au.needEmail'));
    if (register && pass.text.length < 6) return setState(() => error = tr(context, 'au.pass6'));
    HapticFeedback.mediumImpact();
    setState(() => loading = true);
    final s = AppScope.of(context);
    final nav = Navigator.of(context);
    try {
      final user = register
          ? await Api.register(name: name.text, phone: '+223 ${phone.text}', email: email.text, password: pass.text, role: role)
          : await Api.login(email.text, pass.text);
      s.signIn(user);
    } catch (e) {
      /* Le serveur dit précisément ce qui bloque : mot de passe trop faible,
         email déjà pris, trop de tentatives. On le répète tel quel plutôt que
         de le remplacer par un message passe-partout que personne ne peut
         corriger. On ne garde un texte à nous que pour la panne réseau et le
         mot de passe erroné, où le serveur reste volontairement évasif. */
      final net = e.toString().contains('Socket') || e.toString().contains('Timeout');
      final serveur = e is ApiException && e.statusCode != 401 ? e.message : null;
      setState(() {
        loading = false;
        error = net
            ? tr(context, 'err.server')
            : serveur ?? (register
                ? tr(context, 'au.regFail')
                : tr(context, 'au.badLogin'));
      });
      return;
    }
    _enter(nav, s, newOwner: register && role == 'owner');
  }

  void _enter(NavigatorState nav, AppState s, {bool newOwner = false}) {
    nav.pushAndRemoveUntil(fadeRoute(s.user!.role == 'owner' ? const OwnerShell() : const Shell()), (_) => false);
    // Un propriétaire qui vient de s'inscrire passe directement à la vérification
    if (newOwner) nav.push(slideRoute(const VerificationScreen()));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: J.surface,
        body: SafeArea(
          child: ListView(padding: const EdgeInsets.fromLTRB(24, 8, 24, 24), children: [
            Align(alignment: Alignment.centerLeft, child: Pressable(
              onTap: () => Navigator.pop(context),
              child: Container(width: 44, height: 44, decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: J.soft, width: 1.5)),
                  child: const Icon(Icons.arrow_back_rounded)),
            )),
            const SizedBox(height: 18),
            if (!register) ...[
              const Center(child: JigisoLogo(parts: LogoParts.stacked, height: 96, animate: true)),
              const SizedBox(height: 22),
            ],
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 250),
              child: Column(key: ValueKey(register), crossAxisAlignment: register ? CrossAxisAlignment.start : CrossAxisAlignment.center, children: [
                Text(register ? tr(context, 'au.create') : tr(context, 'au.welcomeBack'), style: J.ui(28, w: FontWeight.w800)),
                const SizedBox(height: 6),
                Text(register ? tr(context, 'au.join') : tr(context, 'au.loginSub'), style: J.ui(15, c: J.clay500, w: FontWeight.w400)),
              ]),
            ),
            const SizedBox(height: 20),
            AnimatedSize(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeOutCubic,
              child: register
                  ? Column(children: [
                      _roleTabs(),
                      const SizedBox(height: 16),
                      KitField(label: 'Nom complet', hint: tr(context, 'au.namePh'), icon: Icons.person_outline_rounded, controller: name),
                      const SizedBox(height: 12),
                      KitField(label: 'Téléphone', hint: '70 00 00 00', prefix: '+223', controller: phone, keyboard: TextInputType.phone),
                      const SizedBox(height: 12),
                    ])
                  : const SizedBox(width: double.infinity),
            ),
            KitField(label: register ? 'Email' : null, hint: 'Email', icon: Icons.mail_outline_rounded, controller: email, keyboard: TextInputType.emailAddress),
            const SizedBox(height: 12),
            KitField(
              label: register ? tr(context, 'au.pass') : null, hint: tr(context, 'au.pass'), icon: Icons.lock_outline_rounded, controller: pass, obscure: !showPw,
              suffix: IconButton(icon: Icon(showPw ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: J.clay500), onPressed: () => setState(() => showPw = !showPw)),
            ),
            if (!register) Align(alignment: Alignment.centerRight, child: TextButton(onPressed: () {}, child: Text(tr(context, 'au.forgot'), style: J.ui(13, c: J.gold, w: FontWeight.w600)))),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              child: error == null ? const SizedBox(height: 12) : Padding(
                key: ValueKey(error),
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Row(children: [
                  Icon(Icons.error_outline_rounded, size: 18, color: J.terracotta),
                  const SizedBox(width: 6),
                  Expanded(child: Text(error!, style: J.ui(13, c: J.terracotta, w: FontWeight.w600))),
                ]),
              ),
            ),
            KitButton(label: register ? (role == 'owner' ? tr(context, 'au.createOwner') : tr(context, 'au.createTenant')) : tr(context, 'wel2.login'), loading: loading, onTap: _submit),
            const SizedBox(height: 20),
            /* Boutons Google / Facebook / Apple retirés : ils exigent une
               application déclarée chez chaque fournisseur (client ID, empreinte
               de signature) et une route /auth/<fournisseur> qui vérifie le
               jeton côté serveur. Tant que ces comptes n'existent pas, afficher
               les boutons revient à promettre une inscription qui échoue.
               Tout est conservé pour les remettre : widgets/social_buttons.dart,
               Api.socialLogin() et les paquets commentés dans pubspec.yaml. */
            Center(child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => setState(() { register = !register; error = null; }),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 24),
                child: Text.rich(TextSpan(text: register ? tr(context, 'wel2.has') : tr(context, 'au.noAccount'), style: J.ui(14, c: J.clay500), children: [
                  TextSpan(text: register ? 'Connexion' : 'S\'inscrire', style: J.ui(14, c: J.gold, w: FontWeight.w700)),
                ])),
              ),
            )),
          ]),
        ),
      );

  Widget _roleTabs() => Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: J.x(0xFFF5F1E8), borderRadius: BorderRadius.circular(16)),
        child: Row(children: [
          for (final r in [('tenant', Icons.person_search_outlined, 'Locataire'), if (AppScope.of(context).config.flag('ownerSignup')) ('owner', Icons.key_outlined, 'Propriétaire')])
            Expanded(child: GestureDetector(
              onTap: () { HapticFeedback.selectionClick(); setState(() => role = r.$1); },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                height: 46,
                decoration: BoxDecoration(
                  color: role == r.$1 ? J.surface : Colors.transparent, borderRadius: BorderRadius.circular(12),
                  boxShadow: role == r.$1 ? [BoxShadow(color: J.night.withOpacity(.15), blurRadius: 12, offset: const Offset(0, 4), spreadRadius: -6)] : null,
                ),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(r.$2, size: 20, color: role == r.$1 ? J.ink : J.clay500),
                  const SizedBox(width: 6),
                  Text(r.$3, style: J.ui(14, c: role == r.$1 ? J.ink : J.clay500, w: FontWeight.w700)),
                ]),
              ),
            )),
        ]),
      );
}

Route<T> slideRoute<T>(Widget page) => PageRouteBuilder<T>(
      transitionDuration: const Duration(milliseconds: 380),
      pageBuilder: (_, __, ___) => page,
      transitionsBuilder: (_, a, __, c) => SlideTransition(
        position: Tween(begin: const Offset(1, 0), end: Offset.zero).animate(CurvedAnimation(parent: a, curve: Curves.easeOutCubic)),
        child: c,
      ),
    );

class KitField extends StatefulWidget {
  final String? label, prefix;
  final String hint;
  final IconData? icon;
  final TextEditingController controller;
  final bool obscure;
  final Widget? suffix;
  final TextInputType? keyboard;
  const KitField({super.key, this.label, required this.hint, this.icon, this.prefix, required this.controller, this.obscure = false, this.suffix, this.keyboard});
  @override
  State<KitField> createState() => _KitFieldState();
}

class _KitFieldState extends State<KitField> {
  final focus = FocusNode();
  @override
  void initState() { super.initState(); focus.addListener(() => setState(() {})); }
  @override
  void dispose() { focus.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final on = focus.hasFocus;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (widget.label != null) ...[Text(widget.label!, style: J.ui(13, c: J.clay600, w: FontWeight.w600)), const SizedBox(height: 6)],
      AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        height: 56,
        padding: const EdgeInsets.only(left: 14),
        decoration: BoxDecoration(color: on ? J.surface : J.x(0xFFF8F6F1), borderRadius: BorderRadius.circular(16), border: Border.all(color: on ? J.gold : J.soft, width: 1.5)),
        child: Row(children: [
          if (widget.icon != null) Icon(widget.icon, size: 20, color: on ? J.gold : J.clay300),
          if (widget.prefix != null) Container(
            padding: const EdgeInsets.only(right: 10),
            decoration: BoxDecoration(border: Border(right: BorderSide(color: J.soft, width: 1.5))),
            child: Text(widget.prefix!, style: J.ui(14, w: FontWeight.w700)),
          ),
          const SizedBox(width: 10),
          Expanded(child: TextField(
            controller: widget.controller, focusNode: focus, obscureText: widget.obscure, keyboardType: widget.keyboard,
            style: J.ui(15),
            decoration: InputDecoration(border: InputBorder.none, hintText: widget.hint, hintStyle: J.ui(15, c: J.clay300)),
          )),
          if (widget.suffix != null) widget.suffix! else const SizedBox(width: 14),
        ]),
      ),
    ]);
  }
}

class KitButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final bool loading;
  final Color bg, fg;
  KitButton({super.key, required this.label, this.onTap, this.loading = false, Color? bg, Color? fg}) : bg = bg ?? J.ink, fg = fg ?? J.onInk;
  @override
  Widget build(BuildContext context) => Pressable(
        onTap: loading ? null : onTap,
        child: Container(
          height: 56,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(18)),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: loading
                ? const SizedBox(key: ValueKey('l'), width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: J.gold))
                : Text(label, key: ValueKey(label), style: J.ui(16, c: fg, w: FontWeight.w700)),
          ),
        ),
      );
}
