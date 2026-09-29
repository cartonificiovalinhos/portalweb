process.env.UV_THREADPOOL_SIZE = '128';
require('dotenv').config({ override: false });
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = dev ? 'localhost' : '0.0.0.0'
const port = process.env.PORT || 3000
// app inicializado
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      const { pathname, query } = parsedUrl

      if (pathname === '/a') {
        await app.render(req, res, '/a', query)
      } else if (pathname === '/b') {
        await app.render(req, res, '/b', query)
      } else {
        await handle(req, res, parsedUrl)
      }
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })
  let shuttingDown = false

  const closeServer = (signal) => {
    if (shuttingDown) return
    shuttingDown = true

    if (!server.listening) {
      console.warn(`> Shutdown requested by ${signal}, but server is already stopped`)
      process.exit(0)
      return
    }

    console.log(`> ${signal} received, closing HTTP server...`)
    server.close((err) => {
      if (err && err.code !== 'ERR_SERVER_NOT_RUNNING') {
        console.error('> Error while closing HTTP server', err)
        process.exit(1)
        return
      }
      process.exit(0)
    })
  }

  server.on('error', (err) => {
    console.error('> HTTP server error', err)
  })

  process.on('SIGTERM', () => closeServer('SIGTERM'))
  process.on('SIGINT', () => closeServer('SIGINT'))

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
