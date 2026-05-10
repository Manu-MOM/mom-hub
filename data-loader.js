/**
 * MOM Hub · Data Loader
 *
 * Charge les référentiels du MOM Core depuis le sous-dossier /data/ du repo,
 * et les expose globalement sur l'objet window.MOMCore.
 *
 * Usage dans une page HTML :
 *
 *   <script src="js/data-loader.js"></script>
 *   <script>
 *     MOMCore.load().then(() => {
 *       console.log('Pôles chargés :', MOMCore.poles);
 *       console.log('Catégories chargées :', MOMCore.categories);
 *       // ... travailler avec les données
 *     });
 *   </script>
 *
 * Ou en async/await :
 *
 *   await MOMCore.load();
 *   const m14 = MOMCore.findCategorie('M14');
 *
 * Les données sont mises en cache après le premier chargement (variable globale).
 *
 * Version : 1.0 — mai 2026
 */

(function (global) {
  'use strict';

  // Liste des 9 référentiels métier à charger
  const REFERENTIELS = [
    'poles',
    'categories',
    'clubs',
    'postes',
    'aptitudes',
    'ateliers',
    'observables-match',
    'tests-physiques',
    'conformite-ffr'
  ];

  // Préfixe relatif vers le dossier des données.
  // Important : pas de slash de tête, pour que ça marche aussi bien sur
  // GitHub Pages (https://pseudo.github.io/mom-hub/) qu'en local.
  const DATA_PATH = 'data/';

  // Objet exposé globalement
  const MOMCore = {
    // Métadonnées de chargement
    _loaded: false,
    _loading: null,
    _loadedAt: null,
    _errors: [],

    // Stockage des référentiels (vide tant que load() n'a pas été appelé)
    poles: null,
    categories: null,
    clubs: null,
    postes: null,
    aptitudes: null,
    ateliers: null,
    observablesMatch: null,
    testsPhysiques: null,
    conformiteFFR: null,

    /**
     * Charge tous les référentiels en parallèle.
     * Retourne une promesse qui se résout quand tout est chargé.
     * Si déjà chargé, retourne immédiatement.
     */
    async load () {
      if (this._loaded) return this;
      if (this._loading) return this._loading;

      this._loading = this._doLoad();
      return this._loading;
    },

    async _doLoad () {
      const startTime = Date.now();

      const promises = REFERENTIELS.map(async (name) => {
        try {
          const response = await fetch(`${DATA_PATH}${name}.json`);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} pour ${name}.json`);
          }
          const data = await response.json();
          return { name, data, ok: true };
        } catch (err) {
          this._errors.push({ name, error: err.message });
          return { name, data: null, ok: false, error: err };
        }
      });

      const results = await Promise.all(promises);

      // Mapper les résultats vers les propriétés de MOMCore
      // (en convertissant les noms à kebab-case → camelCase si nécessaire)
      const propertyMap = {
        'poles': 'poles',
        'categories': 'categories',
        'clubs': 'clubs',
        'postes': 'postes',
        'aptitudes': 'aptitudes',
        'ateliers': 'ateliers',
        'observables-match': 'observablesMatch',
        'tests-physiques': 'testsPhysiques',
        'conformite-ffr': 'conformiteFFR'
      };

      for (const result of results) {
        const propName = propertyMap[result.name];
        this[propName] = result.data;
      }

      this._loaded = true;
      this._loadedAt = new Date();
      const duration = Date.now() - startTime;

      const okCount = results.filter(r => r.ok).length;
      const failCount = results.length - okCount;

      console.log(
        `✓ MOM Core chargé en ${duration}ms : ` +
        `${okCount}/${results.length} référentiels OK` +
        (failCount > 0 ? `, ${failCount} en erreur` : '')
      );

      if (this._errors.length > 0) {
        console.warn('Erreurs de chargement :', this._errors);
      }

      return this;
    },

    /**
     * Recherche une catégorie par son code FFR ou son UUID.
     * Exemple : findCategorie('M14') ou findCategorie('cat-m14')
     */
    findCategorie (codeOrUuid) {
      if (!this.categories || !this.categories.categories) return null;
      return this.categories.categories.find(
        c => c.code_ffr === codeOrUuid || c.uuid === codeOrUuid
      ) || null;
    },

    /**
     * Recherche un pôle par son code ou son UUID.
     * Exemple : findPole('EDR') ou findPole('pole-edr')
     */
    findPole (codeOrUuid) {
      if (!this.poles || !this.poles.poles) return null;
      return this.poles.poles.find(
        p => p.code === codeOrUuid || p.uuid === codeOrUuid
      ) || null;
    },

    /**
     * Recherche un club par son code ou son UUID.
     * Exemple : findClub('MOM') ou findClub('club-mom')
     */
    findClub (codeOrUuid) {
      if (!this.clubs || !this.clubs.clubs) return null;
      return this.clubs.clubs.find(
        c => c.code === codeOrUuid || c.uuid === codeOrUuid
      ) || null;
    },

    /**
     * Recherche un poste par son code ou son UUID.
     * Exemple : findPoste('PG') ou findPoste('pst-001')
     */
    findPoste (codeOrUuid) {
      if (!this.postes || !this.postes.postes_precis) return null;
      return this.postes.postes_precis.find(
        p => p.code === codeOrUuid || p.uuid === codeOrUuid
      ) || null;
    },

    /**
     * Retourne un résumé des données chargées (utile pour le débug).
     */
    summary () {
      if (!this._loaded) return 'Pas encore chargé. Appeler MOMCore.load() d\'abord.';
      return {
        loadedAt: this._loadedAt,
        poles: this.poles?.poles?.length || 0,
        categories: this.categories?.categories?.length || 0,
        clubs: this.clubs?.clubs?.length || 0,
        postes: this.postes?.postes_precis?.length || 0,
        aptitudesA: this.aptitudes?.categorie_A?.length || 0,
        regles_ffr: this.conformiteFFR?.regles?.length || 0,
        tests: this.testsPhysiques?.tests?.length || 0,
        errors: this._errors.length
      };
    }
  };

  global.MOMCore = MOMCore;

})(typeof window !== 'undefined' ? window : globalThis);
