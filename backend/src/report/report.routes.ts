import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import {
  getReportByChallengeId,
  updateReport,
  addIdeaRef,
  removeIdeaRef,
  addChallengeRef,
  removeChallengeRef,
  shareUpdate,
  isTeamMember,
} from './report.service'

const challengeIdSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
}

export const reportRoutes = fp(async function reportPlugin(
  fastify: FastifyInstance,
): Promise<void> {
  // GET /challenges/:id/report — get Report (any authenticated user)
  fastify.get<{ Params: { id: string } }>('/challenges/:id/report', {
    onRequest: [fastify.authenticate],
    schema: { params: challengeIdSchema },
    handler: async (req, reply) => {
      const challengeId = parseInt(req.params.id, 10)
      const report = await getReportByChallengeId(challengeId)
      if (!report) return reply.code(404).send({ error: 'Report not found' })
      reply.send({ report })
    },
  })

  // PUT /challenges/:id/report — update Report fields (Team members only)
  fastify.put<{
    Params: { id: string }
    Body: {
      problem_description: string
      expected_benefits: string
      main_tasks: string
      results: string
      next_steps: string
    }
  }>('/challenges/:id/report', {
    onRequest: [fastify.authenticate],
    schema: {
      params: challengeIdSchema,
      body: {
        type: 'object',
        required: [
          'problem_description',
          'expected_benefits',
          'main_tasks',
          'results',
          'next_steps',
        ],
        properties: {
          problem_description: { type: 'string', maxLength: 10000 },
          expected_benefits: { type: 'string', maxLength: 10000 },
          main_tasks: { type: 'string', maxLength: 10000 },
          results: { type: 'string', maxLength: 10000 },
          next_steps: { type: 'string', maxLength: 10000 },
        },
      },
    },
    handler: async (req, reply) => {
      const challengeId = parseInt(req.params.id, 10)
      const employeeId = req.employee.sub

      const member = await isTeamMember(challengeId, employeeId)
      if (!member) {
        return reply.code(403).send({ error: 'You are not a member of this Team' })
      }

      const report = await updateReport(challengeId, req.body)
      if (!report) return reply.code(404).send({ error: 'Report not found' })
      reply.send({ report })
    },
  })

  // POST /challenges/:id/report/share — share update (Team members only)
  fastify.post<{ Params: { id: string } }>('/challenges/:id/report/share', {
    onRequest: [fastify.authenticate],
    schema: { params: challengeIdSchema },
    handler: async (req, reply) => {
      const challengeId = parseInt(req.params.id, 10)
      const employeeId = req.employee.sub

      const member = await isTeamMember(challengeId, employeeId)
      if (!member) {
        return reply.code(403).send({ error: 'You are not a member of this Team' })
      }

      try {
        await shareUpdate(challengeId, employeeId)
        reply.code(204).send()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Share failed'
        if (message === 'Report not found') return reply.code(404).send({ error: message })
        throw err
      }
    },
  })

  // POST /challenges/:id/report/idea-refs — add an Idea reference (Team members only)
  fastify.post<{
    Params: { id: string }
    Body: { idea_id: number }
  }>('/challenges/:id/report/idea-refs', {
    onRequest: [fastify.authenticate],
    schema: {
      params: challengeIdSchema,
      body: {
        type: 'object',
        required: ['idea_id'],
        properties: { idea_id: { type: 'integer', minimum: 1 } },
      },
    },
    handler: async (req, reply) => {
      const challengeId = parseInt(req.params.id, 10)
      const employeeId = req.employee.sub

      const member = await isTeamMember(challengeId, employeeId)
      if (!member) {
        return reply.code(403).send({ error: 'You are not a member of this Team' })
      }

      try {
        await addIdeaRef(challengeId, req.body.idea_id)
        const report = await getReportByChallengeId(challengeId)
        reply.code(201).send({ report })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to add reference'
        if (message === 'Idea not found') return reply.code(404).send({ error: message })
        if (message === 'Report not found') return reply.code(404).send({ error: message })
        throw err
      }
    },
  })

  // DELETE /challenges/:id/report/idea-refs/:ideaId — remove an Idea reference (Team members only)
  fastify.delete<{ Params: { id: string; ideaId: string } }>(
    '/challenges/:id/report/idea-refs/:ideaId',
    {
      onRequest: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['id', 'ideaId'],
          properties: {
            id: { type: 'string', pattern: '^[0-9]+$' },
            ideaId: { type: 'string', pattern: '^[0-9]+$' },
          },
        },
      },
      handler: async (req, reply) => {
        const challengeId = parseInt(req.params.id, 10)
        const ideaId = parseInt(req.params.ideaId, 10)
        const employeeId = req.employee.sub

        const member = await isTeamMember(challengeId, employeeId)
        if (!member) {
          return reply.code(403).send({ error: 'You are not a member of this Team' })
        }

        try {
          await removeIdeaRef(challengeId, ideaId)
          reply.code(204).send()
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to remove reference'
          if (message === 'Report not found') return reply.code(404).send({ error: message })
          throw err
        }
      },
    },
  )

  // POST /challenges/:id/report/challenge-refs — add a Challenge reference (Team members only)
  fastify.post<{
    Params: { id: string }
    Body: { challenge_id: number }
  }>('/challenges/:id/report/challenge-refs', {
    onRequest: [fastify.authenticate],
    schema: {
      params: challengeIdSchema,
      body: {
        type: 'object',
        required: ['challenge_id'],
        properties: { challenge_id: { type: 'integer', minimum: 1 } },
      },
    },
    handler: async (req, reply) => {
      const challengeId = parseInt(req.params.id, 10)
      const employeeId = req.employee.sub

      const member = await isTeamMember(challengeId, employeeId)
      if (!member) {
        return reply.code(403).send({ error: 'You are not a member of this Team' })
      }

      try {
        await addChallengeRef(challengeId, req.body.challenge_id)
        const report = await getReportByChallengeId(challengeId)
        reply.code(201).send({ report })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to add reference'
        if (message === 'Challenge not found') return reply.code(404).send({ error: message })
        if (message === 'Report not found') return reply.code(404).send({ error: message })
        throw err
      }
    },
  })

  // DELETE /challenges/:id/report/challenge-refs/:challengeRefId — remove a Challenge reference (Team members only)
  fastify.delete<{ Params: { id: string; challengeRefId: string } }>(
    '/challenges/:id/report/challenge-refs/:challengeRefId',
    {
      onRequest: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['id', 'challengeRefId'],
          properties: {
            id: { type: 'string', pattern: '^[0-9]+$' },
            challengeRefId: { type: 'string', pattern: '^[0-9]+$' },
          },
        },
      },
      handler: async (req, reply) => {
        const challengeId = parseInt(req.params.id, 10)
        const refChallengeId = parseInt(req.params.challengeRefId, 10)
        const employeeId = req.employee.sub

        const member = await isTeamMember(challengeId, employeeId)
        if (!member) {
          return reply.code(403).send({ error: 'You are not a member of this Team' })
        }

        try {
          await removeChallengeRef(challengeId, refChallengeId)
          reply.code(204).send()
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to remove reference'
          if (message === 'Report not found') return reply.code(404).send({ error: message })
          throw err
        }
      },
    },
  )
})
