import { join, normalize } from 'node:path'

const port = Number(process.env.DEMO_PORT ?? 47833)
const encoderOrigin = process.env.ENCODER_ORIGIN ?? 'http://127.0.0.1:47832'
const rootDirectory = join(import.meta.dir, 'dist')

/** Require the independently launched encoder before serving the demo. */
const assertEncoderHealth = async (): Promise<void> => {
    const response = await fetch(`${encoderOrigin}/health`, {cache: 'no-store'})
    if (!response.ok) {
        throw new Error(`Encoder health check returned HTTP ${response.status}`)
    }
}

/** Open the standalone demo in the user's default browser. */
const openBrowser = (url: string): void => {
    if (process.env.DEMO_OPEN_BROWSER === 'false') {
        return
    }

    const command = process.platform === 'win32'
        ? ['cmd.exe', '/c', 'start', '', url]
        : process.platform === 'darwin'
            ? ['open', url]
            : ['xdg-open', url]

    try {
        Bun.spawn(command, {stdout: 'ignore', stderr: 'ignore'})
    }
    catch {
        console.error(`Open this URL manually: ${url}`)
    }
}

/** Serve one static file from the generated demo directory. */
const serveStaticFile = async (pathname: string): Promise<Response> => {
    const decodedPath = decodeURIComponent(pathname)
    const relativePath = decodedPath === '/'
        ? 'index.html'
        : `${decodedPath.replace(/^\/+/, '')}${decodedPath.endsWith('/') ? 'index.html' : ''}`
    const filePath = normalize(join(rootDirectory, relativePath))
    if (!filePath.startsWith(`${rootDirectory}/`) && filePath !== rootDirectory) {
        return new Response('Not found', {status: 404})
    }

    const file = Bun.file(filePath)
    return await file.exists()
        ? new Response(file)
        : new Response('Not found', {status: 404})
}

/** Proxy the browser's local API calls to the separately running encoder. */
const proxyEncoder = async (request: Request, pathname: string, search: string): Promise<Response> => {
    const target = `${encoderOrigin}${pathname.slice('/encoder'.length)}${search}`
    const headers = new Headers(request.headers)
    headers.delete('host')
    // The demo server makes the upstream request itself, so the browser origin
    // must not be forwarded into the encoder's browser CORS check.
    headers.delete('origin')

    return fetch(target, {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    })
}

try {
    await assertEncoderHealth()
}
catch (error) {
    console.error(error instanceof Error ? error.message : 'The encoder health check failed')
    console.error(`Start the encoder application, then run the demo again. Expected: ${encoderOrigin}/health`)
    process.exit(1)
}

const server = Bun.serve({
    hostname: '127.0.0.1',
    port,
    fetch: async request => {
        const url = new URL(request.url)
        if (url.pathname === '/encoder' || url.pathname.startsWith('/encoder/')) {
            return proxyEncoder(request, url.pathname, url.search)
        }

        return serveStaticFile(url.pathname)
    },
})

const url = `http://127.0.0.1:${server.port}`
console.log(`LGS1920 frame demo is running at ${url}`)
openBrowser(url)
