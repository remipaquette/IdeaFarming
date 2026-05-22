import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { joinTeam, leaveTeam, listTeamMembers } from './team.service'

export const teamRoutes = fp(async function teamPlugin(fastify: FastifyInstance): Promise<void> {
  const challengeIdSchema = {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
  }

  // POST /challenges/:id/team/join — join a Challenge's Team
  fastify.post<{ Params: { id: string } }>('/challenges/:id/team/join', {
    onRequest: [fastify.authenticate],
    schema: { params: challengeIdSchema },
    handler: async (req, reply) => {
      const challengeId = parseInt(req.params.id, 10)
      const employeeId = req.employee.sub
      try {
        await joinTeam({ challenge_id: challengeId, employee_id: employeeId })
        reply.code(204).send()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Join failed'
        if (message === 'Challenge not found') return reply.code(404).send({ error: message })
        if (
          message === 'Team roster is locked — Innovation Day is In Progress or Completed' ||
          message === 'Innovation Day is not yet Open' ||
          message === 'You are already on a Team for this Innovation Day' ||
          message === 'Team is full'
        ) {
          return reply.code(409).send({ error: message })
        }
        throw err
      }
    },
  })

  // DELETE /challenges/:id/team/leave — leave a Challenge's Team
  fastify.delete<{ Params: { id: string } }>('/challenges/:id/team/leave', {
    onRequest: [fastify.authenticate],
    schema: { params: challengeIdSchema },
    handler: async (req, reply) => {
      const challengeId = parseInt(req.params.id, 10)
      const employeeId = req.employee.sub
      try {
        await leaveTeam({ challenge_id: challengeId, employee_id: employeeId })
        reply.code(204).send()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Leave failed'
        if (message === 'Challenge not found') return reply.code(404).send({ error: message })
        if (
          message === 'Team roster is locked — Innovation Day is In Progress or Completed' ||
          message === 'You are not a member of this Team'
        ) {
          return reply.code(409).send({ error: message })
        }
        throw err
      }
    },
  })

  // GET /challenges/:id/team/members — list Team members for a Challenge
  fastify.get<{ Params: { id: string } }>('/challenges/:id/team/members', {
    onRequest: [fastify.authenticate],
    schema: { params: challengeIdSchema },
    handler: async (req, reply) => {
      const challengeId = parseInt(req.params.id, 10)
      const members = await listTeamMembers(challengeId)
      reply.send({ members })
    },
  })
})
