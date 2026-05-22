import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import {
  listCategories,
  createCategory,
  renameCategory,
  deleteCategory,
} from './category.service'

export const categoryRoutes = fp(async function categoryPlugin(
  fastify: FastifyInstance,
): Promise<void> {
  // GET /categories — list all categories (any authenticated employee)
  fastify.get('/categories', {
    onRequest: [fastify.authenticate],
    handler: async (_req, reply) => {
      const categories = await listCategories()
      reply.send({ categories })
    },
  })

  // POST /admin/categories — create a category (admin only)
  fastify.post<{ Body: { name: string } }>('/admin/categories', {
    onRequest: [fastify.requireAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
        },
      },
    },
    handler: async (req, reply) => {
      try {
        const category = await createCategory(req.body.name)
        reply.code(201).send({ category })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not create category'
        if (message.includes('already exists')) {
          return reply.code(409).send({ error: message })
        }
        throw err
      }
    },
  })

  // PUT /admin/categories/:id — rename a category (admin only)
  fastify.put<{ Params: { id: string }; Body: { name: string } }>('/admin/categories/:id', {
    onRequest: [fastify.requireAdmin],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
        },
      },
    },
    handler: async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      try {
        const category = await renameCategory(id, req.body.name)
        reply.send({ category })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not rename category'
        if (message === 'Category not found') {
          return reply.code(404).send({ error: message })
        }
        if (message.includes('already exists')) {
          return reply.code(409).send({ error: message })
        }
        throw err
      }
    },
  })

  // DELETE /admin/categories/:id — delete a category (admin only)
  fastify.delete<{ Params: { id: string } }>('/admin/categories/:id', {
    onRequest: [fastify.requireAdmin],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
    },
    handler: async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      try {
        await deleteCategory(id)
        reply.code(204).send()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not delete category'
        if (message === 'Category not found') {
          return reply.code(404).send({ error: message })
        }
        if (message.includes('Ideas assigned')) {
          return reply.code(409).send({ error: message })
        }
        throw err
      }
    },
  })
})
