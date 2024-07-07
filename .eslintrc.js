module.exports = {
    env: {
        browser: true,
        es2021: true,
    },
    extends: [
        'plugin:react/recommended',
        'plugin:@typescript-eslint/recommended', // TypeScript için önerilen kurallar
        'airbnb',
        'airbnb/hooks',
        'prettier', // Prettier ile çakışmayı önlemek için
        'prettier/react', // Prettier ile React için çakışmayı önlemek için
        'prettier/@typescript-eslint', // Prettier ile TypeScript için çakışmayı önlemek için
    ],
    parser: '@typescript-eslint/parser', // TypeScript dosyalarını analiz etmek için parser
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
        ecmaVersion: 12,
        sourceType: 'module',
    },
    plugins: [
        'react',
        '@typescript-eslint', // TypeScript için ESLint plugin'i
    ],
    rules: {
        // Proje için özel kurallar veya değişiklikler buraya eklenebilir
        'react/jsx-filename-extension': [1, { extensions: ['.jsx', '.tsx'] }], // JSX ve TSX dosyalarına izin ver
        '@typescript-eslint/explicit-module-boundary-types': 'off', // Fonksiyonlarda TypeScript'in tür çıkarımını zorunlu tutma
    },
    settings: {
        react: {
            version: 'detect', // React sürümünü otomatik olarak algıla
        },
    },
};
