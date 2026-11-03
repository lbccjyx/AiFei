import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // Root deployment (custom domain / <user>.github.io) uses '/'. Set
    // VITE_BASE=/repo-name/ only for a project page served from a sub-path.
    base: env.VITE_BASE || '/',
    server: {
      watch: {
        // Editors on Windows may save atomically through a temporary
        // `.<name>.<pid>.<uuid>.tmpdir` folder; watching it can throw EBUSY
        // on some drives and kill the dev server. Never watch those.
        ignored: ['**/node_modules/**', '**/.git/**', '**/.*.tmpdir', '**/.*.tmpdir/**'],
      },
    },
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
  }
})
