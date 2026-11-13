import { defineConfig } from 'vite'
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const IGNORE = new Set(['node_modules', 'dist', 'public'])

/**
 * リポ直下で index.html を持つディレクトリを、ゲームとしてビルドの入口に集める
 */
const gameInputs = () =>
  Object.fromEntries(
    readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !IGNORE.has(d.name))
      .filter((d) => existsSync(`${root}${d.name}/index.html`))
      .map((d) => [d.name, `${root}${d.name}/index.html`]),
  )

export default defineConfig({
  base: './',
  server: { port: 5180, strictPort: true },
  build: {
    rolldownOptions: {
      input: { main: `${root}index.html`, ...gameInputs() },
    },
  },
})
