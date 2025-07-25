import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/creation-store-analysis/' : '/',
  server: {
    port: 3666,
    host: true,
    strictPort: false,
  },
})