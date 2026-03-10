import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MySignInApp',
        short_name: 'MySignInApp',
        description: 'Dynamic QR Code Attendance System for USIU-A',
        theme_color: '#1a237e',
        background_color: '#f0f4f8',
        display: 'standalone',
        icons: [
          { src: '/vite.svg', sizes: '192x192', type: 'image/svg+xml' }
        ]
      }
    })
  ],
})

