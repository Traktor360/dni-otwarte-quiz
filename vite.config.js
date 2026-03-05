import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  server: {
    host: true,       // pozwala na dostęp po IP
    port: 80,         // zmiana portu na 80
    strictPort: true, // nie szukaj innych portów jeśli 80 jest zajęty
  },
})