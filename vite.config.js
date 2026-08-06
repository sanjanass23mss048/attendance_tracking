import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function calendarificProxyPlugin(apiKey) {
  return {
    name: 'calendarific-proxy',
    configureServer(server) {
      server.middlewares.use('/api/calendarific-holidays', async (req, res) => {
        try {
          if (!apiKey) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Missing VITE_CALENDARIFIC_API_KEY in .env.local' }))
            return
          }

          const url = new URL(req.url || '', 'http://localhost')
          const year = url.searchParams.get('year') || String(new Date().getFullYear())
          const country = (url.searchParams.get('country') || 'IN').toUpperCase()

          const target = new URL('https://calendarific.com/api/v2/holidays')
          target.searchParams.set('api_key', apiKey)
          target.searchParams.set('country', country)
          target.searchParams.set('year', year)
          const location = url.searchParams.get('location')
          if (location) {
            target.searchParams.set('location', location)
          }

          const response = await fetch(target)
          const text = await response.text()
          res.statusCode = response.status
          res.setHeader('Content-Type', 'application/json')
          res.end(text)
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: error.message || 'Calendarific proxy failed' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = (env.VITE_CALENDARIFIC_API_KEY || env.CALENDARIFIC_API_KEY || '').trim()
  const apiTarget = (env.VITE_DEV_API_PROXY || 'http://localhost:4000').replace(/\/$/, '')

  return {
    plugins: [react(), tailwindcss(), calendarificProxyPlugin(apiKey)],
    server: {
      proxy: {
        // Same-origin `/api` + Socket.IO in dev when VITE_API_URL is empty
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/socket.io': {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
        },
        '/health': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
