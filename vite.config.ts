import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 주소: https://everyone-chat.github.io (루트에서 서비스)
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
})
