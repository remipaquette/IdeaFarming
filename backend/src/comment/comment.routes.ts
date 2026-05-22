import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { listComments, createComment, deleteComment } from './comment.service'

export const commentRoutes = fp(async function commentPlugin(
  fastify: FastifyInstance,
): Promise<void> {
  // GET /ideas/:id/comments — list comments with nested replies
  fastify.get<{ Params: { id: string } }>('/ideas/:id/comments', {
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
      const comments = await listComments(ideaId)
      reply.send({ comments })
    },
  })

  // POST /ideas/:id/comments — post a top-level Comment
  fastify.post<{ Params: { id: string }; Body: { body: string } }>(
    '/ideas/:id/comments',
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
          required: ['body'],
          properties: { body: { type: 'string', minLength: 1 } },
        },
      },
      handler: async (req, reply) => {
        const ideaId = parseInt(req.params.id, 10)
        const { sub: employeeId } = req.employee
        const comment = await createComment(ideaId, employeeId, req.body.body)
        reply.code(201).send({ comment })
      },
    },
  )

  // POST /ideas/:id/comments/:commentId/replies — reply to a top-level Comment
  fastify.post<{
    Params: { id: string; commentId: string }
    Body: { body: string }
  }>('/ideas/:id/comments/:commentId/replies', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id', 'commentId'],
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$' },
          commentId: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
      body: {
        type: 'object',
        required: ['body'],
        properties: { body: { type: 'string', minLength: 1 } },
      },
    },
    handler: async (req, reply) => {
      const ideaId = parseInt(req.params.id, 10)
      const parentId = parseInt(req.params.commentId, 10)
      const { sub: employeeId } = req.employee
      try {
        const comment = await createComment(ideaId, employeeId, req.body.body, parentId)
        reply.code(201).send({ comment })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : ''
        if (message === 'Parent comment not found') return reply.code(404).send({ error: message })
        if (message === 'Cannot reply to a reply') return reply.code(400).send({ error: message })
        throw err
      }
    },
  })

  // DELETE /comments/:id — delete a Comment (author or admin)
  fastify.delete<{ Params: { id: string } }>('/comments/:id', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
      },
    },
    handler: async (req, reply) => {
      const commentId = parseInt(req.params.id, 10)
      const { sub: requesterId, role } = req.employee
      try {
        await deleteComment(commentId, requesterId, role)
        reply.code(204).send()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : ''
        if (message === 'Comment not found') return reply.code(404).send({ error: message })
        if (message === 'Forbidden') return reply.code(403).send({ error: message })
        throw err
      }
    },
  })
})
