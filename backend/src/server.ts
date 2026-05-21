import Fastify from 'fastify'
import { pool, migrate } from './db'

const fastify = Fastify({ logger: true })
const PORT = Number(process.env.PORT) || 3000

fastify.get('/health', async () => {
  const result = await pool.query('SELECT version()')
  return { status: 'ok', database: result.rows[0].version as string }
})

const start = async () => {
  try {
    await migrate()
    await fastify.listen({ port: PORT, host: '0.0.0.0' })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
