import { useState } from 'react';
import AnimatedText from '../components/common/AnimatedText';
import { Link } from 'react-router-dom';
import Icon from '../components/common/Icon';
import { contactAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useT } from '../context/LanguageContext';

const CONTACT_TYPES = [
  { value: 'question',    label: 'Question générale', desc: 'Renseignements sur JIGISO' },
  { value: 'bug',         label: 'Signaler un bug',   desc: 'Problème technique sur le site' },
  { value: 'complaint',   label: 'Réclamation',       desc: 'Un souci avec une annonce ou un utilisateur' },
  { value: 'suggestion',  label: 'Suggestion',        desc: 'Proposer une amélioration' },
  { value: 'partnership', label: 'Partenariat',       desc: 'Proposition de collaboration' },
  { value: 'other',       label: 'Autre',             desc: 'Toute autre demande' },
];

/* Coordonnées réelles. Pas d'adresse physique : il n'y a pas de bureau. */
const CONTACT_EMAIL = 'goitaaboubacar6@gmail.com';
const CONTACT_PHONE = '+22376457841';

const CONTACT_DETAILS = [
  {
    label: 'Email', value: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}`, accent: true,
  },
  {
    label: 'Téléphone · WhatsApp', value: '+223 76 45 78 41',
    href: `tel:${CONTACT_PHONE}`,
    note: 'Lun–Ven, 8h–18h',
  },
];

/* Message d'erreur sous un champ */
function FieldError({ children }) {
  if (!children) return null;
  return (
    <p className="flex items-center gap-1.5 text-terracotta text-[12.5px] mt-1.5">
      <Icon name="exclamation" size={11} /> {children}
    </p>
  );
}

export default function ContactPage() {
  const { user } = useAuth();
  const t = useT();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    senderName: user?.name || '',
    senderEmail: user?.email || '',
    senderPhone: user?.phone || '',
    type: 'question',
    subject: '',
    messageContent: '',
  });

  const selected = CONTACT_TYPES.find(ct => ct.value === form.type);

  const FIELD_LABELS = {
    senderName: 'Nom complet', senderEmail: 'Email',
    subject: 'Sujet', messageContent: 'Message',
  };

  const validate = () => {
    const found = {};
    if (!form.senderName.trim())      found.senderName = t('Indiquez votre nom');
    if (!form.senderEmail.trim())     found.senderEmail = t('Indiquez votre email');
    else if (!/^\S+@\S+\.\S+$/.test(form.senderEmail)) found.senderEmail = t('Adresse email invalide');
    if (!form.subject.trim())         found.subject = t('Donnez un sujet à votre message');
    if (!form.messageContent.trim())  found.messageContent = t('Écrivez votre message');
    return found;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // La validation native du navigateur affichait une bulle en anglais et
    // empêchait ce gestionnaire de s'exécuter : on la désactive (noValidate)
    // et on valide nous-mêmes, en français, champ par champ.
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = Object.keys(found)[0];
      const el = document.getElementById({
        senderName: 'c-name', senderEmail: 'c-email',
        subject: 'c-subject', messageContent: 'c-message',
      }[first]);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
      toast.error(`${FIELD_LABELS[first]} : ${found[first]}`);
      return;
    }

    setLoading(true);
    try {
      const { data } = await contactAPI.sendToAdmin(form);
      toast.success(data.message);
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'envoi");
    } finally {
      setLoading(false);
    }
  };

  /* ── Confirmation ── */
  if (sent) {
    return (
      <div className="max-w-[1280px] mx-auto px-5 sm:px-7 py-24">
        <div className="card max-w-xl mx-auto p-12 text-center">
          <span className="w-16 h-16 rounded-full bg-leaf/12 text-leaf flex items-center justify-center mx-auto mb-6">
            <Icon name="check" size={28} />
          </span>
          <h1 className="font-display font-extrabold text-ink text-[30px] tracking-tight">{t('Message envoyé')}</h1>
          <p className="text-clay-500 mt-3 leading-relaxed">
            {t("L'équipe JIGISO a bien reçu votre demande. Vous recevrez une réponse à")}{' '}
            <strong className="text-ink">{form.senderEmail}</strong> {t('en moins de 24 h.')}
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-8">
            <button onClick={() => setSent(false)} className="btn-secondary">{t('Écrire un autre message')}</button>
            <Link to="/" className="btn-primary">{t("Retour à l'accueil")}</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-5 sm:px-7 py-14">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-8 lg:gap-10 items-start">

        {/* ══════ Colonne gauche ══════ */}
        <div>
          <p className="eyebrow">{t('Contact')}</p>
          <AnimatedText as="h1" className="section-title mt-3 max-w-[28ch]">
            {t('Une question\u00A0? On répond en moins de 24\u00A0h.')}
          </AnimatedText>
          <p className="text-clay-500 text-[15px] leading-relaxed mt-4 max-w-[52ch]">
            {t("Bug, réclamation sur une annonce, suggestion ou partenariat — choisissez le motif, l'équipe concernée reçoit votre message directement.")}
          </p>

          {/* Coordonnées */}
          <div className="relative overflow-hidden rounded-card bg-ink p-8 mt-9">
            <div className="absolute inset-0 hatch-on-dark" />
            <div className="relative space-y-6">
              {CONTACT_DETAILS.map(d => (
                <div key={d.label}>
                  <p className="font-mono text-2xs tracking-eyebrow uppercase text-clay-500">{t(d.label)}</p>
                  {d.href ? (
                    <a href={d.href}
                      className={`block font-display font-bold text-[19px] mt-1.5 hover:underline
                                  ${d.accent ? 'text-gold' : 'text-cream'}`}>
                      {d.value}
                    </a>
                  ) : (
                    <p className="font-display font-bold text-cream text-[19px] mt-1.5">{d.value}</p>
                  )}
                  {d.note && <p className="text-clay-400 text-[13px] mt-0.5">{d.note}</p>}
                  {d.label.includes('WhatsApp') && (
                    <a href={`https://wa.me/${CONTACT_PHONE.replace(/\D/g, '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-mono text-2xs tracking-label uppercase
                                 text-clay-400 hover:text-gold transition-colors mt-2">
                      <Icon name="comment" size={11} /> Écrire sur WhatsApp
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Motif de la demande */}
          <div className="card p-6 mt-5">
            <p className="label">{t('Motif de la demande')}</p>
            <div className="space-y-1 mt-1">
              {CONTACT_TYPES.map(ct => {
                const active = form.type === ct.value;
                return (
                  <button key={ct.value} type="button"
                    onClick={() => setForm(p => ({ ...p, type: ct.value }))}
                    aria-pressed={active}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                      active
                        ? 'border-gold bg-gold/[.07]'
                        : 'border-transparent hover:bg-ink/[.03]'
                    }`}>
                    <span className="block font-display font-bold text-ink text-[15px]">{t(ct.label)}</span>
                    <span className="block text-clay-500 text-[13px] mt-0.5">{t(ct.desc)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ══════ Formulaire ══════ */}
        <div className="card p-6 sm:p-8 lg:sticky lg:top-[90px]">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Rappel du motif choisi */}
            <div className="flex items-center gap-3 bg-cream rounded-xl px-4 py-3.5 border border-cream-line">
              <span className="font-mono text-2xs tracking-label uppercase text-clay-400">{t('Motif')}</span>
              <span className="font-display font-bold text-ink text-[15px]">{t(selected?.label)}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="c-name">{t('Nom complet *')}</label>
                <input id="c-name" aria-invalid={!!errors.senderName} className={`input-field ${errors.senderName ? "border-terracotta focus:border-terracotta focus:ring-terracotta/20" : ""}`} placeholder={t('Votre nom')}
                  value={form.senderName}
                  onChange={e => { setForm(p => ({ ...p, senderName: e.target.value })); setErrors(x => ({ ...x, senderName: undefined })); }} />
                <FieldError>{errors.senderName}</FieldError>
              </div>
              <div>
                <label className="label" htmlFor="c-email">{t('Email *')}</label>
                <input id="c-email" type="email" aria-invalid={!!errors.senderEmail} className={`input-field ${errors.senderEmail ? "border-terracotta focus:border-terracotta focus:ring-terracotta/20" : ""}`} placeholder="vous@email.com"
                  value={form.senderEmail}
                  onChange={e => { setForm(p => ({ ...p, senderEmail: e.target.value })); setErrors(x => ({ ...x, senderEmail: undefined })); }} />
                <FieldError>{errors.senderEmail}</FieldError>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="c-phone">{t('Téléphone')}</label>
                <input id="c-phone" type="tel" className="input-field" placeholder="+223 70 00 00 00"
                  value={form.senderPhone}
                  onChange={e => setForm(p => ({ ...p, senderPhone: e.target.value }))} />
              </div>
              <div>
                <label className="label" htmlFor="c-subject">{t('Sujet *')}</label>
                <input id="c-subject" aria-invalid={!!errors.subject} className={`input-field ${errors.subject ? "border-terracotta focus:border-terracotta focus:ring-terracotta/20" : ""}`} placeholder={t('Résumez en quelques mots')}
                  value={form.subject}
                  onChange={e => { setForm(p => ({ ...p, subject: e.target.value })); setErrors(x => ({ ...x, subject: undefined })); }} />
                <FieldError>{errors.subject}</FieldError>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="c-message">{t('Message *')}</label>
              <textarea id="c-message" aria-invalid={!!errors.messageContent} className={`input-field resize-y ${errors.messageContent ? "border-terracotta focus:border-terracotta focus:ring-terracotta/20" : ""}`} rows={8} maxLength={2000}
                placeholder={t('Décrivez votre demande. Plus vous êtes précis, plus vite on peut aider.')}
                value={form.messageContent}
                onChange={e => { setForm(p => ({ ...p, messageContent: e.target.value })); setErrors(x => ({ ...x, messageContent: undefined })); }} />
              <FieldError>{errors.messageContent}</FieldError>
              <p className="font-mono text-2xs text-clay-300 mt-2 text-right">
                {form.messageContent.length} / 2000
              </p>
            </div>

            <p className="text-clay-400 text-[13px]">
              Vos coordonnées ne sont jamais transmises à un tiers.
            </p>

            <button type="submit" disabled={loading} className="btn-primary px-8 py-3.5">
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-cream border-t-transparent rounded-full animate-spin" />
                  {t('Envoi…')}
                </>
              ) : (
                <>{t('Envoyer le message')}</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
