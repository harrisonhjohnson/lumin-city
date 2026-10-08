import { defineConfig, loadEnv } from 'vite';

// In dev, /api/agent runs the same handler Vercel deploys, reading the key from .env.local.
const agentApi = () => ({
  name: 'agent-api',
  configureServer(server) {
    Object.assign(process.env, loadEnv('development', process.cwd(), 'OPENROUTER_'));
    server.middlewares.use('/api/agent', async (req, res) => {
      const { default: handler } = await server.ssrLoadModule('/api/agent.js');
      handler(req, res).catch((e) => { res.statusCode = 500; res.end(String(e)); });
    });
  },
});

export default defineConfig({
  server: { port: 5190, host: '127.0.0.1' },
  plugins: [agentApi()],
});
