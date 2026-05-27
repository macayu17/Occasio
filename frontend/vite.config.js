/* eslint-env node */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const manualChunks = (id) => {
  const normalizedId = id.replace(/\\/g, '/')

  if (!normalizedId.includes('/node_modules/')) return undefined
  if (normalizedId.includes('/node_modules/pdfjs-dist/') || normalizedId.includes('/node_modules/react-pdf/')) return 'pdf-viewer'
  if (normalizedId.includes('/node_modules/html5-qrcode/') || normalizedId.includes('/node_modules/jsqr/')) return 'scanner'
  if (normalizedId.includes('/node_modules/react/') || normalizedId.includes('/node_modules/react-dom/') || normalizedId.includes('/node_modules/react-router-dom/')) return 'react-core'
  if (normalizedId.includes('/node_modules/lucide-react/')) return 'icons'
  if (normalizedId.includes('/node_modules/react-hook-form/')) return 'forms'
  if (normalizedId.includes('/node_modules/axios/')) return 'http'

  return 'vendor'
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const enablePwa = env.VITE_ENABLE_PWA === 'true'

  return {
    plugins: [
      react(),
      enablePwa && VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
          globIgnores: ['**/*.map', '**/pdf.worker*.mjs']
        },
        manifest: {
          name: 'Occasio Events',
          short_name: 'Occasio',
          description: 'Premium Event Management',
          theme_color: '#09090b',
          background_color: '#09090b',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ].filter(Boolean),
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        }
      },
      host: true, // Allow network access
      allowedHosts: [
        'jessica-unpeaceable-nondenominationally.ngrok-free.dev'
      ]
    },
    build: {
      cssCodeSplit: true,
      modulePreload: {
        polyfill: false
      },
      rollupOptions: {
        output: {
          manualChunks
        }
      }
    }
  }
})
