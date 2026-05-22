import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { getMyActivity } from './activity.service'

export const activityRoutes = fp(async function activityPlugin(
  fastify: FastifyInstance,
): Promise<void> {
  // GET /employees/:id/activity — get My Activity for the authenticated Employee (own data only)
  fastify.get<{ Params: { id: string } }>('/employees/:id/activity', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
      },
    },
    handler: async (req, reply) => {
      const requestedId = parseInt(req.params.id, 10)
      if (requestedId !== req.employee.sub) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
      const activity = await getMyActivity(requestedId)
      reply.send({ activity })
    },
  })
})
