import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/common/Icon';
import { ConsoleHeader } from '../components/layout/ConsoleHeader';
import { verificationAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const DOCS = [
  { key: 'id_front', label: "Pièce d'identité — recto", hint: "CNI, passeport ou carte consulaire" },
  { key: 'id_back',  label: "Pièce d'identité — verso", hint: 'Non nécessaire pour un passeport' },
  { key: 'selfie',   label: 'Photo de vous avec la pièce', hint: 'Visage et document lisibles' },
];

/* Pastille d'état d'une étape */
function StepBadge({ state }) {
  const map = {
    done:     { label: 'Vérifié',    cls: 'bg-leaf/15 text-leaf' },
    pending:  { label: 'En examen',  cls: 'bg-gold/15 text-gold-deep' },
    rejected: { label: 'Refusé',     cls: 'bg-terracotta/15 text-terracotta' },
    todo:     { label: 'À faire',    cls: 'bg-ink/[.07] text-clay-500' },
  };
  const s = map[state] || map.todo;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

function Step({ n, title, desc, state, children }) {
  const done = state === 'done';
  return (
    <section className={`card p-7 ${done ? 'opacity-75' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0
            font-display font-extrabold text-[15px]
            ${done ? 'bg-leaf text-cream' : 'bg-ink text-cream'}`}>
            {done ? <Icon name="check" size={14} /> : n}
          </span>
          <div>
            <h2 className="font-display font-bold text-ink text-[18px]">{title}</h2>
            <p className="text-clay-500 text-[13.5px] mt-1 max-w-[52ch]">{desc}</p>
          </div>
        </div>
        <StepBadge state={state} />
      </div>
      {!done && children && <div className="mt-6 pl-0 sm:pl-13">{children}</div>}
    </section>
  );
}

export default function VerificationPage() {
  const { user, updateUser } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const [files, setFiles] = useState({});

  const load = () =>
    verificationAPI.getStatus()
      .then(({ data }) => setStatus(data.status))
      .catch(() => toast.error('Statut indisponible'))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const sendEmail = async () => {
    setBusy('email');
    try {
      const { data } = await verificationAPI.sendEmail();
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Envoi impossible');
    } finally { setBusy(''); }
  };

  const submitIdentity = async (e) => {
    e.preventDefault();
    if (!files.id_front) return toast.error("Le recto de la pièce d'identité est obligatoire");
    setBusy('kyc');
    try {
      const data = new FormData();
      Object.entries(files).forEach(([k, f]) => f && data.append(k, f));
      const { data: res } = await verificationAPI.submitIdentity(data);
      toast.success(res.message);
      setFiles({});
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Envoi impossible');
    } finally { setBusy(''); }
  };

  if (loading) {
    return (
      <div className="px-6 sm:px-9 py-9 space-y-4">
        <div className="skeleton h-10 w-72 rounded" />
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-40 rounded-card" />)}
      </div>
    );
  }

  const identityState = {
    approved: 'done', pending: 'pending', rejected: 'rejected', none: 'todo',
  }[status?.identity] || 'todo';

  const allDone = status?.isOwnerVerified;

  return (
    <div className="px-6 sm:px-9 py-9 max-w-[880px]">
      <ConsoleHeader
        eyebrow="Espace propriétaire · Vérification"
        title="Vérifier mon compte"
        stats={[
          { label: 'E-mail',   value: status?.emailVerified ? 'Vérifié' : 'À faire' },
          { label: 'Identité', value: { approved: 'Validée', pending: 'En examen', rejected: 'Refusée', none: 'À faire' }[status?.identity] || 'À faire' },
          { label: 'Publication', value: status?.canPublish ? 'Autorisée' : 'Bloquée',
            note: status?.canPublish ? 'vous pouvez publier' : 'terminez les étapes' },
        ]}
      />

      {allDone && (
        <div className="relative overflow-hidden rounded-card bg-leaf p-6 mt-6">
          <div className="relative flex items-center gap-4">
            <span className="w-11 h-11 rounded-full bg-cream/20 flex items-center justify-center shrink-0">
              <Icon name="shield-check" size={20} className="text-cream" />
            </span>
            <div>
              <p className="font-display font-bold text-cream text-[17px]">Propriétaire vérifié</p>
              <p className="text-cream/80 text-[13.5px] mt-0.5">
                Le badge apparaît sur vos annonces et vous pouvez publier.
              </p>
            </div>
            <Link to="/publier" className="ml-auto btn-primary shrink-0">Publier une annonce</Link>
          </div>
        </div>
      )}

      <div className="space-y-4 mt-6">

        {/* ── 1. E-mail ── */}
        <Step n="1" title="Confirmer votre adresse e-mail" state={status?.emailVerified ? 'done' : 'todo'}
          desc={`Nous envoyons un lien à ${user?.email}. Il est valable 24 heures.`}>
          <button onClick={sendEmail} disabled={busy === 'email'} className="btn-primary">
            {busy === 'email' ? 'Envoi…' : 'Envoyer le lien de confirmation'}
          </button>
          <p className="text-clay-400 text-[13px] mt-3">
            Pensez à regarder dans les indésirables. Une fois le lien ouvert, revenez ici.
          </p>
        </Step>

        {/* ── 2. Identité ── */}
        <Step n="2" title="Vérifier votre identité" state={identityState}
          desc="Nos équipes contrôlent vos pièces à la main. Elles ne sont jamais publiées ni transmises à un tiers.">
          {status?.identity === 'pending' ? (
            <p className="text-clay-500 text-[14px]">
              Dossier reçu, examen sous 48 h. Vous recevrez un e-mail dès la décision.
            </p>
          ) : (
            <form onSubmit={submitIdentity}>
              {status?.identity === 'rejected' && status?.rejectionReason && (
                <div className="bg-terracotta/[.08] border border-terracotta/25 rounded-xl px-4 py-3 mb-5">
                  <p className="font-mono text-2xs tracking-label uppercase text-terracotta">Motif du refus</p>
                  <p className="text-ink text-[14px] mt-1">{status.rejectionReason}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {DOCS.map(d => (
                  <label key={d.key}
                    className={`rounded-xl border border-dashed p-4 cursor-pointer transition-colors text-center
                      ${files[d.key] ? 'border-leaf bg-leaf/[.05]' : 'border-cream-line hover:border-gold'}`}>
                    <Icon name={files[d.key] ? 'check' : 'cloud-upload'} size={20}
                      className={`mx-auto mb-2 ${files[d.key] ? 'text-leaf' : 'text-clay-300'}`} />
                    <span className="block font-semibold text-ink text-[13px]">{d.label}</span>
                    <span className="block text-clay-400 text-[11.5px] mt-1">
                      {files[d.key]?.name?.slice(0, 26) || d.hint}
                    </span>
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={e => setFiles(f => ({ ...f, [d.key]: e.target.files[0] }))} />
                  </label>
                ))}
              </div>

              <p className="text-clay-400 text-[12.5px] mt-4">
                JPG, PNG, WEBP ou PDF — 5 Mo maximum par fichier.
              </p>

              <button type="submit" disabled={busy === 'kyc'} className="btn-primary mt-5">
                {busy === 'kyc' ? 'Envoi…' : 'Envoyer mon dossier'}
              </button>
            </form>
          )}
        </Step>
      </div>
    </div>
  );
}
