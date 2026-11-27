import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
const path = relative => fileURLToPath(new URL(relative, import.meta.url))
export default defineConfig({
  root: path('./'), plugins: [react()],
  resolve: { alias: [
    { find: '@', replacement: path('../../../../mobile/src') },
    { find: /^react-native$/, replacement: path('../../../../mobile/node_modules/react-native-web/dist/index.js') },
    { find: /^react-native-safe-area-context$/, replacement: path('../../../../mobile/node_modules/react-native-safe-area-context/src/index.tsx') },
    { find: /^react$/, replacement: path('../../../node_modules/react/index.js') },
    { find: /^react-dom\/client$/, replacement: path('../../../node_modules/react-dom/client.js') },
    { find: /^expo-router$/, replacement: path('./router.mjs') },
    { find: /^expo-crypto$/, replacement: path('./crypto.mjs') },
  ], extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.jsx', '.json'], dedupe: ['react', 'react-dom', '@tanstack/react-query'] },
  server: { host: '127.0.0.1', port: 3194, strictPort: true, fs: { allow: [path('../../../../')] } },
})
