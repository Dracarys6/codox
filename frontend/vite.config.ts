import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        proxy: {
            '/api': {
                // 在本机直接跑前端时，host.docker.internal 也会解析到宿主机；
                // 在 Docker 容器内跑 Vite 时，host.docker.internal 指向宿主机，方便访问本地 cpp-service:8080。
                target: 'http://host.docker.internal:8080',
                changeOrigin: true,
            },
        },
    },
})

