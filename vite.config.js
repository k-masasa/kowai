import { defineConfig } from 'vite'
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))

/**
 * games/ の下で index.html を持つディレクトリを、ビルドの入口として集める
 */
const gameInputs = () =>
  Object.fromEntries(
    readdirSync(`${root}games`)
      .filter((name) => existsSync(`${root}games/${name}/index.html`))
      .map((name) => [name, `${root}games/${name}/index.html`]),
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
