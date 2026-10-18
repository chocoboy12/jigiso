import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import FaceIcon from './FaceIcon';
import Icon from '../common/Icon';
import { feedbackAPI } from '../../services/api';
import { useT } from '../../context/LanguageContext';
import toast from 'react-hot-toast';

/**
 * « Donnez-nous votre avis » — retour sur le site, pas sur un logement.
 *
 * Volontairement ouvert aux visiteurs non connectés : exiger un compte pour
 * signaler un problème ferait perdre les retours des personnes que
 * l'inscription a justement découragées.
 *
 * Seul le choix du visage est obligatoire. Un retour en un clic en vaut dix
 * qu'on n'aura jamais parce que le formulaire était trop long.
 */
const NIVEAUX = [
  { v: 1, libelle: 'Très insatisfait' },
  { v: 2, libelle: 'Insatisfait' },
  { v: 3, libelle: 'Neutre' },
  { v: 4, libelle: 'Satisfait' },
  { v: 5, libelle: 'Très satisfait' },
];

export default function FeedbackModal({ open, onClose }) {
  const t = useT();
  const { pathname } = useLocation();
  const [note, setNote] = useState(null);
  const [commentaire, setCommentaire] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const premierRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    premierRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /* Remise à zéro à la fermeture, pour que la fenêtre ne rouvre pas
     sur le remerciement de la fois précédente. */
  useEffect(() => {
    if (open) return;
    const id = setTimeout(() => { setNote(null); setCommentaire(''); setEnvoye(false); }, 300);
    return () => clearTimeout(id);
  }, [open]);

  if (!open) return null;

  const envoyer = async () => {
    if (!note) return;
    setEnvoi(true);
    try {
      await feedbackAPI.send({ rating: note, comment: commentaire.trim(), page: pathname });
      setEnvoye(true);
      setTimeout(onClose, 2200);
    } catch (err) {
      toast.error(err.response?.data?.message || t('Envoi impossible pour le moment.'));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-5"
      role="dialog" aria-modal="true" aria-label={t('Donnez-nous votre avis')}>
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-cream-card w-full sm:max-w-[460px] rounded-t-card sm:rounded-card
                      shadow-dark p-7 sm:p-8">
        <button onClick={onClose} aria-label={t('Fermer')}
          className="absolute top-5 right-5 text-clay-400 hover:text-ink transition-colors">
          <Icon name="cross" size={15} />
        </button>

        {envoye ? (
          <div className="text-center py-7">
            <span className="w-14 h-14 rounded-full bg-leaf/12 text-leaf grid place-items-center mx-auto mb-5">
              <Icon name="check" size={24} />
            </span>
            <h2 className="font-display font-bold text-ink text-[20px]">{t('Merci !')}</h2>
            <p className="text-clay-500 text-[14px] mt-2">
              {t('Votre retour nous aide à améliorer JIGISO.')}
            </p>
          </div>
        ) : (
          <>
            <h2 className="font-display font-bold text-ink text-[22px] pr-8">
              {t('Donnez-nous votre avis')}
            </h2>
            <p className="text-clay-500 text-[14px] mt-1.5">
              {t('Comment s\'est passée votre visite sur JIGISO ?')}
            </p>

            {/* Échelle de satisfaction */}
            <div className="flex justify-between gap-2 mt-7">
              {NIVEAUX.map((n, idx) => {
                const actif = note === n.v;
                return (
                  <button key={n.v} type="button"
                    ref={idx === 0 ? premierRef : undefined}
                    onClick={() => setNote(n.v)}
                    aria-pressed={actif}
                    aria-label={t(n.libelle)}
                    title={t(n.libelle)}
                    className={`flex-1 aspect-square rounded-xl grid place-items-center border-2
                                transition-all duration-150 ${
                      actif
                        ? 'border-gold bg-gold/10 text-gold-deep scale-105'
                        : 'border-transparent bg-cream text-clay-400 hover:text-ink hover:bg-cream-line'
                    }`}>
                    <FaceIcon level={n.v} size={30} />
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between mt-2.5 font-mono text-2xs tracking-label uppercase text-clay-400">
              <span>{t('Insatisfait')}</span>
              <span>{t('Satisfait')}</span>
            </div>

            <label className="block mt-7">
              <span className="font-display font-bold text-ink text-[15px]">
                {t('Dites-nous en plus')}{' '}
                <span className="font-sans font-normal text-clay-400 text-[13.5px]">
                  {t('(facultatif)')}
                </span>
              </span>
              <textarea rows={4} maxLength={1000}
                value={commentaire} onChange={e => setCommentaire(e.target.value)}
                placeholder={t('Ce qui vous a plu, ce qui vous a bloqué…')}
                className="input-field resize-y mt-2" />
            </label>

            <button onClick={envoyer} disabled={!note || envoi}
              className="btn-primary w-full justify-center mt-5 disabled:opacity-40 disabled:cursor-not-allowed">
              {envoi ? t('Envoi…') : t('Envoyer')}
            </button>

            {!note && (
              <p className="text-clay-400 text-[12.5px] text-center mt-2.5">
                {t('Choisissez un visage pour activer l\'envoi.')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
