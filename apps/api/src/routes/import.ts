import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import multipart from '@fastify/multipart'
import { ImportService, ImportError } from '../services/import.service.js'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

function mapImportError(err: ImportError): number {
  switch (err.code) {
    case 'ACCOUNT_NOT_FOUND':
      return 404
    case 'UNKNOWN_FORMAT':
      return 422
    default:
      return 500
  }
}

export async function importRoutes(app: FastifyInstance): Promise<void> {
  await app.register(multipart, { limits: { fileSize: MAX_FILE_SIZE, files: 1 } })

  const importService = new ImportService()

  // POST /import/csv
  app.post('/import/csv', async (req: FastifyRequest, reply: FastifyReply) => {
    const parts = req.parts()

    let csv: string | undefined
    let filename: string | undefined
    let accountId: string | undefined
    let userId: string | undefined

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'file') {
        const chunks: Buffer[] = []
        for await (const chunk of part.file) {
          chunks.push(chunk)
        }
        csv = Buffer.concat(chunks).toString('utf-8')
        filename = part.filename
      } else if (part.type === 'field') {
        if (part.fieldname === 'accountId') accountId = part.value as string
        if (part.fieldname === 'userId') userId = part.value as string
      }
    }

    if (!csv || !filename) {
      return reply.status(400).send({ error: 'MISSING_FILE' })
    }
    if (!accountId) {
      return reply.status(400).send({ error: 'MISSING_ACCOUNT_ID' })
    }
    if (!userId) {
      return reply.status(400).send({ error: 'MISSING_USER_ID' })
    }

    try {
      const result = await importService.importCsv({ csv, filename, accountId, userId })
      return reply.send(result)
    } catch (err) {
      if (err instanceof ImportError) {
        return reply.status(mapImportError(err)).send({ error: err.code })
      }
      throw err
    }
  })
}
