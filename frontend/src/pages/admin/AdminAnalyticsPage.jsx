import { useState, useEffect } from 'react';
import { ConsoleHeader } from '../../components/layout/ConsoleHeader';
import LineChart from '../../components/charts/LineChart';
import BarChart from '../../components/charts/BarChart';
import PieChart from '../../components/charts/PieChart';
import { SERIES, libelleSemaine } from '../../components/charts/theme';
import Icon from '../../components/common/Icon';
import { useFormeGraphique } from '../../components/charts/useFormeGraphique';
import { adminAPI } from '../../services/api';
import { formatNumber, PROPERTY_TYPES } from '../../utils/helpers';

/**
 * Tableau de bord analytique.
 *
 * Tous les chiffres viennent d'agrégations sur la base. Rien n'est estimé,
 * et les périodes sans activité valent zéro — pas d'interpolation qui
 * ferait croire à une tendance.
 *
 * Chaque graphique a un état vide explicite : avec une seule annonce, un
 * diagramme à une barre n'apprend rien et vaut moins qu'une phrase.
 */

/* Chiffre vedette : police d'interface, chasse proportionnelle.
   Les chiffres alignés en colonne (tableau, axes) prennent la chasse fixe,
   pas ceux-ci. */
function Tuile({ libelle, valeur, note, accent }) {
  return (
    <div className="card p-5">
      <p className="font-mono text-2xs tracking-label uppercase text-clay-400">{libelle}</p>
      <p className="font-sans font-bold text-ink text-[32px] leading-none mt-2.5"
        style={accent ? { color: accent } : undefined}>
        {valeur}
      </p>
      {note && <p className="text-clay-500 text-[12.5px] mt-1.5">{note}</p>}
    </div>
  );
}

function Carte({ titre, sous, children, vide, forme, setForme }) {
  return (
    <section className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-ink text-[16.5px]">{titre}</h2>
          {sous && <p className="text-clay-500 text-[13px] mt-1">{sous}</p>}
        </div>

        {/* Bascule barres / anneau. Les barres classent et comparent, l'anneau
            montre une part dans un tout : ce sont deux lectures différentes,
            pas deux habillages du même graphique. */}
        {setForme && !vide && (
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-pill border border-ink/10 shrink-0">
            {[
              { v: 'barres', icon: 'chart-histogram', libelle: 'Barres' },
              { v: 'anneau', icon: 'chart-pie',       libelle: 'Anneau' },
            ].map(f => (
              <button key={f.v} type="button" onClick={() => setForme(f.v)}
                aria-pressed={forme === f.v} title={f.libelle}
                className={`px-3 py-1.5 rounded-pill text-[12px] font-semibold inline-flex items-center gap-1.5
                            transition-colors ${
                  forme === f.v ? 'bg-ink text-cream' : 'text-clay-500 hover:text-ink'}`}>
                <Icon name={f.icon} size={12} /> {f.libelle}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5">
        {vide
          ? <p className="text-clay-400 text-[13.5px] py-8 text-center">{vide}</p>
          : children}
      </div>
    </section>
  );
}

export default function AdminAnalyticsPage() {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tableau, setTableau] = useState(false);
  /* Une préférence par carte, mémorisée : l'admin retrouve sa vue. */
  const [formeVilles, setFormeVilles] = useFormeGraphique('villes');
  const [formeTypes, setFormeTypes] = useFormeGraphique('types');
  const [formeStatuts, setFormeStatuts] = useFormeGraphique('statuts');

  useEffect(() => {
    adminAPI.getAnalytics()
      .then(({ data }) => setD(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="px-6 sm:px-9 py-9">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-card" />)}
        </div>
        <div className="skeleton h-72 rounded-card mt-6" />
      </div>
    );
  }
  if (!d) return <p className="px-9 py-9 text-clay-500">Chiffres indisponibles.</p>;

  const k = d.kpis;
  const activite = d.activite.map(s => ({ x: s.semaine, annonces: s.annonces, comptes: s.comptes }));
  const totalPeriode = activite.reduce((a, s) => a + s.annonces + s.comptes, 0);

  const villes = d.parVille.map(v => ({
    nom: v.ville, valeur: v.annonces,
    detail: v.prixMoyen ? `${formatNumber(v.prixMoyen)} F` : undefined,
  }));
  const types = d.parType.map(t => ({
    nom: PROPERTY_TYPES.find(p => p.value === t.type)?.label || t.type,
    valeur: t.annonces,
  }));

  const moderation = [
    { nom: 'Publiées', valeur: d.moderation.publiees },
    { nom: 'En attente', valeur: d.moderation.enAttente },
    { nom: 'Refusées', valeur: d.moderation.refusees },
    { nom: 'Louées', valeur: d.moderation.loues },
  ].filter(x => x.valeur > 0);

  return (
    <div className="px-6 sm:px-9 py-9">
      <ConsoleHeader
        eyebrow="Administration · Statistiques"
        title="Vue d'ensemble"
        stats={[
          { label: 'Annonces publiées', value: formatNumber(k.annonces) },
          { label: 'En attente', value: formatNumber(k.enAttente),
            note: k.enAttente ? 'à traiter' : 'file vide' },
          { label: 'Propriétaires', value: formatNumber(k.proprietaires) },
          { label: 'Vues cumulées', value: formatNumber(k.vues) },
        ]}
      />

      {/* ── Chiffres secondaires ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <Tuile libelle="Locataires inscrits" valeur={formatNumber(k.locataires)} />
        <Tuile libelle="Dossiers d'identité" valeur={formatNumber(k.kycEnAttente)}
          note={k.kycEnAttente ? 'en attente de revue' : 'aucun en attente'} />
        <Tuile libelle="Avis locataires" valeur={formatNumber(k.avis)}
          note={k.noteMoyenne ? `note moyenne ${k.noteMoyenne}/5` : 'aucun avis'} />
        <Tuile libelle="Retours sur le site" valeur={formatNumber(k.retours)}
          note={k.satisfaction ? `satisfaction ${k.satisfaction}/5` : 'aucun retour'} />
      </div>

      {/* ── Activité ── */}
      <div className="mt-6">
        <Carte
          titre="Activité des 12 dernières semaines"
          sous="Annonces déposées et comptes créés, par semaine."
          vide={totalPeriode === 0
            ? "Aucune annonce ni inscription sur la période. Le graphique apparaîtra dès la première activité."
            : null}>
          <LineChart
            data={activite}
            series={[{ cle: 'annonces', nom: 'Annonces déposées' },
                     { cle: 'comptes', nom: 'Comptes créés' }]}
            formatX={libelleSemaine}
          />
        </Carte>
      </div>

      {/* ── Répartitions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Carte
          titre="Annonces par ville"
          sous="Prix moyen indiqué à droite."
          forme={formeVilles} setForme={setFormeVilles}
          vide={villes.length < 2
            ? villes.length === 1
              ? `Une seule ville couverte : ${villes[0].nom}, ${villes[0].valeur} annonce. Ni barre ni anneau n'apprendraient rien de plus.`
              : 'Aucune annonce publiée.'
            : null}>
          {formeVilles === 'anneau'
            ? <PieChart data={villes} />
            : <BarChart data={villes} couleur={SERIES[0]} />}
        </Carte>

        <Carte
          titre="Annonces par type"
          forme={formeTypes} setForme={setFormeTypes}
          vide={types.length < 2
            ? types.length === 1
              ? `Un seul type publié : ${types[0].nom}.`
              : 'Aucune annonce publiée.'
            : null}>
          {formeTypes === 'anneau'
            ? <PieChart data={types} />
            : <BarChart data={types} couleur={SERIES[1]} />}
        </Carte>
      </div>

      {/* ── Modération ── */}
      <div className="mt-6">
        <Carte
          titre="État du catalogue"
          sous="Répartition des annonces par statut."
          forme={formeStatuts} setForme={setFormeStatuts}
          vide={moderation.length === 0
            ? 'Aucune annonce en base.'
            : moderation.length === 1
              // Un diagramme à une seule barre ne compare rien : la phrase
              // porte la même information et se lit plus vite.
              ? `Toutes les annonces sont dans le même état : ${moderation[0].valeur} ${moderation[0].nom.toLowerCase()}.`
              : null}>
          {formeStatuts === 'anneau'
            ? <PieChart data={moderation} />
            : <BarChart data={moderation} couleur={SERIES[2]} />}
        </Carte>
      </div>

      {/* ── Vue tableau ──
          Obligatoire : deux teintes de série passent sous le seuil de
          contraste de 3:1 avec le fond. Les valeurs doivent donc rester
          lisibles sans dépendre de la couleur. */}
      <div className="mt-6">
        <button onClick={() => setTableau(t => !t)}
          className="btn-secondary inline-flex items-center gap-2">
          <Icon name={tableau ? 'angle-up' : 'angle-down'} size={13} />
          {tableau ? 'Masquer le tableau' : 'Afficher les chiffres en tableau'}
        </button>

        {tableau && (
          <div className="card overflow-x-auto mt-4">
            <table className="w-full text-[13.5px]">
              <caption className="sr-only">Activité hebdomadaire</caption>
              <thead className="bg-cream border-b border-cream-line">
                <tr>
                  {['Semaine du', 'Annonces déposées', 'Comptes créés'].map(h => (
                    <th key={h} scope="col"
                      className="text-left font-mono text-2xs tracking-label uppercase text-clay-500 px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-line">
                {activite.map(s => (
                  <tr key={s.x}>
                    <td className="px-5 py-2.5 text-clay-600">{libelleSemaine(s.x)}</td>
                    <td className="px-5 py-2.5 text-ink" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {s.annonces}
                    </td>
                    <td className="px-5 py-2.5 text-ink" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {s.comptes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-clay-400 text-[12.5px] mt-6">
        Chiffres calculés en direct sur la base, période du {d.periode.depuis} à aujourd'hui.
      </p>
    </div>
  );
}
