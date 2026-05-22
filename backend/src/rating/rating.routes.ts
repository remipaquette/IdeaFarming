import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import {
  getRatingAggregate,
  getMyRating,
  toggleBusinessImpact,
  toggleEffortRequired,
} from './rating.service'

export const ratingRoutes = fp(async function ratingPlugin(
  fastify: FastifyInstance,
): Promise<void> {
  // GET /ideas/:id/ratings — aggregate stats + current employee's ratings
  fastify.get<{ Params: { id: string } }>('/ideas/:id/ratings', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
      },
    },
    handler: async (req, reply) => {
      const ideaId = parseInt(req.params.id, 10)
      const { sub: employeeId } = req.employee

      const [aggregate, myRating] = await Promise.all([
        getRatingAggregate(ideaId),
        getMyRating(ideaId, employeeId),
      ])
      reply.send({ ...aggregate, my_rating: myRating })
    },
  })

  // POST /ideas/:id/ratings/impact — toggle Business Impact rating (1–5)
  fastify.post<{ Params: { id: string }; Body: { value: number } }>(
    '/ideas/:id/ratings/impact',
    {
      onRequest: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
        },
        body: {
          type: 'object',
          required: ['value'],
          properties: { value: { type: 'integer', minimum: 1, maximum: 5 } },
        },
      },
      handler: async (req, reply) => {
        const ideaId = parseInt(req.params.id, 10)
        const { sub: employeeId } = req.employee
        const { value } = req.body

        const myRating = await toggleBusinessImpact(ideaId, employeeId, value)
        const aggregate = await getRatingAggregate(ideaId)
        reply.send({ ...aggregate, my_rating: myRating })
      },
    },
  )

  // POST /ideas/:id/ratings/effort — toggle Effort Required rating (low/medium/high)
  fastify.post<{ Params: { id: string }; Body: { value: string } }>(
    '/ideas/:id/ratings/effort',
    {
      onRequest: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
        },
        body: {
          type: 'object',
          required: ['value'],
          properties: { value: { type: 'string', enum: ['low', 'medium', 'high'] } },
        },
      },
      handler: async (req, reply) => {
        const ideaId = parseInt(req.params.id, 10)
        const { sub: employeeId } = req.employee
        const { value } = req.body as { value: 'low' | 'medium' | 'high' }

        const myRating = await toggleEffortRequired(ideaId, employeeId, value)
        const aggregate = await getRatingAggregate(ideaId)
        reply.send({ ...aggregate, my_rating: myRating })
      },
    },
  )
})
