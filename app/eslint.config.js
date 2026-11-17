import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const DOM_GLOBALS = ['window', 'document', 'localStorage'];

export default tseslint.config(
  { ignores: ['dist/', 'dist-capture/', 'dist-local/', 'dist-narrative/', 'dist-characters/', 'dist-e2e/', 'dist-e2e-capture/','test-results-characters/', 'test-results-narrative/', 'test-results-local-feedback/', 'node_modules/', 'test-results/', 'playwright-report/', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Pureté : le moteur et le partagé ne touchent ni DOM, ni horloge, ni hasard non injecté.
    files: [
      'src/engine/**/*.ts', 'src/shared/**/*.ts', 'src/questionnaire/**/*.ts', 'src/fastforward/**/*.ts', 'src/survival/**/*.ts', 'src/bilan/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [{
            group: ['**/data/load', '../data/load', '../../data/load', '**/*.json'],
            message: "Le moteur n'importe jamais data/load ni un JSON : CoreData vient de data/schema/core [R-01.1]",
          }, {
            group: ['three', 'three/**', '**/street/**'],
            message: 'Aucun import de three ni de src/street depuis src/bilan [plan 03, R-03.4, R-03.24].',
          }],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Hasard injecté (rng seedé), jamais Math.random.' },
        { object: 'Date', property: 'now', message: 'Horloge injectée, jamais Date.now.' },
        ...['sin', 'cos', 'exp', 'log', 'hypot', 'pow'].map((property) => ({
          object: 'Math', property, message: 'Opération interdite : division, produit et racine entière seulement [GDD 03 §4].',
        })),
        { object: 'performance', property: 'now', message: 'Horloge injectée, jamais performance.now.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Horloge injectée, jamais Date.' },
        ...DOM_GLOBALS.map((name) => ({ name, message: 'Le moteur est pur : aucun accès DOM.' })),
        ...['Float32Array', 'Int32Array'].map((name) => ({ name, message: 'Types numériques interdits [GDD 03 §4].' })),
      ],
    },
  },
  {
    // DOM sans Three.js : l'interface et les écrans n'importent jamais `three` [plan 03, R-03.11].
    files: ['src/ui/**/*.ts', 'src/screens/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [{
            group: ['three', 'three/**', '**/street/**'],
            message: 'Aucun import de three ni de src/street depuis src/ui et src/screens [plan 03, décision 1, R-03.4].',
          }],
        },
      ],
    },
  },
  { files: ['src/atlas/**/*.ts'], ignores: ['src/atlas/atelier.ts'], rules: { 'no-restricted-globals': ['error', { name: 'Date', message: 'Atlas pur : aucune horloge.' }, ...DOM_GLOBALS.map((name) => ({ name, message: 'Atlas pur : aucun accès DOM.' }))] } },
);
