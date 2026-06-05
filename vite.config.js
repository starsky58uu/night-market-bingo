import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// GitHub Pages 部署時 base 要設成 /<repo-name>/
// 若 repo 名不同，改下面這行即可。
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/night-market-bingo/' : '/',
}))
