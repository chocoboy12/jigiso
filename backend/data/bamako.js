/**
 * Découpage de Bamako et liste des régions du Mali.
 *
 * Les annonces ne stockent pas la commune : elles ont une ville et un
 * quartier. Chercher « Commune IV » revient donc à chercher l'un de ses
 * quartiers — c'est ce que fait cette table, et c'est ce qui permet le
 * filtrage sans migration des données existantes.
 *
 * Les régions, elles, sont stockées dans le champ `city` de l'annonce.
 */

const COMMUNES = {
  'commune i': ['Banconi', 'Boulkassoumbougou', 'Djélibougou', 'Doumanzana', 'Fadjiguila', 'Korofina', 'Sotuba'],
  'commune ii': ['Bagadadji', 'Bozola', 'Hippodrome', 'Médina Coura', 'Missira', 'Niarela', 'Quinzambougou'],
  'commune iii': ['Badialan', 'Bamako-Coura', 'Darsalam', 'Dravéla', 'Koulouba', "N'Tomikorobougou", 'Point G'],
  'commune iv': ['ACI 2000', 'Djicoroni Para', 'Hamdallaye', 'Lafiabougou', 'Sébénikoro', 'Taliko'],
  'commune v': ['Badalabougou', 'Baco Djicoroni', 'Daoudabougou', 'Kalaban Coura', 'Quartier Mali', 'Sabalibougou', 'Torokorobougou'],
  'commune vi': ['Banankabougou', 'Faladié', 'Magnambougou', 'Niamakoro', 'Senou', 'Sogoniko', 'Sokorodji', 'Yirimadio'],
};

const REGIONS = [
  'Kayes', 'Koulikoro', 'Sikasso', 'Ségou', 'Mopti', 'Tombouctou', 'Gao', 'Kidal',
  'Taoudénit', 'Ménaka', 'Bougouni', 'Dioïla', 'Douentza', 'Kita', 'Nara',
  'Nioro du Sahel', 'San', 'Koutiala', 'Bandiagara',
];

/* « COMMUNE IV », « commune 4 », « IV » : on accepte ce que les gens tapent. */
const CHIFFRES = { 1: 'i', 2: 'ii', 3: 'iii', 4: 'iv', 5: 'v', 6: 'vi' };

const quartiersDeLaCommune = (valeur) => {
  if (!valeur) return null;
  let cle = String(valeur).trim().toLowerCase();
  cle = cle.replace(/^commune\s*/, '');
  if (CHIFFRES[cle]) cle = CHIFFRES[cle];
  return COMMUNES[`commune ${cle}`] || null;
};

module.exports = { COMMUNES, REGIONS, quartiersDeLaCommune };
