/// <reference types="vitest/config" />
import { resolve } from 'node:path'
import preact from '@preact/preset-vite'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { buildDataFiles, loadQuestionBank } from './scripts/question-bank.mjs'

const QUESTIONS_DIR = resolve(import.meta.dirname, 'questions')

/**
 * Transforme questions/** en fichiers statiques data/*.json :
 * émis comme assets au build, servis depuis la mémoire en dev (rechargés à chaque modification).
 */
function questionBank(): Plugin {
  let files = new Map<string, string>()
  let isBuild = false

  const generate = () => {
    const { themes, errors, warnings } = loadQuestionBank(QUESTIONS_DIR)
    for (const w of warnings) console.warn(`⚠️  ${w}`)
    if (errors.length) {
      const message = `Banque de questions invalide :\n${errors.map((e) => `  ❌ ${e}`).join('\n')}`
      if (isBuild) throw new Error(message)
      console.error(message)
      return
    }
    files = buildDataFiles(themes)
  }

  return {
    name: 'tictacbrain:questions',
    configResolved(config) {
      isBuild = config.command === 'build'
    },
    buildStart() {
      generate()
    },
    generateBundle() {
      for (const [fileName, source] of files) {
        this.emitFile({ type: 'asset', fileName, source })
      }
    },
    configureServer(server) {
      server.watcher.add(QUESTIONS_DIR)
      server.watcher.on('all', (_event, path) => {
        if (!path.startsWith(QUESTIONS_DIR)) return
        generate()
        server.ws.send({ type: 'full-reload' })
      })
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0].replace(/^\/+/, '')
        const body = files.get(path)
        if (body === undefined) return next()
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(body)
      })
    },
  }
}

export default defineConfig({
  // Chemins relatifs : l'app fonctionne à la racine d'un domaine comme sur
  // https://<user>.github.io/<repo>/ sans configuration (routage par hash).
  base: './',
  plugins: [
    preact(),
    // Inutile (et bavard) pendant les tests unitaires.
    !process.env.VITEST && questionBank(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'TicTacBrain — Quiz en mode série',
        short_name: 'TicTacBrain',
        description: 'Quiz QCM par thèmes en mode série : va le plus loin possible sans te tromper.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0b1020',
        background_color: '#0b1020',
        categories: ['education', 'games'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Toutes les questions sont précachées : l'app fonctionne hors ligne.
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
