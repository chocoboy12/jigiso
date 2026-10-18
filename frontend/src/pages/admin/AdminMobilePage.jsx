import { useEffect, useState } from 'react';
import Icon from '../../components/common/Icon';
import { ConsoleHeader } from '../../components/layout/ConsoleHeader';
import { mobileAPI } from '../../services/api';
import toast from 'react-hot-toast';

/**
 * Administration · Application mobile
 * Pilote l'app Flutter à distance : maintenance, versions, fonctionnalités,
 * bannière d'accueil et notifications push. L'app lit GET /app/config au lancement.
 */
const FLAGS = [
  { key: 'google',         label: 'Connexion Google',              note: 'Bouton sur connexion et inscription' },
  { key: 'facebook',       label: 'Connexion Facebook',            note: 'Bouton sur connexion et inscription' },
  { key: 'apple',          label: 'Connexion Apple',               note: 'iPhone uniquement' },
  { key: 'ownerSignup',    label: 'Inscription propriétaire',      note: "Couper pour n'accepter que des locataires" },
  { key: 'kycRequired',    label: 'Vérification avant publication', note: 'Photo + CNI, NINA ou passeport obligatoires' },
  { key: 'rentalRequests', label: 'Demandes de location',          note: '« Demander à louer » sur les fiches' },
];
const BANNER_COLORS = ['#1E6B3C', '#C98A1E', '#B4532A', '#17150F'];
const AUDIENCES = [['all', 'Tous'], ['tenant', 'Locataires'], ['owner', 'Propriétaires'], ['Bamako', 'Bamako']];

const DEFAULT = {
  maintenance: { enabled: false, message: 'Nous améliorons Jigiso. Retour dans une heure environ.' },
  version: { current: '1.0.0', minimum: '1.0.0', playStore: '', appStore: '' },
  flags: { google: true, facebook: true, apple: true, ownerSignup: true, kycRequired: true, rentalRequests: true },
  banner: { enabled: false, text: '', color: '#1E6B3C' },
};

function Toggle({ on, onChange, danger }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className={`w-12 h-7 rounded-pill p-[3px] flex shrink-0 transition-colors ${on ? (danger ? 'bg-terracotta justify-end' : 'bg-leaf justify-end') : 'bg-cream-line justify-start'}`}>
      <span className="w-[22px] h-[22px] rounded-full bg-white shadow" />
    </button>
  );
}

function Section({ title, desc, right, children }) {
  return (
    <section className="card p-6">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h2 className="font-display font-bold text-ink text-[18px]">{title}</h2>
          {desc && <p className="text-clay-500 text-[13.5px] mt-1">{desc}</p>}
        </div>
        {right}
      </div>
      {children && <div className="mt-5 space-y-4">{children}</div>}
    </section>
  );
}

export default function AdminMobilePage() {
  const [cfg, setCfg] = useState(DEFAULT);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [push, setPush] = useState({ title: '', body: '', audience: 'all' });

  useEffect(() => {
    mobileAPI.getConfig().then(({ data }) => setCfg({ ...DEFAULT, ...data.config })).catch(() => {});
    mobileAPI.getStats().then(({ data }) => setStats(data.stats)).catch(() => {});
    mobileAPI.getPushHistory().then(({ data }) => setHistory(data.notifications || [])).catch(() => {});
  }, []);

  const update = (path, value) => {
    setCfg(c => {
      const [a, b] = path.split('.');
      return b ? { ...c, [a]: { ...c[a], [b]: value } } : { ...c, [a]: value };
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await mobileAPI.updateConfig(cfg);
      toast.success("Réglages publiés sur l'application");
      setDirty(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Publication impossible');
    } finally { setSaving(false); }
  };

  const sendPush = async () => {
    if (!push.title) return toast.error('Le titre est obligatoire');
    try {
      const { data } = await mobileAPI.sendPush(push);
      toast.success(`Notification envoyée à ${data.sent ?? '—'} appareils`);
      setHistory(h => [data.notification, ...h].filter(Boolean));
      setPush(p => ({ ...p, title: '', body: '' }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Envoi impossible');
    }
  };

  return (
    <div className="px-6 sm:px-9 py-9 space-y-6">
      <ConsoleHeader
        eyebrow="Administration · Application mobile"
        title="Application mobile"
        actions={
          <>
            {dirty && <span className="text-[13px] font-semibold text-gold-deep">Modifications non publiées</span>}
            <button onClick={save} disabled={!dirty || saving} className="btn-primary disabled:opacity-50">
              <Icon name="paper-plane" size={15} /> {saving ? 'Publication…' : 'Publier les réglages'}
            </button>
          </>
        }
        stats={[
          { label: 'Installations', value: stats?.installs ?? '—', note: stats ? `Android ${stats.android} · iOS ${stats.ios}` : null },
          { label: 'Actifs · 30 j', value: stats?.active30 ?? '—' },
          { label: 'Version publiée', value: cfg.version.current },
          { label: 'État', value: cfg.maintenance.enabled ? 'Maintenance' : 'En ligne' },
        ]}
      />

      <Section title="Mode maintenance" desc="Bloque l'app pour tous les utilisateurs et affiche votre message."
        right={<Toggle danger on={cfg.maintenance.enabled} onChange={v => update('maintenance.enabled', v)} />}>
        {cfg.maintenance.enabled && (
          <textarea className="input-field" rows={2} value={cfg.maintenance.message}
            onChange={e => update('maintenance.message', e.target.value)} />
        )}
      </Section>

      <Section title="Versions" desc="En dessous de la version minimale, l'app demande une mise à jour obligatoire.">
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Version actuelle (stores)</label>
            <input className="input-field" value={cfg.version.current} onChange={e => update('version.current', e.target.value)} /></div>
          <div><label className="label">Version minimale requise</label>
            <input className="input-field" value={cfg.version.minimum} onChange={e => update('version.minimum', e.target.value)} /></div>
          <div><label className="label">Lien Google Play</label>
            <input className="input-field" value={cfg.version.playStore} onChange={e => update('version.playStore', e.target.value)} /></div>
          <div><label className="label">Lien App Store</label>
            <input className="input-field" value={cfg.version.appStore} onChange={e => update('version.appStore', e.target.value)} /></div>
        </div>
      </Section>

      <Section title="Fonctionnalités" desc="Activées ou coupées à distance, sans nouvelle version de l'app.">
        <div className="divide-y divide-cream-line">
          {FLAGS.map(f => (
            <div key={f.key} className="flex items-center gap-4 py-3">
              <div className="flex-1">
                <p className="font-semibold text-[14.5px] text-ink">{f.label}</p>
                <p className="text-clay-400 text-[12.5px]">{f.note}</p>
              </div>
              <Toggle on={!!cfg.flags[f.key]} onChange={v => update('flags', { ...cfg.flags, [f.key]: v })} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Bannière d'accueil" desc="Message affiché en haut de l'accueil locataire."
        right={<Toggle on={cfg.banner.enabled} onChange={v => update('banner.enabled', v)} />}>
        <input className="input-field" value={cfg.banner.text} placeholder="Ex. Nouveaux logements à Ségou"
          onChange={e => update('banner.text', e.target.value)} />
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xs tracking-label uppercase text-clay-400 mr-2">Couleur</span>
          {BANNER_COLORS.map(c => (
            <button key={c} type="button" onClick={() => update('banner.color', c)} aria-label={c}
              className={`w-8 h-8 rounded-full ring-offset-2 ${cfg.banner.color === c ? 'ring-2 ring-ink' : ''}`} style={{ background: c }} />
          ))}
        </div>
      </Section>

      <Section title="Notification push" desc="Envoyée immédiatement sur les téléphones.">
        <input className="input-field" placeholder="Titre" value={push.title} onChange={e => setPush(p => ({ ...p, title: e.target.value }))} />
        <textarea className="input-field" rows={2} placeholder="Message" value={push.body} onChange={e => setPush(p => ({ ...p, body: e.target.value }))} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-2xs tracking-label uppercase text-clay-400 mr-2">Audience</span>
          {AUDIENCES.map(([v, l]) => (
            <button key={v} type="button" onClick={() => setPush(p => ({ ...p, audience: v }))}
              className={`px-4 py-2 rounded-pill text-[13px] font-semibold border ${push.audience === v ? 'bg-ink text-cream border-ink' : 'border-cream-line text-ink'}`}>{l}</button>
          ))}
          <button onClick={sendPush} className="btn-primary ml-auto"><Icon name="paper-plane" size={15} /> Envoyer</button>
        </div>
        {history.length > 0 && (
          <div className="divide-y divide-cream-line">
            {history.map(h => (
              <div key={h._id || h.title + h.createdAt} className="flex items-center gap-3 py-3">
                <Icon name="check" size={15} className="text-leaf" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[14px] truncate">{h.title}</p>
                  <p className="text-clay-400 text-[12.5px]">{h.audience} · {new Date(h.createdAt).toLocaleDateString('fr-FR')}</p>
                </div>
                <span className="font-mono text-2xs text-clay-400">{h.sent} ENVOIS</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
