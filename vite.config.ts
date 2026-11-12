import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages 주소가 /bondee-web/ 아래에 있어서 base 경로를 맞춰 둠
export default defineConfig({
  base: '/bondee-web/',
  plugins: [react(), tailwindcss()],
})
