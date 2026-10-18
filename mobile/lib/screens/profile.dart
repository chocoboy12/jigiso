import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../data/api.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/jigiso_logo.dart';
import '../main.dart';
import 'auth.dart';
import 'verification.dart';

/// Espace du compte — photo, informations, mot de passe, vérification.
///
/// Même écran pour les deux rôles : un propriétaire est d'abord un compte.
/// Seule la vérification d'identité lui est propre, parce qu'elle conditionne
/// la publication d'annonces.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _picker = ImagePicker();
  bool _envoiPhoto = false;

  /* Les contrôleurs vivent aussi longtemps que l'écran, pas que la feuille.
     Les libérer au retour de `showModalBottomSheet` les détruirait pendant
     que la feuille joue encore son animation de fermeture, et les champs
     peindraient un contrôleur mort. */
  final _nom = TextEditingController();
  final _tel = TextEditingController();
  final _whatsapp = TextEditingController();
  final _actuel = TextEditingController();
  final _nouveau = TextEditingController();
  final _confirmation = TextEditingController();

  @override
  void dispose() {
    for (final c in [_nom, _tel, _whatsapp, _actuel, _nouveau, _confirmation]) {
      c.dispose();
    }
    super.dispose();
  }

  AppState get s => AppScope.of(context);

  /// Message d'erreur lisible, en séparant les trois cas qui n'appellent pas
  /// la même réaction : le réseau, le refus argumenté du serveur, le reste.
  String _lisible(Object e) {
    final texte = e.toString();
    if (texte.contains('Socket') || texte.contains('Timeout')) {
      return 'Serveur injoignable. Vérifiez votre connexion.';
    }
    if (e is ApiException) return e.message;
    return 'Une erreur est survenue.';
  }

  void _dire(String message, {bool erreur = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: erreur ? J.terracotta : J.ink,
      behavior: SnackBarBehavior.floating,
    ));
  }

  // ── Photo de profil ────────────────────────────────────────────────────

  Future<void> _changerPhoto() async {
    final source = await _choisirSource();
    if (source == null) return;

    /* 800 px et qualité 75 : le serveur refuse au-delà de 2 Mo, et une photo
       d'appareil moderne les dépasse largement. Un avatar ne s'affiche jamais
       plus grand que quelques centaines de pixels. */
    final fichier = await _picker.pickImage(source: source, imageQuality: 75, maxWidth: 800);
    if (fichier == null) return;

    setState(() => _envoiPhoto = true);
    try {
      final maj = await Api.updateProfile(photo: File(fichier.path));
      if (!mounted) return;
      s.updateUser(maj);
      _dire('Photo mise à jour.');
    } catch (e) {
      _dire(_lisible(e), erreur: true);
    } finally {
      if (mounted) setState(() => _envoiPhoto = false);
    }
  }

  Future<ImageSource?> _choisirSource() => showModalBottomSheet<ImageSource>(
        context: context,
        backgroundColor: Colors.transparent,
        builder: (_) => _Feuille(
          titre: 'Photo de profil',
          enfants: [
            _Ligne(
              icone: Icons.photo_camera_outlined,
              titre: 'Prendre une photo',
              onTap: () => Navigator.pop(context, ImageSource.camera),
            ),
            _Ligne(
              icone: Icons.photo_library_outlined,
              titre: 'Choisir dans la galerie',
              onTap: () => Navigator.pop(context, ImageSource.gallery),
            ),
          ],
        ),
      );

  // ── Informations ───────────────────────────────────────────────────────

  Future<void> _modifierInfos() async {
    final u = s.user;
    if (u == null) return;
    _nom.text = u.name;
    _tel.text = u.phone;
    _whatsapp.text = u.whatsapp;

    final maj = await showModalBottomSheet<AppUser>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _FormulaireSheet(
        titre: 'Mes informations',
        champs: [
          KitField(label: 'Nom complet', hint: 'Votre nom', icon: Icons.person_outline, controller: _nom),
          const SizedBox(height: 14),
          KitField(
            label: 'Téléphone', hint: '70 00 00 00', icon: Icons.phone_outlined,
            controller: _tel, keyboard: TextInputType.phone,
          ),
          const SizedBox(height: 14),
          KitField(
            label: 'Numéro WhatsApp', hint: '76 00 00 00', icon: Icons.chat_outlined,
            controller: _whatsapp, keyboard: TextInputType.phone,
          ),
          const SizedBox(height: 8),
          /* Dit ce que ce champ produit. Sans numéro, pas de bouton — et un
             propriétaire doit savoir qu'il se prive d'un canal, pas le
             découvrir en se demandant pourquoi personne ne l'écrit. */
          Text(
            u.role == 'owner'
                ? 'Ce numéro — et pas celui du compte — apparaît en bouton WhatsApp sur vos annonces. Laissé vide, aucun bouton ne s\'affiche.'
                : 'Utilisé pour vous joindre sur WhatsApp. Peut différer du téléphone du compte.',
            style: J.ui(12, c: J.clay500),
          ),
          if (u.phoneVerified) ...[
            const SizedBox(height: 10),
            /* Dit à l'avance ce que le changement coûte : le serveur remet
               phoneVerified à false, et le découvrir après coup serait vécu
               comme une régression inexpliquée. */
            Text('Changer de numéro annulera sa vérification.',
                style: J.ui(12, c: J.clay500)),
          ],
        ],
        libelleAction: 'Enregistrer',
        action: () async {
          final n = _nom.text.trim();
          if (n.isEmpty) throw const ApiException('Le nom ne peut pas être vide.', 400);
          return Api.updateProfile(
            name: n,
            phone: _tel.text.trim().isEmpty ? null : _tel.text.trim(),
            whatsapp: _whatsapp.text.trim(),
          );
        },
      ),
    );

    if (maj != null && mounted) {
      s.updateUser(maj);
      _dire('Profil mis à jour.');
    }
  }

  // ── Mot de passe ───────────────────────────────────────────────────────

  Future<void> _changerMotDePasse() async {
    for (final c in [_actuel, _nouveau, _confirmation]) {
      c.clear();
    }

    final message = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _FormulaireSheet(
        titre: 'Changer le mot de passe',
        champs: [
          KitField(label: 'Mot de passe actuel', hint: '••••••••', icon: Icons.lock_outline,
              controller: _actuel, obscure: true),
          const SizedBox(height: 14),
          KitField(label: 'Nouveau mot de passe', hint: '8 caractères minimum', icon: Icons.lock_reset_outlined,
              controller: _nouveau, obscure: true),
          const SizedBox(height: 14),
          KitField(label: 'Confirmer', hint: 'Retapez le nouveau', icon: Icons.lock_reset_outlined,
              controller: _confirmation, obscure: true),
          const SizedBox(height: 12),
          Text('Il faut au moins 8 caractères, une minuscule, une majuscule et un chiffre.',
              style: J.ui(12, c: J.clay500)),
          const SizedBox(height: 6),
          Text('Vous serez déconnecté de tous vos appareils, celui-ci compris.',
              style: J.ui(12, c: J.goldDeep, w: FontWeight.w600)),
        ],
        libelleAction: 'Changer',
        action: () async {
          /* Vérifié ici et pas seulement côté serveur : lui ne reçoit qu'un
             seul des deux champs, il ne peut pas voir la faute de frappe. */
          if (_nouveau.text != _confirmation.text) {
            throw const ApiException('Les deux mots de passe ne correspondent pas.', 400);
          }
          return Api.changePassword(_actuel.text, _nouveau.text);
        },
      ),
    );

    if (message != null && mounted) {
      /* Le serveur a invalidé tous les jetons, celui de cette session compris.
         Rester sur place donnerait une app qui échoue en 401 à chaque geste
         sans jamais dire pourquoi : on ramène à la connexion tout de suite. */
      s.signOut();
      Navigator.of(context).pushAndRemoveUntil(fadeRoute(const WelcomeScreen()), (_) => false);
      _dire(message);
    }
  }

  // ── Construction ───────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final u = s.user;
    return SafeArea(
      bottom: false,
      child: ListView(padding: const EdgeInsets.fromLTRB(20, 24, 20, 120), children: [
        Entrance(child: Text(s.t('me.t'), style: J.serif(34))),
        const SizedBox(height: 22),

        Entrance(delayMs: 80, child: _carteIdentite(s, u)),

        if (u != null) ...[
          const SizedBox(height: 26),
          Text(s.t('me.account'), style: J.mono(10)),
          const SizedBox(height: 10),
          Entrance(delayMs: 140, child: _groupe([
            _Ligne(icone: Icons.badge_outlined, titre: s.t('me.infos'),
                sous: u.phone.isEmpty ? u.email : u.phone, onTap: _modifierInfos),
            _Ligne(icone: Icons.lock_outline, titre: s.t('me.password'),
                sous: s.t('me.passwordSub'), onTap: _changerMotDePasse),
            if (u.role == 'owner')
              _Ligne(
                icone: Icons.verified_user_outlined,
                titre: s.t('me.identity'),
                sous: _libelleVerification(s, u.ownerStatus),
                couleurSous: _couleurVerification(u.ownerStatus),
                onTap: () => Navigator.of(context).push(slideRoute(const VerificationScreen())),
              ),
          ])),
        ],

        const SizedBox(height: 26),
        Text(s.t('me.lang'), style: J.mono(10)),
        const SizedBox(height: 10),
        Row(children: [
          for (final l in ['fr', 'en']) ...[
            Expanded(child: Pressable(
              onTap: () => s.setLang(l),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                height: 50,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: s.lang == l ? J.ink : Colors.transparent,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: s.lang == l ? J.ink : J.line, width: 1.5),
                ),
                child: Text(l == 'fr' ? 'Français' : 'English',
                    style: J.sans(15, c: s.lang == l ? J.cream : J.ink, w: FontWeight.w600)),
              ),
            )),
            if (l == 'fr') const SizedBox(width: 8),
          ],
        ]),

        const SizedBox(height: 26),
        KitButton(
          label: u == null ? s.t('me.login') : s.t('me.signOut'),
          bg: u == null ? J.ink : Colors.white,
          fg: u == null ? Colors.white : J.terracotta,
          onTap: () {
            s.signOut();
            Navigator.of(context).pushAndRemoveUntil(fadeRoute(const WelcomeScreen()), (_) => false);
          },
        ),

        const SizedBox(height: 44),
        // Toucher le logo rejoue l'assemblage
        const Center(child: JigisoLogo(parts: LogoParts.stacked, height: 90, animate: true)),
      ]),
    );
  }

  Widget _carteIdentite(AppState s, AppUser? u) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: J.card,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: J.soft, width: 1.5),
        ),
        child: Row(children: [
          _avatar(u),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(u?.name ?? s.t('me.guest'), style: J.ui(20, w: FontWeight.w800), maxLines: 1, overflow: TextOverflow.ellipsis),
            if (u != null) ...[
              const SizedBox(height: 2),
              Text(u.role == 'owner' ? s.t('me.owner') : s.t('me.tenant'),
                  style: J.ui(13, c: u.role == 'owner' ? J.leaf : J.goldDeep, w: FontWeight.w600)),
              const SizedBox(height: 6),
              Text(u.email, style: J.ui(12, c: J.clay500), maxLines: 1, overflow: TextOverflow.ellipsis),
              /* N'affiche un badge que pour ce qui est réellement vérifié.
                 Une pastille « non vérifié » partout transformerait l'écran en
                 liste de reproches sans rien apprendre. */
              if (u.emailVerified || u.phoneVerified) ...[
                const SizedBox(height: 8),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  if (u.emailVerified) const _Badge(texte: 'Email vérifié'),
                  if (u.phoneVerified) const _Badge(texte: 'Téléphone vérifié'),
                ]),
              ],
            ],
          ])),
        ]),
      );

  Widget _avatar(AppUser? u) {
    final photo = u?.photo ?? '';
    return Pressable(
      onTap: u == null || _envoiPhoto ? null : _changerPhoto,
      child: SizedBox(
        width: 76, height: 76,
        child: Stack(children: [
          Container(
            width: 72, height: 72,
            decoration: BoxDecoration(
              color: J.gold, shape: BoxShape.circle,
              image: photo.isEmpty ? null : DecorationImage(image: NetworkImage(photo), fit: BoxFit.cover),
            ),
            child: photo.isEmpty ? const Icon(Icons.person_rounded, color: J.ink, size: 36) : null,
          ),
          if (_envoiPhoto)
            Container(
              width: 72, height: 72,
              decoration: const BoxDecoration(color: Color(0x9917150F), shape: BoxShape.circle),
              alignment: Alignment.center,
              child: const SizedBox(width: 22, height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2.5, color: J.cream)),
            ),
          // Pastille appareil photo : sans elle, rien n'indique que l'avatar
          // se touche, et personne ne va essayer par hasard.
          if (u != null)
            Positioned(
              right: 0, bottom: 0,
              child: Container(
                width: 26, height: 26,
                decoration: BoxDecoration(
                  color: J.ink, shape: BoxShape.circle,
                  border: Border.all(color: J.card, width: 2),
                ),
                child: const Icon(Icons.photo_camera_rounded, size: 13, color: J.cream),
              ),
            ),
        ]),
      ),
    );
  }

  Widget _groupe(List<Widget> lignes) => Container(
        decoration: BoxDecoration(
          color: J.card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: J.soft, width: 1.5),
        ),
        child: Column(children: [
          for (var i = 0; i < lignes.length; i++) ...[
            if (i > 0) const Divider(height: 1, thickness: 1, color: J.soft, indent: 56),
            lignes[i],
          ],
        ]),
      );

  String _libelleVerification(AppState s, String statut) => switch (statut) {
        'approved' => s.t('me.vApproved'),
        'pending' => s.t('me.vPending'),
        'rejected' => s.t('me.vRejected'),
        _ => s.t('me.vNone'),
      };

  Color _couleurVerification(String statut) => switch (statut) {
        'approved' => J.leaf,
        'pending' => J.gold,
        'rejected' => J.terracotta,
        _ => J.clay500,
      };
}

// ── Petits éléments ──────────────────────────────────────────────────────

class _Badge extends StatelessWidget {
  final String texte;
  const _Badge({required this.texte});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: const Color(0xFFE8F0E9), borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.check_circle, size: 11, color: J.leaf),
          const SizedBox(width: 4),
          Text(texte, style: J.ui(11, c: J.leaf, w: FontWeight.w600)),
        ]),
      );
}

class _Ligne extends StatelessWidget {
  final IconData icone;
  final String titre;
  final String? sous;
  final Color? couleurSous;
  final VoidCallback onTap;
  const _Ligne({required this.icone, required this.titre, this.sous, this.couleurSous, required this.onTap});
  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
          child: Row(children: [
            Icon(icone, size: 22, color: J.clay600),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(titre, style: J.ui(15, w: FontWeight.w600)),
              if (sous != null) ...[
                const SizedBox(height: 2),
                Text(sous!, style: J.ui(12, c: couleurSous ?? J.clay500,
                    w: couleurSous == null ? FontWeight.w500 : FontWeight.w600),
                    maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ])),
            const Icon(Icons.chevron_right_rounded, color: J.clay300),
          ]),
        ),
      );
}

/// Feuille simple : un titre, des lignes.
class _Feuille extends StatelessWidget {
  final String titre;
  final List<Widget> enfants;
  const _Feuille({required this.titre, required this.enfants});
  @override
  Widget build(BuildContext context) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: SafeArea(
          top: false,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const SizedBox(height: 12),
            Container(width: 44, height: 4,
                decoration: BoxDecoration(color: J.soft, borderRadius: BorderRadius.circular(999))),
            const SizedBox(height: 18),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 22),
              child: Align(alignment: Alignment.centerLeft,
                  child: Text(titre, style: J.ui(19, w: FontWeight.w800))),
            ),
            const SizedBox(height: 10),
            ...enfants,
            const SizedBox(height: 10),
          ]),
        ),
      );
}

/// Feuille de formulaire : des champs, un bouton, une erreur en place.
///
/// Elle se referme en renvoyant le résultat de [action] ; en cas d'échec elle
/// reste ouverte avec le message du serveur, pour que ce qui a été saisi ne
/// soit pas perdu.
class _FormulaireSheet<T> extends StatefulWidget {
  final String titre;
  final List<Widget> champs;
  final String libelleAction;
  final Future<T> Function() action;
  const _FormulaireSheet({
    required this.titre,
    required this.champs,
    required this.libelleAction,
    required this.action,
  });
  @override
  State<_FormulaireSheet<T>> createState() => _FormulaireSheetState<T>();
}

class _FormulaireSheetState<T> extends State<_FormulaireSheet<T>> {
  bool _enCours = false;
  String? _erreur;

  Future<void> _valider() async {
    setState(() { _enCours = true; _erreur = null; });
    try {
      final resultat = await widget.action();
      if (mounted) Navigator.pop(context, resultat);
    } catch (e) {
      final texte = e.toString();
      if (!mounted) return;
      setState(() {
        _erreur = texte.contains('Socket') || texte.contains('Timeout')
            ? 'Serveur injoignable. Vérifiez votre connexion.'
            : e is ApiException
                ? e.message
                : 'Une erreur est survenue.';
        _enCours = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
        // Remonte la feuille au-dessus du clavier : sans cela, le bouton
        // « Enregistrer » se retrouve caché dès le premier champ touché.
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: SafeArea(
            top: false,
            child: SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(22, 12, 22, 22),
                child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Center(child: Container(width: 44, height: 4,
                      decoration: BoxDecoration(color: J.soft, borderRadius: BorderRadius.circular(999)))),
                  const SizedBox(height: 18),
                  Text(widget.titre, style: J.ui(19, w: FontWeight.w800)),
                  const SizedBox(height: 18),
                  ...widget.champs,
                  if (_erreur != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFBEDE8),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(children: [
                        const Icon(Icons.error_outline, size: 17, color: J.terracotta),
                        const SizedBox(width: 8),
                        Expanded(child: Text(_erreur!, style: J.ui(13, c: J.terracotta, w: FontWeight.w600))),
                      ]),
                    ),
                  ],
                  const SizedBox(height: 20),
                  KitButton(label: widget.libelleAction, loading: _enCours, onTap: _valider),
                ]),
              ),
            ),
          ),
        ),
      );
}
