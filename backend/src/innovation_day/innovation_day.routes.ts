import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import {
  createInnovationDay,
  getInnovationDayById,
  listInnovationDays,
  updateInnovationDay,
  transitionInnovationDayStatus,
  listChallengesForInnovationDay,
  type InnovationDayStatus,
} from './innovation_day.service'

export const innovationDayRoutes = fp(async function innovationDayPlugin(
  fastify: FastifyInstance,
): Promise<void> {
  // GET /innovation-days — Admin sees all statuses; Employees see Open and In Progress only
  fastify.get('/innovation-days', {
    onRequest: [fastify.authenticate],
    handler: async (req, reply) => {
      const isAdmin = req.employee.role === 'admin'
      const innovation_days = await listInnovationDays(isAdmin)
      reply.send({ innovation_days })
    },
  })

  // GET /innovation-days/:id — get Innovation Day with its Challenges
  fastify.get<{ Params: { id: string } }>('/innovation-days/:id', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
      },
    },
    handler: async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      const innovationDay = await getInnovationDayById(id)
      if (!innovationDay) return reply.code(404).send({ error: 'Innovation Day not found' })

      const isAdmin = req.employee.role === 'admin'
      if (innovationDay.status === 'draft' && !isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }

      const challenges = await listChallengesForInnovationDay(id)
      reply.send({ innovation_day: innovationDay, challenges })
    },
  })

  // POST /admin/innovation-days — create an Innovation Day in Draft state (admin only)
  fastify.post<{
    Body: { name: string; date: string; description: string; team_size_cap: number }
  }>('/admin/innovation-days', {
    onRequest: [fastify.requireAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'date', 'description', 'team_size_cap'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          date: { type: 'string', format: 'date' },
          description: { type: 'string' },
          team_size_cap: { type: 'integer', minimum: 1 },
        },
      },
    },
    handler: async (req, reply) => {
      const innovationDay = await createInnovationDay(req.body)
      reply.code(201).send({ innovation_day: innovationDay })
    },
  })

  // PUT /admin/innovation-days/:id — update name/description/team_size_cap (Draft or Open only)
  fastify.put<{
    Params: { id: string }
    Body: { name?: string; description?: string; team_size_cap?: number }
  }>('/admin/innovation-days/:id', {
    onRequest: [fastify.requireAdmin],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string' },
          team_size_cap: { type: 'integer', minimum: 1 },
        },
      },
    },
    handler: async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      try {
        const innovationDay = await updateInnovationDay(id, req.body)
        reply.send({ innovation_day: innovationDay })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Update failed'
        if (message === 'Innovation Day not found') return reply.code(404).send({ error: message })
        if (message.includes('Cannot update')) return reply.code(409).send({ error: message })
        throw err
      }
    },
  })

  // POST /admin/innovation-days/:id/transition — lifecycle transition (admin only)
  fastify.post<{
    Params: { id: string }
    Body: { status: InnovationDayStatus }
  }>('/admin/innovation-days/:id/transition', {
    onRequest: [fastify.requireAdmin],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['open', 'in_progress', 'completed'],
          },
        },
      },
    },
    handler: async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      try {
        const innovationDay = await transitionInnovationDayStatus(id, req.body.status)
        reply.send({ innovation_day: innovationDay })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Transition failed'
        if (message === 'Innovation Day not found') return reply.code(404).send({ error: message })
        if (message.includes('Cannot transition')) return reply.code(409).send({ error: message })
        throw err
      }
    },
  })
})
