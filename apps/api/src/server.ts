import Fastify from 'fastify';
const PORT = Number(process.env.API_PORT) || 3001;
async function main(): Promise<void> {
  const app = Fastify({ logger: true });
  app.get('/health', async () => ({ status: 'ok', service: 'trellis-api' }));
  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`Trellis API running on port ${PORT}`);
}
main().catch((err) => { console.error('Failed to start server:', err); process.exit(1); });
