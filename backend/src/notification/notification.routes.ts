import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from './notification.service'

const notificationIdSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
}

export const notificationRoutes = fp(async function notificationPlugin(
  fastify: FastifyInstance,
): Promise<void> {
  // GET /notifications — list all notifications for the current Employee
  fastify.get('/notifications', {
    onRequest: [fastify.authenticate],
    handler: async (req, reply) => {
      const employeeId = req.employee.sub
      const notifications = await listNotifications(employeeId)
      reply.send({ notifications })
    },
  })

  // GET /notifications/unread-count — get count of unread notifications
  fastify.get('/notifications/unread-count', {
    onRequest: [fastify.authenticate],
    handler: async (req, reply) => {
      const employeeId = req.employee.sub
      const unread_count = await getUnreadCount(employeeId)
      reply.send({ unread_count })
    },
  })

  // PATCH /notifications/:id/read — mark a single notification as read
  fastify.patch<{ Params: { id: string } }>('/notifications/:id/read', {
    onRequest: [fastify.authenticate],
    schema: { params: notificationIdSchema },
    handler: async (req, reply) => {
      const notificationId = parseInt(req.params.id, 10)
      const employeeId = req.employee.sub
      const updated = await markNotificationRead(notificationId, employeeId)
      if (!updated) return reply.code(404).send({ error: 'Notification not found' })
      reply.send({ ok: true })
    },
  })

  // PATCH /notifications/read-all — mark all notifications as read
  fastify.patch('/notifications/read-all', {
    onRequest: [fastify.authenticate],
    handler: async (req, reply) => {
      const employeeId = req.employee.sub
      await markAllNotificationsRead(employeeId)
      reply.send({ ok: true })
    },
  })
})
