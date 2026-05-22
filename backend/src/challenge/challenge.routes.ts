import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import {
  promoteIdea,
  getChallengeById,
  listChallengesForIdea,
  searchChallenges,
  setChallengeFeatured,
  type ChallengeType,
} from './challenge.service'

export const challengeRoutes = fp(async function challengePlugin(
  fastify: FastifyInstance,
): Promise<void> {
  // POST /ideas/:id/challenges — promote an Idea to an open Innovation Day
  fastify.post<{
    Params: { id: string }
    Body: { innovation_day_id: number; challenge_type: ChallengeType; framing?: string }
  }>('/ideas/:id/challenges', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
      },
      body: {
        type: 'object',
        required: ['innovation_day_id', 'challenge_type'],
        properties: {
          innovation_day_id: { type: 'integer', minimum: 1 },
          challenge_type: {
            type: 'string',
            enum: [
              'implementation_of_improvements',
              'experimentation_and_exploration',
              'problem_solving_and_brainstorming',
            ],
          },
          framing: { type: 'string', maxLength: 2000 },
        },
      },
    },
    handler: async (req, reply) => {
      const ideaId = parseInt(req.params.id, 10)
      const { sub: promotedBy } = req.employee
      try {
        const challenge = await promoteIdea({
          idea_id: ideaId,
          innovation_day_id: req.body.innovation_day_id,
          challenge_type: req.body.challenge_type,
          framing: req.body.framing?.trim() || null,
          promoted_by: promotedBy,
        })
        reply.code(201).send({ challenge })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Promotion failed'
        if (message === 'Idea not found') return reply.code(404).send({ error: message })
        if (message === 'Innovation Day not found') return reply.code(404).send({ error: message })
        if (message === 'Cannot promote an archived Idea')
          return reply.code(409).send({ error: message })
        if (message === 'Innovation Day is not Open')
          return reply.code(409).send({ error: message })
        if (message === 'This Idea is already a Challenge on this Innovation Day')
          return reply.code(409).send({ error: message })
        throw err
      }
    },
  })

  // GET /ideas/:id/challenges — Challenge history for an Idea
  fastify.get<{ Params: { id: string } }>('/ideas/:id/challenges', {
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
      const challenges = await listChallengesForIdea(ideaId)
      reply.send({ challenges })
    },
  })

  // GET /challenges/:id — Challenge detail
  fastify.get<{ Params: { id: string } }>('/challenges/:id', {
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
      const challenge = await getChallengeById(id)
      if (!challenge) return reply.code(404).send({ error: 'Challenge not found' })
      reply.send({ challenge })
    },
  })

  // GET /challenges?q=... — search Challenges by Idea title (for report reference picker)
  fastify.get<{ Querystring: { q?: string } }>('/challenges', {
    onRequest: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: { q: { type: 'string', maxLength: 200 } },
      },
    },
    handler: async (req, reply) => {
      const query = req.query.q?.trim() ?? ''
      const challenges = await searchChallenges(query)
      reply.send({ challenges })
    },
  })

  // PATCH /admin/challenges/:id/featured — mark or unmark a Challenge as Featured (admin only)
  fastify.patch<{
    Params: { id: string }
    Body: { featured: boolean }
  }>('/admin/challenges/:id/featured', {
    onRequest: [fastify.requireAdmin],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
      },
      body: {
        type: 'object',
        required: ['featured'],
        properties: { featured: { type: 'boolean' } },
      },
    },
    handler: async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      try {
        const challenge = await setChallengeFeatured(id, req.body.featured)
        reply.send({ challenge })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Update failed'
        if (message === 'Challenge not found') return reply.code(404).send({ error: message })
        if (message.includes('Can only feature'))
          return reply.code(409).send({ error: message })
        throw err
      }
    },
  })
})
