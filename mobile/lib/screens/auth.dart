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

/// Écran 02 — Bienvenue, choix du profil (locataire / propriétaire)
class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});
  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  String role = 'tenant';

  /* Chiffres réels du catalogue, pour que la promesse « partout au Mali » soit
     adossée à quelque chose de vérifiable. `null` tant qu'on ne sait pas :
     aucun nombre n'est affiché tant qu'il ne vient pas du serveur. */
  Map<String, dynamic>? _chiffres;

  @override
  void initState() {
    super.initState();
    /* Volontairement non bloquant : l'écran s'affiche immédiatement, la ligne
       de chiffres apparaît si et quand elle a du sens. Serveur injoignable ou
       catalogue vide : on n'affiche rien plutôt qu'un zéro décourageant. */
    Api.ownerStats()
        .then((v) { if (mounted) setState(() => _chiffres = v); })
        .catchError((_) {});
  }

  int _n(String cle) => (_chiffres?[cle] as num?)?.toInt() ?? 0;

  /// « 12 logements · 4 villes · 8 propriétaires »
  Widget? _preuve() {
    if (_chiffres == null || _n('total') == 0) return null;
    final s = AppScope.of(context);
    final elements = <String>[
      '${_n('total')} ${s.t(_n('total') > 1 ? 'homesN' : 'homes1')}',
      '${_n('citiesCovered')} ${s.t(_n('citiesCovered') > 1 ? 'wel.cityN' : 'wel.city1')}',
      if (_n('owners') > 0) '${_n('owners')} ${s.t(_n('owners') > 1 ? 'wel.ownerN' : 'wel.owner1')}',
    ];
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeOut,
      builder: (_, t, child) => Opacity(opacity: t, child: child),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFFBF6EA),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.verified_outlined, size: 16, color: J.gold),
          const SizedBox(width: 8),
          Flexible(child: Text(elements.join('  ·  '),
              textAlign: TextAlign.center,
              style: J.ui(13, c: J.clay500, w: FontWeight.w600))),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return Scaffold(
        backgroundColor: Colors.white,
        /* L'écran tient sur un grand téléphone, mais la ligne de chiffres
           ajoutée en bas le fait déborder sur les écrans plus courts. Plutôt
           que de rogner le logo ou les marges, on laisse le contenu défiler
           quand il ne rentre pas : la mise en page reste identique partout où
           elle tient, et reste atteignable partout ailleurs. */
        body: SafeArea(
          /* SliverFillRemaining(hasScrollBody: false) : la colonne remplit
             l'écran quand elle tient (le Spacer pousse le bouton en bas) et
             défile sinon. Un simple minHeight dans un SingleChildScrollView
             ne suffit pas : la hauteur reste non bornée et le Spacer plante
             (« non-zero flex but incoming height constraints are unbounded »). */
          child: CustomScrollView(
            physics: const ClampingScrollPhysics(),
            slivers: [SliverFillRemaining(
              hasScrollBody: false,
              child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              /* Choix de la langue dès le premier écran : au Mali, français et
                 anglais cohabitent, et imposer d'aller dans le profil pour en
                 changer suppose d'avoir déjà compris l'interface. */
              Align(
                alignment: Alignment.centerRight,
                child: Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFF5F1E8),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  padding: const EdgeInsets.all(3),
                  child: Row(mainAxisSize: MainAxisSize.min,
                      children: ['fr', 'en'].map((l) {
                    final on = s.lang == l;
                    return Pressable(
                      onTap: () { HapticFeedback.selectionClick(); s.setLang(l); },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                        decoration: BoxDecoration(
                          color: on ? J.gold : Colors.transparent,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(l.toUpperCase(),
                            style: J.ui(12, w: FontWeight.w700, c: on ? J.ink : J.clay500)),
                      ),
                    );
                  }).toList()),
                ),
              ),
              const SizedBox(height: 10),
              Container(
                height: 280,
                decoration: BoxDecoration(color: const Color(0xFFFBF6EA), borderRadius: BorderRadius.circular(32)),
                child: Stack(alignment: Alignment.center, children: [
                  Container(width: 220, height: 220, decoration: const BoxDecoration(color: Color(0xFFF3E6C8), shape: BoxShape.circle)),
                  const JigisoLogo(parts: LogoParts.mark, height: 150, animate: true),
                ]),
              ),
              const SizedBox(height: 28),
              Entrance(delayMs: 200, child: Text(s.t('wel.title'), textAlign: TextAlign.center, style: J.ui(28, w: FontWeight.w800, h: 1.15))),
              const SizedBox(height: 10),
              Entrance(delayMs: 280, child: Text(s.t('wel.sub'), textAlign: TextAlign.center, style: J.ui(15, c: J.clay500, w: FontWeight.w400))),
              const SizedBox(height: 26),
              Entrance(delayMs: 360, child: _roleCard('tenant', Icons.search_rounded, s.t('wel.tenant'), s.t('wel.tenantSub'))),
              const SizedBox(height: 10),
              Entrance(delayMs: 420, child: _roleCard('owner', Icons.real_estate_agent_outlined, s.t('wel.owner'), s.t('wel.ownerSub'))),
              const Spacer(),
              /* Le bas de l'écran était vide. On y met ce que le catalogue
                 contient vraiment — rien si le serveur ne répond pas. */
              if (_preuve() != null) ...[_preuve()!, const SizedBox(height: 18)],
              KitButton(label: s.t('wel.cta'), onTap: () => Navigator.of(context).push(slideRoute(AuthScreen(register: true, role: role)))),
              const SizedBox(height: 2),
              /* Une ligne de texte de 14 px ne fait qu'une vingtaine de pixels
                 de haut : bien en dessous des 48 px qu'un doigt vise de façon
                 fiable, et sans `opaque` seuls les glyphes reçoivent le tap.
                 Le remplissage agrandit la cible sans rien changer à l'allure. */
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => Navigator.of(context).push(slideRoute(const AuthScreen(register: false))),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 24),
                  child: Text.rich(TextSpan(text: s.t('wel.has'), style: J.ui(14, c: J.clay500), children: [
                    TextSpan(text: s.t('wel.login'), style: J.ui(14, c: J.gold, w: FontWeight.w700)),
                  ]), textAlign: TextAlign.center),
                ),
              ),
            ]),
                ),
            )],
          ),
        ),
      );
  }

  Widget _roleCard(String v, IconData icon, String title, String sub) {
    final on = role == v;
    return Pressable(
      onTap: () { HapticFeedback.selectionClick(); setState(() => role = v); },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: on ? const Color(0xFFFFFCF5) : Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: on ? J.gold : J.soft, width: 2)),
        child: Row(children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            width: 48, height: 48,
            decoration: BoxDecoration(color: on ? J.gold : const Color(0xFFF5F1E8), borderRadius: BorderRadius.circular(14)),
            child: Icon(icon, color: on ? J.ink : J.clay500),
          ),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: J.ui(16, w: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(sub, style: J.ui(13, c: J.clay500, w: FontWeight.w400)),
          ])),
          AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            width: 22, height: 22,
            decoration: BoxDecoration(shape: BoxShape.circle, color: on ? J.gold : Colors.transparent, border: Border.all(color: on ? J.gold : J.soft, width: 2)),
            child: on ? const Icon(Icons.check_rounded, size: 14, color: Colors.white) : null,
          ),
        ]),
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
    if (register && (name.text.isEmpty || phone.text.isEmpty)) return setState(() => error = 'Nom et téléphone sont obligatoires');
    if (email.text.isEmpty || pass.text.isEmpty) return setState(() => error = 'Email et mot de passe sont obligatoires');
    if (register && pass.text.length < 6) return setState(() => error = 'Le mot de passe doit faire 6 caractères minimum');
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
            ? 'Serveur injoignable. Vérifiez votre connexion.'
            : serveur ?? (register
                ? 'Inscription impossible. Vérifiez vos informations.'
                : 'Email ou mot de passe incorrect.');
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
        backgroundColor: Colors.white,
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
                Text(register ? 'Créer un compte' : 'Content de vous revoir', style: J.ui(28, w: FontWeight.w800)),
                const SizedBox(height: 6),
                Text(register ? 'Rejoignez Jigiso en moins d\'une minute.' : 'Connectez-vous à votre compte', style: J.ui(15, c: J.clay500, w: FontWeight.w400)),
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
                      KitField(label: 'Nom complet', hint: 'Prénom Nom', icon: Icons.person_outline_rounded, controller: name),
                      const SizedBox(height: 12),
                      KitField(label: 'Téléphone', hint: '70 00 00 00', prefix: '+223', controller: phone, keyboard: TextInputType.phone),
                      const SizedBox(height: 12),
                    ])
                  : const SizedBox(width: double.infinity),
            ),
            KitField(label: register ? 'Email' : null, hint: 'Email', icon: Icons.mail_outline_rounded, controller: email, keyboard: TextInputType.emailAddress),
            const SizedBox(height: 12),
            KitField(
              label: register ? 'Mot de passe' : null, hint: 'Mot de passe', icon: Icons.lock_outline_rounded, controller: pass, obscure: !showPw,
              suffix: IconButton(icon: Icon(showPw ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: J.clay500), onPressed: () => setState(() => showPw = !showPw)),
            ),
            if (!register) Align(alignment: Alignment.centerRight, child: TextButton(onPressed: () {}, child: Text('Mot de passe oublié ?', style: J.ui(13, c: J.gold, w: FontWeight.w600)))),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              child: error == null ? const SizedBox(height: 12) : Padding(
                key: ValueKey(error),
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Row(children: [
                  const Icon(Icons.error_outline_rounded, size: 18, color: J.terracotta),
                  const SizedBox(width: 6),
                  Expanded(child: Text(error!, style: J.ui(13, c: J.terracotta, w: FontWeight.w600))),
                ]),
              ),
            ),
            KitButton(label: register ? (role == 'owner' ? 'Créer mon compte propriétaire' : 'Créer mon compte locataire') : 'Se connecter', loading: loading, onTap: _submit),
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
                child: Text.rich(TextSpan(text: register ? 'Déjà inscrit ? ' : 'Pas encore de compte ? ', style: J.ui(14, c: J.clay500), children: [
                  TextSpan(text: register ? 'Connexion' : 'S\'inscrire', style: J.ui(14, c: J.gold, w: FontWeight.w700)),
                ])),
              ),
            )),
          ]),
        ),
      );

  Widget _roleTabs() => Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: const Color(0xFFF5F1E8), borderRadius: BorderRadius.circular(16)),
        child: Row(children: [
          for (final r in [('tenant', Icons.person_search_outlined, 'Locataire'), if (AppScope.of(context).config.flag('ownerSignup')) ('owner', Icons.key_outlined, 'Propriétaire')])
            Expanded(child: GestureDetector(
              onTap: () { HapticFeedback.selectionClick(); setState(() => role = r.$1); },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                height: 46,
                decoration: BoxDecoration(
                  color: role == r.$1 ? Colors.white : Colors.transparent, borderRadius: BorderRadius.circular(12),
                  boxShadow: role == r.$1 ? [BoxShadow(color: J.ink.withOpacity(.15), blurRadius: 12, offset: const Offset(0, 4), spreadRadius: -6)] : null,
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
        decoration: BoxDecoration(color: on ? Colors.white : const Color(0xFFF8F6F1), borderRadius: BorderRadius.circular(16), border: Border.all(color: on ? J.gold : J.soft, width: 1.5)),
        child: Row(children: [
          if (widget.icon != null) Icon(widget.icon, size: 20, color: on ? J.gold : J.clay300),
          if (widget.prefix != null) Container(
            padding: const EdgeInsets.only(right: 10),
            decoration: const BoxDecoration(border: Border(right: BorderSide(color: J.soft, width: 1.5))),
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
  const KitButton({super.key, required this.label, this.onTap, this.loading = false, this.bg = J.ink, this.fg = Colors.white});
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
