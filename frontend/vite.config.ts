import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
      'react-router-dom': 'react-router',
    },
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router') || id.match(/node_modules\/react\//) || id.includes('react-dom')) return 'vendor-react'
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-')) return 'vendor-charts'
            if (id.includes('@xyflow')) return 'vendor-xyflow'
            if (id.includes('@radix-ui')) return 'vendor-radix'
          }
        },
      },
    },
  },
})
