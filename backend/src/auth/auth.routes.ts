import fp from 'fastify-plugin'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import {
  provisionEmployee,
  deactivateEmployee,
  verifyCredentials,
  createPasswordResetToken,
  resetPasswordWithToken,
  listEmployees,
  AuthPayload,
} from './auth.service'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
  interface FastifyRequest {
    employee: AuthPayload
  }
}

export const authRoutes = fp(async function authPlugin(fastify: FastifyInstance): Promise<void> {
  // Decorate with auth hooks
  fastify.decorate(
    'authenticate',
    async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const payload = await req.jwtVerify<AuthPayload>()
        req.employee = payload
      } catch {
        reply.code(401).send({ error: 'Unauthorized' })
      }
    },
  )

  fastify.decorate(
    'requireAdmin',
    async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const payload = await req.jwtVerify<AuthPayload>()
        req.employee = payload
        if (payload.role !== 'admin') {
          reply.code(403).send({ error: 'Forbidden' })
        }
      } catch {
        reply.code(401).send({ error: 'Unauthorized' })
      }
    },
  )

  // POST /auth/login
  fastify.post<{
    Body: { email: string; password: string }
  }>('/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
      },
    },
    handler: async (req, reply) => {
      const { email, password } = req.body
      try {
        const employee = await verifyCredentials(email, password)
        const token = fastify.jwt.sign(
          { sub: employee.id, email: employee.email, role: employee.role } satisfies AuthPayload,
          { expiresIn: '7d' },
        )
        reply
          .setCookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60, // 7 days
          })
          .send({
            employee: {
              id: employee.id,
              email: employee.email,
              role: employee.role,
            },
          })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Login failed'
        if (message === 'Account deactivated') {
          return reply.code(403).send({ error: 'Account deactivated' })
        }
        return reply.code(401).send({ error: 'Invalid credentials' })
      }
    },
  })

  // POST /auth/logout
  fastify.post('/auth/logout', {
    handler: async (_req, reply) => {
      reply
        .clearCookie('auth_token', { path: '/' })
        .send({ success: true })
    },
  })

  // GET /auth/me — returns current session info
  fastify.get('/auth/me', {
    onRequest: [fastify.authenticate],
    handler: async (req, reply) => {
      reply.send({ employee: req.employee })
    },
  })

  // POST /auth/password-reset/request
  fastify.post<{
    Body: { email: string }
  }>('/auth/password-reset/request', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
        },
      },
    },
    handler: async (req, reply) => {
      const { email } = req.body
      const rawToken = await createPasswordResetToken(email)
      // In production, send the token via email; in dev, surface it in the response
      const response: Record<string, unknown> = {
        message: 'If this email is registered, a reset link has been generated.',
      }
      if (process.env.NODE_ENV !== 'production' && rawToken !== null) {
        response.reset_token = rawToken
      }
      reply.send(response)
    },
  })

  // POST /auth/password-reset/confirm
  fastify.post<{
    Body: { token: string; new_password: string }
  }>('/auth/password-reset/confirm', {
    schema: {
      body: {
        type: 'object',
        required: ['token', 'new_password'],
        properties: {
          token: { type: 'string', minLength: 1 },
          new_password: { type: 'string', minLength: 8 },
        },
      },
    },
    handler: async (req, reply) => {
      const { token, new_password } = req.body
      try {
        await resetPasswordWithToken(token, new_password)
        reply.send({ message: 'Password has been reset successfully.' })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Token error'
        reply.code(400).send({ error: message })
      }
    },
  })

  // --- Admin routes ---

  // POST /admin/employees — provision an Employee account
  fastify.post<{
    Body: { email: string; password: string; role?: 'admin' | 'employee' }
  }>('/admin/employees', {
    onRequest: [fastify.requireAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          role: { type: 'string', enum: ['admin', 'employee'] },
        },
      },
    },
    handler: async (req, reply) => {
      const { email, password, role } = req.body
      try {
        const employee = await provisionEmployee(email, password, role)
        reply.code(201).send({ employee })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not create employee'
        if (message.includes('unique') || message.includes('duplicate')) {
          return reply.code(409).send({ error: 'Email already registered' })
        }
        throw err
      }
    },
  })

  // PATCH /admin/employees/:id/deactivate — deactivate an Employee
  fastify.patch<{ Params: { id: string } }>(
    '/admin/employees/:id/deactivate',
    {
      onRequest: [fastify.requireAdmin],
      handler: async (req, reply) => {
        const id = parseInt(req.params.id, 10)
        if (isNaN(id)) return reply.code(400).send({ error: 'Invalid employee ID' })
        try {
          await deactivateEmployee(id)
          reply.send({ success: true })
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Error'
          if (message === 'Employee not found') {
            return reply.code(404).send({ error: 'Employee not found' })
          }
          throw err
        }
      },
    },
  )

  // GET /admin/employees — list all employees
  fastify.get('/admin/employees', {
    onRequest: [fastify.requireAdmin],
    handler: async (_req, reply) => {
      const employees = await listEmployees()
      reply.send({ employees })
    },
  })
})
