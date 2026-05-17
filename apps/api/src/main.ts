import Fastify from 'fastify';
import cors from '@fastify/cors';

const server = Fastify({ logger: true });

await server.register(cors, {
  origin: true,
});

server.get('/health', async () => ({ ok: true, service: 'api' }));

server.get('/v1/meta', async () => ({
  name: 'Architecture Flow API',
  status: 'bootstrap',
  modules: ['work-items', 'artifacts', 'workflow', 'audit'],
}));

const port = Number(process.env.PORT ?? 4000);
await server.listen({ port, host: '0.0.0.0' });
