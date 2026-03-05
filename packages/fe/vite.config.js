import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/auth/google': 'http://localhost:3001',
            '/auth/exchange': 'http://localhost:3001',
            '/auth/refresh': 'http://localhost:3001',
            '/auth/logout': 'http://localhost:3001',
            '/auth/me': 'http://localhost:3001',
            '/api': 'http://localhost:3001',
        },
    },
})
