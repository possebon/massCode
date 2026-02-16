import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { Elysia } from 'elysia'
import { getConfig } from '../config'
import { importEsm } from '../utils'
import folders from './routes/folders'
import snippets from './routes/snippets'
import tags from './routes/tags'

export async function initApi() {
  // поскольку @elysiajs/node использует crossws, который работает только в ESM среде,
  // то делаем хак с динамическим импортом
  const { node } = await importEsm('@elysiajs/node')

  const app = new Elysia({ adapter: node() })
  const { apiPort, version } = getConfig()

  app
    .use(cors({ origin: '*' }))
    .use(
      swagger({
        documentation: {
          info: {
            title: 'massCode API',
            version,
          },
        },
      }),
    )
    .use(snippets)
    .use(folders)
    .use(tags)
    .listen(apiPort)

  // eslint-disable-next-line no-console
  console.log(`\nAPI started on port ${apiPort}\n`)
}
