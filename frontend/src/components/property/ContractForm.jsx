import { useAuth } from '../../context/AuthContext';
import { PROPERTY_TYPES, formatNumber } from '../../utils/helpers';
import Icon from '../common/Icon';

/* Charges que le bailleur peut déclarer comprises dans le loyer. Une liste
   fermée plutôt qu'un champ libre : le locataire peut ainsi comparer deux
   annonces sans déchiffrer deux formulations différentes de la même chose. */
export const CHARGES = [
  { key: 'eau',         label: 'Eau' },
  { key: 'electricite', label: 'Électricité' },
  { key: 'internet',    label: 'Internet' },
  { key: 'ordures',     label: 'Ramassage des ordures' },
  { key: 'gardiennage', label: 'Gardiennage' },
  { key: 'entretien',   label: 'Entretien des parties communes' },
];

/* Genre grammatical des types de bien. Sans lui, l'article 1 écrit
   « un villa … non meublé » : sur un document qu'on signe, la faute
   d'accord décrédibilise tout le reste. */
const GENRE = {
  maison: 'f', appartement: 'm', studio: 'm', chambre: 'f',
  villa: 'f', bureau: 'm', terrain: 'm',
};

export const CONTRAT_VIDE = {
  minimumDuration: '',
  noticePeriod: '',
  depositMonths: '',
  advanceMonths: '',
  paymentDay: '',
  chargesIncluded: [],
  obligations: '',
  rules: [],
  terminationTerms: '',
  extraTerms: '',
};

/* Champs sans lesquels le serveur refusera la publication. Gardé ici, à côté
   du formulaire, pour que la page d'ajout n'ait pas à répéter la règle. */
export const CONTRAT_REQUIS = [
  'minimumDuration', 'noticePeriod', 'depositMonths',
  'advanceMonths', 'paymentDay', 'obligations', 'terminationTerms',
];

export const contratComplet = (c) =>
  CONTRAT_REQUIS.every(k => String(c?.[k] ?? '').trim() !== '');

/* Un trait à remplir, à la manière du document papier : le champ se fond
   dans la phrase au lieu de la découper en cases. */
function Trait({ value, onChange, placeholder, width = 'w-32', type = 'text', ...reste }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`${width} inline-block bg-transparent border-0 border-b border-clay-300
                  px-1 py-0.5 text-ink text-[14.5px] font-medium
                  placeholder:text-clay-300 placeholder:font-normal
                  focus:outline-none focus:border-gold focus:bg-gold/5
                  transition-colors`}
      {...reste}
    />
  );
}

function Article({ n, titre, children }) {
  return (
    <section className="pt-5">
      <h3 className="font-display font-bold text-ink text-[15px] mb-2.5">
        {n}. {titre}
      </h3>
      <div className="text-[14.5px] leading-[2.1] text-clay-600">{children}</div>
    </section>
  );
}

/**
 * Le contrat que le bailleur rédige avant de publier.
 *
 * Présenté comme le document lui-même, et non comme une suite de champs :
 * le bailleur voit la phrase qu'il signera, pas une étiquette abstraite.
 * Il s'engage plus sérieusement sur « le préavis est de ___ » que sur une
 * case intitulée « préavis ».
 *
 * La colonne PRENEUR reste vide : elle se remplit toute seule le jour où une
 * demande est acceptée. L'afficher grisée dès maintenant montre au bailleur
 * que le document est incomplet par construction, pas par oubli.
 */
export default function ContractForm({ value, onChange, bien }) {
  const { user } = useAuth();
  const c = value;

  const set = (champ) => (e) => onChange({ ...c, [champ]: e.target.value });

  const basculeCharge = (key) => onChange({
    ...c,
    chargesIncluded: c.chargesIncluded.includes(key)
      ? c.chargesIncluded.filter(x => x !== key)
      : [...c.chargesIncluded, key],
  });

  const typeLabel = PROPERTY_TYPES.find(t => t.value === bien.type)?.label;
  const loyer = bien.price ? `${formatNumber(bien.price)} FCFA` : null;

  /* Article 1 : repris de l'annonce, jamais ressaisi. Deux saisies du même
     fait finissent toujours par se contredire. */
  const feminin = GENRE[bien.type] === 'f';
  const accord = (mot) => (feminin ? `${mot}e` : mot);
  /* Sans type choisi, la phrase n'a pas de sujet : « en location un non
     meublé » ne veut rien dire. On préfère alors n'afficher que l'invite. */
  const objet = !bien.type ? '' : [
    typeLabel?.toLowerCase(),
    bien.area && `de ${bien.area} m²`,
    bien.furnished ? accord('meublé') : `non ${accord('meublé')}`,
    (bien.neighborhood || bien.city)
      && `${accord('situé')} à ${[bien.address, bien.neighborhood, bien.city].filter(Boolean).join(', ')}`,
  ].filter(Boolean).join(' ');

  return (
    <div className="rounded-card border border-clay-200 bg-white overflow-hidden">
      {/* Bandeau : reprend la vague du modèle, aux couleurs de JIGISO */}
      <div className="relative h-14 bg-ink overflow-hidden">
        <div className="absolute -right-10 -top-16 w-64 h-40 rounded-full bg-gold/25" />
        <div className="absolute -right-24 -top-10 w-64 h-40 rounded-full bg-gold/15" />
        <div className="relative h-full px-7 flex items-center">
          <span className="font-mono text-2xs tracking-label uppercase text-cream/70">
            JIGISO · Document contractuel
          </span>
        </div>
      </div>

      <div className="px-7 sm:px-9 py-7">
        <h2 className="font-display font-extrabold text-ink text-[26px] sm:text-[30px] tracking-tight">
          CONTRAT DE LOCATION
        </h2>

        <p className="text-[14.5px] text-clay-600 mt-3 leading-[2.1]">
          Le présent contrat est établi le{' '}
          <span className="text-clay-400 border-b border-dashed border-clay-300 px-6">
            à la signature
          </span>{' '}
          entre les parties désignées ci-dessous :
        </p>

        {/* ══════ Les deux parties ══════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6 mt-6">
          <div>
            <p className="font-mono text-2xs tracking-label uppercase text-gold-deep mb-3">
              Le bailleur
            </p>
            <dl className="space-y-2 text-[14px]">
              {[
                ['Nom', user?.name],
                ['Téléphone', user?.phone],
                ['E-mail', user?.email],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-20 shrink-0 text-clay-500">{k}</dt>
                  <dd className="flex-1 font-medium text-ink border-b border-clay-200 pb-0.5">
                    {v || <span className="text-clay-300 font-normal">— à compléter dans votre profil</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <p className="font-mono text-2xs tracking-label uppercase text-clay-400 mb-3">
              Le preneur
            </p>
            <dl className="space-y-2 text-[14px]">
              {['Nom', 'Téléphone', 'E-mail'].map(k => (
                <div key={k} className="flex gap-3">
                  <dt className="w-20 shrink-0 text-clay-400">{k}</dt>
                  <dd className="flex-1 border-b border-dashed border-clay-200 pb-0.5" />
                </div>
              ))}
            </dl>
            <p className="flex items-start gap-2 mt-3 text-[12.5px] text-clay-500 leading-relaxed">
              <Icon name="info" size={12} className="mt-1 shrink-0 text-gold" />
              Rempli automatiquement avec le locataire dont vous accepterez la demande.
            </p>
          </div>
        </div>

        <div className="h-px bg-clay-200 mt-7" />

        {/* ══════ Article 1 — repris de l'annonce ══════ */}
        <Article n="1" titre="Objet du bail">
          Le bailleur donne en location{' '}
          {objet
            ? <span className="font-medium text-ink">{feminin ? 'une' : 'un'} {objet}</span>
            : <span className="text-clay-300">— complétez le bien ci-dessus pour voir cette ligne</span>}
          , tel que décrit dans l'annonce publiée sur JIGISO.
        </Article>

        {/* ══════ Article 2 — durée ══════ */}
        <Article n="2" titre="Durée du bail">
          Le bail est consenti pour une durée minimale de{' '}
          <Trait value={c.minimumDuration} onChange={set('minimumDuration')}
            placeholder="12 mois" width="w-28" />
          {' '}à compter de la date d'entrée convenue avec le preneur.
          <br />
          Chaque partie peut y mettre fin en respectant un préavis de{' '}
          <Trait value={c.noticePeriod} onChange={set('noticePeriod')}
            placeholder="1 mois" width="w-24" />.
        </Article>

        {/* ══════ Article 3 — loyer et charges ══════ */}
        <Article n="3" titre="Loyer, caution et avance">
          Le loyer mensuel est de{' '}
          {loyer
            ? <span className="font-bold text-ink">{loyer}</span>
            : <span className="text-clay-300">— indiquez le loyer ci-dessus</span>}
          , payable le{' '}
          <Trait value={c.paymentDay} onChange={set('paymentDay')} type="number"
            min="1" max="31" placeholder="5" width="w-14" />
          {' '}de chaque mois.
          <br />
          Le preneur verse à l'entrée une caution de{' '}
          <Trait value={c.depositMonths} onChange={set('depositMonths')} type="number"
            min="0" max="24" placeholder="2" width="w-14" />
          {' '}mois de loyer et une avance de{' '}
          <Trait value={c.advanceMonths} onChange={set('advanceMonths')} type="number"
            min="0" max="24" placeholder="3" width="w-14" />
          {' '}mois.

          {/* Montants calculés : une caution de 2 mois ne parle pas autant
              que la somme réellement à sortir le jour de l'entrée. */}
          {bien.price > 0 && (c.depositMonths !== '' || c.advanceMonths !== '') && (
            <p className="mt-3 inline-flex flex-wrap items-center gap-x-2 gap-y-1
                          rounded-xl bg-cream px-4 py-2.5 text-[13px] leading-normal">
              <Icon name="coins" size={12} className="text-gold-deep" />
              <span className="text-clay-600">À verser à l'entrée :</span>
              <span className="font-bold text-ink">
                {formatNumber(
                  bien.price * ((Number(c.depositMonths) || 0) + (Number(c.advanceMonths) || 0))
                )} FCFA
              </span>
              <span className="text-clay-500">
                ({(Number(c.depositMonths) || 0) + (Number(c.advanceMonths) || 0)} mois de loyer)
              </span>
            </p>
          )}

          <div className="mt-4">
            <p className="text-[13px] text-clay-500 mb-2">Charges comprises dans le loyer :</p>
            <div className="flex flex-wrap gap-2">
              {CHARGES.map(ch => {
                const on = c.chargesIncluded.includes(ch.key);
                return (
                  <button key={ch.key} type="button" onClick={() => basculeCharge(ch.key)}
                    aria-pressed={on}
                    className={`px-3 py-1.5 rounded-pill text-[13px] font-medium border transition-colors ${
                      on
                        ? 'bg-ink text-cream border-ink'
                        : 'bg-white text-clay-600 border-clay-200 hover:border-clay-300'
                    }`}>
                    {ch.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[12.5px] text-clay-400 mt-2">
              Ce qui n'est pas coché reste à la charge du preneur.
            </p>
          </div>
        </Article>

        {/* ══════ Article 4 — obligations ══════ */}
        <Article n="4" titre="Obligations des parties">
          <textarea
            value={c.obligations}
            onChange={set('obligations')}
            rows={5}
            maxLength={3000}
            placeholder={
              "Exemple : le bailleur garantit l'accès à l'eau et à l'électricité et prend en charge "
              + "les grosses réparations. Le preneur entretient le logement, règle son loyer à la date "
              + "convenue et ne sous-loue pas sans accord écrit."
            }
            className="input-field min-h-[120px] leading-relaxed"
          />
          <ListeLibre
            items={c.rules}
            onChange={(rules) => onChange({ ...c, rules })}
            label="Règles de la maison"
            placeholder="Pas d'animaux · Pas de musique après 22 h · Visites annoncées…"
            max={12}
          />
        </Article>

        {/* ══════ Article 5 — résiliation ══════ */}
        <Article n="5" titre="Résiliation">
          <textarea
            value={c.terminationTerms}
            onChange={set('terminationTerms')}
            rows={4}
            maxLength={3000}
            placeholder={
              "Exemple : en cas de loyers impayés pendant deux mois consécutifs, de dégradation du "
              + "logement ou de sous-location non autorisée, le bail peut être résilié après mise en "
              + "demeure restée sans effet pendant quinze jours."
            }
            className="input-field min-h-[100px] leading-relaxed"
          />
        </Article>

        {/* ══════ Article 6 — clauses libres ══════ */}
        <Article n="6" titre={<>Clauses particulières <span className="font-normal text-clay-400">(facultatif)</span></>}>
          <textarea
            value={c.extraTerms}
            onChange={set('extraTerms')}
            rows={3}
            maxLength={3000}
            placeholder="Tout ce que les deux lignes précédentes ne couvrent pas."
            className="input-field min-h-[80px] leading-relaxed"
          />
        </Article>

        {/* ══════ Signatures ══════ */}
        <div className="grid grid-cols-2 gap-10 mt-9 pt-7 border-t border-clay-200">
          {['Le bailleur', 'Le preneur'].map(r => (
            <div key={r} className="text-center">
              <div className="h-10 border-b border-clay-300" />
              <p className="font-mono text-2xs tracking-label uppercase text-clay-400 mt-2">{r}</p>
            </div>
          ))}
        </div>

        <p className="flex items-start gap-2 mt-6 text-[12.5px] text-clay-500 leading-relaxed">
          <Icon name="info" size={12} className="mt-0.5 shrink-0 text-clay-400" />
          Ce document est un modèle fourni par JIGISO. Il n'a pas été rédigé par un juriste :
          pour un bail de longue durée ou un montant important, faites-le relire par un
          professionnel du droit malien.
        </p>
      </div>
    </div>
  );
}

/* Liste d'éléments courts qu'on ajoute un par un. Séparé du reste pour que
   les règles de la maison et, plus tard, d'autres énumérations partagent le
   même comportement. */
function ListeLibre({ items, onChange, label, placeholder, max = 10 }) {
  const modifier = (i, v) => onChange(items.map((x, j) => (j === i ? v : x)));
  const retirer = (i) => onChange(items.filter((_, j) => j !== i));

  return (
    <div className="mt-4">
      <p className="text-[13px] text-clay-500 mb-2">{label}</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
            <input
              value={item}
              onChange={(e) => modifier(i, e.target.value)}
              maxLength={160}
              className="input-field flex-1 py-2"
            />
            <button type="button" onClick={() => retirer(i)}
              aria-label={`Retirer « ${item || 'cette règle'} »`}
              className="w-8 h-8 grid place-items-center rounded-lg text-clay-400
                         hover:text-terracotta hover:bg-terracotta/10 transition-colors">
              <Icon name="cross-small" size={14} />
            </button>
          </div>
        ))}
      </div>
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, ''])}
          className="mt-2 inline-flex items-center gap-1.5 font-mono text-2xs tracking-label
                     uppercase text-clay-500 hover:text-gold transition-colors">
          <Icon name="plus-small" size={12} />
          Ajouter une règle
        </button>
      )}
      {items.length === 0 && (
        <p className="text-[12.5px] text-clay-400 mt-1">{placeholder}</p>
      )}
    </div>
  );
}
