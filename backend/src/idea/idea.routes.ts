import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { pipeline } from 'stream/promises'
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'
import {
  createIdea,
  getIdeaById,
  listIdeas,
  updateIdeaContent,
  removeAnonymousFlag,
  archiveIdea,
  unarchiveIdea,
  toIdeaView,
  type IdeaSortOrder,
  type ArchivedFilter,
} from './idea.service'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])

export const ideaRoutes = fp(async function ideaPlugin(fastify: FastifyInstance): Promise<void> {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })

  // POST /ideas — submit a new Idea (multipart/form-data)
  fastify.post('/ideas', {
    onRequest: [fastify.authenticate],
    handler: async (req, reply) => {
      const { sub: submitterId, role } = req.employee

      let title = ''
      let description = ''
      let categoryIdStr = ''
      let anonymous = false
      let image_url: string | null = null
      let validationError: string | null = null

      for await (const part of req.parts()) {
        if (part.type === 'file') {
          const ext = path.extname(part.filename ?? '').toLowerCase()
          if (!ALLOWED_EXTENSIONS.has(ext)) {
            await part.toBuffer() // drain the stream
            validationError = 'Unsupported image type. Allowed: jpg, jpeg, png, gif, webp'
            continue
          }
          const filename = `${randomUUID()}${ext}`
          const filepath = path.join(UPLOAD_DIR, filename)
          await pipeline(part.file, fs.createWriteStream(filepath))
          image_url = `/uploads/${filename}`
        } else {
          const val = part.value as string
          if (part.fieldname === 'title') title = val
          else if (part.fieldname === 'description') description = val
          else if (part.fieldname === 'category_id') categoryIdStr = val
          else if (part.fieldname === 'anonymous') anonymous = val === 'true'
        }
      }

      if (validationError) return reply.code(400).send({ error: validationError })
      if (!title.trim()) return reply.code(400).send({ error: 'title is required' })
      if (!description.trim()) return reply.code(400).send({ error: 'description is required' })

      const category_id = parseInt(categoryIdStr, 10)
      if (!category_id) return reply.code(400).send({ error: 'category_id is required' })

      const row = await createIdea({
        title,
        description,
        category_id,
        submitter_id: submitterId,
        anonymous,
        image_url,
      })

      reply.code(201).send({ idea: toIdeaView(row, submitterId, role) })
    },
  })

  // GET /ideas — paginated, searchable, filterable, sortable list of Ideas
  fastify.get<{
    Querystring: {
      page?: string
      limit?: string
      search?: string
      category_id?: string
      promoted?: string
      sort?: string
      archived?: string
    }
  }>('/ideas', {
    onRequest: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', pattern: '^[0-9]+$' },
          limit: { type: 'string', pattern: '^[0-9]+$' },
          search: { type: 'string', maxLength: 200 },
          category_id: { type: 'string', pattern: '^[0-9]+$' },
          promoted: { type: 'string', enum: ['true', 'false'] },
          sort: {
            type: 'string',
            enum: ['newest', 'highest_impact', 'most_discussed', 'quick_win'],
          },
          archived: { type: 'string', enum: ['active', 'archived', 'all'] },
        },
      },
    },
    handler: async (req, reply) => {
      const page = Math.max(1, parseInt(req.query.page ?? '1', 10))
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit ?? '20', 10)))
      const { sub: requesterId, role } = req.employee
      const isAdmin = role === 'admin'

      // Admin-only: archived and all filters
      const archivedParam = req.query.archived ?? 'active'
      if (archivedParam !== 'active' && !isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
      const archivedFilter = archivedParam as ArchivedFilter

      const sort = (req.query.sort as IdeaSortOrder) ?? 'newest'
      const search = req.query.search?.trim() || undefined
      const categoryId = req.query.category_id ? parseInt(req.query.category_id, 10) : undefined
      let promoted: boolean | undefined
      if (req.query.promoted === 'true') promoted = true
      else if (req.query.promoted === 'false') promoted = false

      const { ideas, total } = await listIdeas({
        page,
        limit,
        search,
        categoryId,
        promoted,
        sort,
        archivedFilter,
      })
      reply.send({
        ideas: ideas.map((row) => toIdeaView(row, requesterId, role)),
        total,
        page,
        limit,
      })
    },
  })

  // GET /ideas/:id — Idea detail
  fastify.get<{ Params: { id: string } }>('/ideas/:id', {
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
      const { sub: requesterId, role } = req.employee

      const row = await getIdeaById(id)
      if (!row) return reply.code(404).send({ error: 'Idea not found' })

      reply.send({ idea: toIdeaView(row, requesterId, role) })
    },
  })

  // PUT /ideas/:id — edit title and description (submitter only)
  fastify.put<{ Params: { id: string }; Body: { title: string; description: string } }>(
    '/ideas/:id',
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
          required: ['title', 'description'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', minLength: 1 },
          },
        },
      },
      handler: async (req, reply) => {
        const id = parseInt(req.params.id, 10)
        const { sub: requesterId, role } = req.employee

        try {
          const row = await updateIdeaContent(id, requesterId, req.body.title, req.body.description)
          reply.send({ idea: toIdeaView(row, requesterId, role) })
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : ''
          if (message === 'Idea not found') return reply.code(404).send({ error: message })
          if (message === 'Forbidden') return reply.code(403).send({ error: message })
          throw err
        }
      },
    },
  )

  // PATCH /ideas/:id/archive — archive an Idea (admin only)
  fastify.patch<{ Params: { id: string } }>('/ideas/:id/archive', {
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
      const { sub: requesterId, role } = req.employee

      try {
        const row = await archiveIdea(id, requesterId, role)
        reply.send({ idea: toIdeaView(row, requesterId, role) })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : ''
        if (message === 'Idea not found') return reply.code(404).send({ error: message })
        if (message === 'Forbidden') return reply.code(403).send({ error: message })
        throw err
      }
    },
  })

  // PATCH /ideas/:id/unarchive — unarchive an Idea (admin only)
  fastify.patch<{ Params: { id: string } }>('/ideas/:id/unarchive', {
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
      const { sub: requesterId, role } = req.employee

      try {
        const row = await unarchiveIdea(id, requesterId, role)
        reply.send({ idea: toIdeaView(row, requesterId, role) })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : ''
        if (message === 'Idea not found') return reply.code(404).send({ error: message })
        if (message === 'Forbidden') return reply.code(403).send({ error: message })
        throw err
      }
    },
  })

  // PATCH /ideas/:id/anonymous — remove anonymous flag (submitter or admin)
  fastify.patch<{ Params: { id: string } }>('/ideas/:id/anonymous', {
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
      const { sub: requesterId, role } = req.employee

      try {
        const row = await removeAnonymousFlag(id, requesterId, role)
        reply.send({ idea: toIdeaView(row, requesterId, role) })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : ''
        if (message === 'Idea not found') return reply.code(404).send({ error: message })
        if (message === 'Forbidden') return reply.code(403).send({ error: message })
        throw err
      }
    },
  })
})

