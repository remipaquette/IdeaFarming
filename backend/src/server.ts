import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import * as fs from 'fs'
import * as path from 'path'
import { pool, migrate } from './db'
import { authRoutes } from './auth/auth.routes'
import { categoryRoutes } from './category/category.routes'
import { ideaRoutes } from './idea/idea.routes'
import { ratingRoutes } from './rating/rating.routes'
import { commentRoutes } from './comment/comment.routes'
import { innovationDayRoutes } from './innovation_day/innovation_day.routes'
import { challengeRoutes } from './challenge/challenge.routes'
import { teamRoutes } from './team/team.routes'
import { reportRoutes } from './report/report.routes'
import { notificationRoutes } from './notification/notification.routes'
import { activityRoutes } from './activity/activity.routes'
import { provisionEmployee } from './auth/auth.service'

const PORT = Number(process.env.PORT) || 3000

const start = async () => {
  const JWT_SECRET = process.env.JWT_SECRET
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required')
  }

  const fastify = Fastify({ logger: true })

  await fastify.register(fastifyCors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  })

  await fastify.register(fastifyCookie)

  await fastify.register(fastifyJwt, {
    secret: JWT_SECRET,
    cookie: {
      cookieName: 'auth_token',
      signed: false,
    },
  })

  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5 MB
      files: 1,
    },
  })

  const uploadDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')
  fs.mkdirSync(uploadDir, { recursive: true })

  await fastify.register(fastifyStatic, {
    root: uploadDir,
    prefix: '/uploads/',
    decorateReply: false,
  })

  fastify.get('/health', async () => {
    const result = await pool.query('SELECT version()')
    return { status: 'ok', database: result.rows[0].version as string }
  })

  await fastify.register(authRoutes)
  await fastify.register(categoryRoutes)
  await fastify.register(ideaRoutes)
  await fastify.register(ratingRoutes)
  await fastify.register(commentRoutes)
  await fastify.register(innovationDayRoutes)
  await fastify.register(challengeRoutes)
  await fastify.register(teamRoutes)
  await fastify.register(reportRoutes)
  await fastify.register(notificationRoutes)
  await fastify.register(activityRoutes)

  try {
    await migrate()
    await seedAdmin(fastify.log)
    await fastify.listen({ port: PORT, host: '0.0.0.0' })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

async function seedAdmin(log: { info: (msg: string) => void }): Promise<void> {
  const email = process.env.ADMIN_SEED_EMAIL
  const password = process.env.ADMIN_SEED_PASSWORD
  if (!email || !password) return
  const { rows } = await pool.query('SELECT 1 FROM employees LIMIT 1')
  if (rows.length > 0) return
  await provisionEmployee(email, password, 'admin')
  log.info(`Seeded admin account: ${email}`)
}

start()
