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
        id: './',
        name: 'TicTacBrain — Le quiz qui fait boum',
        short_name: 'TicTacBrain',
        description: 'Le quiz qui te bourre le crâne : enchaîne les bonnes réponses avant que ça fasse BOUM.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#f5f6fa',
        background_color: '#f5f6fa',
        categories: ['education', 'games'],
        screenshots: [
          { src: 'screenshots/accueil.png', sizes: '1082x2202', type: 'image/png', form_factor: 'narrow', label: 'Accueil : thèmes et statistiques' },
          { src: 'screenshots/question.png', sizes: '1082x2202', type: 'image/png', form_factor: 'narrow', label: 'Une question en mode série' },
        ],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Toutes les questions sont précachées : l'app fonctionne hors ligne.
        // Police : seuls les sous-ensembles latins (français) sont mis en cache.
        globPatterns: ['**/*.{js,css,html,svg,png,json}', 'assets/plus-jakarta-sans-latin-*.woff2'],
        // Les captures ne servent qu'à la boîte d'installation : inutile de les mettre en cache.
        globIgnores: ['screenshots/**'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
