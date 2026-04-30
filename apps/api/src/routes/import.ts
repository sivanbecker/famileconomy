import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import multipart from '@fastify/multipart'
import { ImportService, ImportError } from '../services/import.service.js'
import type { Provider } from '../services/import.service.js'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

const VALID_PROVIDERS = new Set<Provider>(['MAX', 'CAL'])

function isProvider(value: unknown): value is Provider {
  return typeof value === 'string' && VALID_PROVIDERS.has(value as Provider)
}

function mapImportError(err: ImportError): { status: number; message: string } {
  switch (err.code) {
    case 'FORMAT_MISMATCH':
      return { status: 422, message: 'הקובץ אינו תואם לספק שנבחר.' }
    case 'CARD_NOT_FOUND':
      return { status: 422, message: 'לא נמצא מספר כרטיס בקובץ.' }
    case 'FILE_ALREADY_IMPORTED':
      return { status: 409, message: 'You already imported this file!' }
    case 'UNKNOWN_FORMAT':
      return { status: 422, message: 'Unrecognised CSV format.' }
    default:
      return { status: 500, message: 'Import failed.' }
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
    let provider: Provider | undefined
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
        if (part.fieldname === 'provider') {
          const v = part.value as string
          if (isProvider(v)) provider = v
        }
        if (part.fieldname === 'userId') userId = part.value as string
      }
    }

    if (!csv || !filename) {
      return reply.status(400).send({ error: 'MISSING_FILE' })
    }
    if (!provider) {
      return reply.status(400).send({ error: 'MISSING_PROVIDER' })
    }
    if (!userId) {
      return reply.status(400).send({ error: 'MISSING_USER_ID' })
    }

    try {
      const result = await importService.importCsv({ csv, filename, provider, userId })
      return reply.send(result)
    } catch (err) {
      if (err instanceof ImportError) {
        const { status, message } = mapImportError(err)
        return reply.status(status).send({ error: err.code, message })
      }
      throw err
    }
  })
}
