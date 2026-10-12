import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'functions/lib'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: [
      'src/app/AppContext.tsx',
      'src/features/referee/reports/CrewAttendanceFields.tsx',
      'src/features/referee/reports/TeamScoreFields.tsx',
      'src/features/scheduler/SchedulerCompetitionFilter.tsx',
      'src/features/scheduler/officialQuickLookContext.tsx',
      'src/features/teamAdmin/TeamAdminMatchRow.tsx',
    ],
    rules: {
      // These modules intentionally colocate components with tightly coupled
      // hooks/constants that form one public API. Splitting them would add
      // indirection without improving runtime refresh behavior.
      'react-refresh/only-export-components': 'off',
    },
  },
);
