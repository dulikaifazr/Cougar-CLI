import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

process.env.NODE_ENV = 'test'
const {
  addParallelSearchServer,
  addMcpServer,
  getMCPTools,
  getClients,
  listMCPServers,
  removeMcpServer,
} = await import('../src/services/mcpClient')
const { getTools } = await import('../src/tools')
const { getCurrentProjectConfig, saveCurrentProjectConfig } =
  await import('../src/utils/config')

const endpoint = 'https://search.parallel.ai/mcp'
const userAgent = 'cougar/1.0.0 (+https://github.com/dulikaifazr/Cougar-CLI)'
const context = () => ({
  abortController: new AbortController(),
  messageId: undefined,
  readFileTimestamps: {},
})

async function reset() {
  for (const client of await getClients()) {
    if (client.type === 'connected') await client.client.close()
  }
  getClients.cache.clear()
  getMCPTools.cache.clear()
}

// Run after npm run build. Each CLI invocation uses real, isolated saved config.
test('built CLI registers, displays and removes the opt-in preset without overwriting choices', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cougar-mcp-'))
  mkdirSync(join(dir, 'config'))
  const cli = resolve('dist/index.js')
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [cli, 'mcp', ...args], {
      cwd: dir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        CLAUDE_CONFIG_DIR: join(dir, 'config'),
        cougar_CONFIG_DIR: join(dir, 'config'),
      },
      encoding: 'utf8',
    })
  try {
    assert.equal(run('list').status, 0)
    assert.equal(run('add-parallel').status, 0)
    const saved = JSON.parse(
      readFileSync(join(dir, 'config/config.json'), 'utf8'),
    )
    assert.deepEqual(saved.projects[dir].mcpServers['parallel-search'], {
      type: 'http',
      url: endpoint,
    })
    assert.match(run('get', 'parallel-search').stdout, /Type: http/)
    assert.match(
      run('list').stdout,
      /https:\/\/search.parallel.ai\/mcp \(HTTP\)/,
    )
    assert.equal(run('add-parallel', '--scope', 'global').status, 1)
    assert.equal(run('remove', 'parallel-search').status, 0)
    assert.doesNotMatch(run('list').stdout, /parallel-search/)
    assert.equal(run('add-parallel', '--scope', 'global').status, 0)
    assert.equal(
      run('remove', 'parallel-search', '--scope', 'global').status,
      0,
    )
    assert.equal(run('add-parallel', '--scope', 'mcprc').status, 0)
    assert.deepEqual(
      JSON.parse(readFileSync(join(dir, '.mcprc'), 'utf8'))['parallel-search'],
      { type: 'http', url: endpoint },
    )
    assert.equal(run('remove', 'parallel-search', '--scope', 'mcprc').status, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('production MCP loader dispatches HTTP tools, consumes responses and preserves approvals', async (t) => {
  const originalFetch = globalThis.fetch
  const requests: any[] = []
  let onHeldCall: (() => void) | undefined
  let holdInitialize = false
  const server = createServer(async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405).end()
      return
    }
    let body = ''
    for await (const chunk of req) body += chunk
    const message = JSON.parse(body)
    requests.push({ message, headers: req.headers, path: req.url })
    if (message.id === undefined) {
      res.writeHead(202).end()
      return
    }
    if (holdInitialize && message.method === 'initialize') {
      onHeldCall?.()
      return
    }
    if (message.params?.arguments?.objective === 'http-error') {
      res.writeHead(503).end('Service unavailable')
      return
    }
    let result: any
    if (message.method === 'initialize')
      result = {
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'fixture', version: '1.0' },
      }
    else if (message.method === 'tools/list')
      result = {
        tools: ['web_search', 'web_fetch'].map((name) => ({
          name,
          inputSchema: { type: 'object', properties: {} },
        })),
      }
    else if (message.params.arguments.objective === 'hold') {
      onHeldCall?.()
      return
    } else if (message.params.arguments.objective === 'error')
      result = {
        isError: true,
        content: [{ type: 'text', text: 'Explicit server error' }],
      }
    else
      result = {
        content: [
          {
            type: 'text',
            text: `Current MCP documentation: https://modelcontextprotocol.io/ ${message.params.name}`,
          },
        ],
      }
    res
      .writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as { port: number }
  // Preserve the production destination assertions, then send actual SDK HTTP
  // requests to a deterministic local MCP fixture instead of the remote service.
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), endpoint)
    const headers = new Headers(init?.headers)
    assert.equal(headers.get('User-Agent'), userAgent)
    assert.equal(headers.has('Authorization'), false)
    return originalFetch(`http://127.0.0.1:${address.port}/mcp`, init)
  }
  try {
    assert.deepEqual(listMCPServers(), {})
    assert.deepEqual(await getMCPTools(), [])
    const defaults = await getTools()
    assert.ok(defaults.some((tool) => tool.name === 'WebSearch'))
    assert.equal(
      defaults.some((tool) => tool.name.startsWith('mcp__')),
      false,
    )
    getTools.cache.clear()
    await reset()
    addParallelSearchServer('mcprc')
    assert.deepEqual(await getMCPTools(), []) // pending approval is not loaded
    await reset()
    saveCurrentProjectConfig({
      ...getCurrentProjectConfig(),
      rejectedMcprcServers: ['parallel-search'],
    })
    assert.deepEqual(await getMCPTools(), [])
    await reset()
    saveCurrentProjectConfig({
      ...getCurrentProjectConfig(),
      rejectedMcprcServers: [],
      approvedMcprcServers: ['parallel-search'],
    })
    const tools = (await getTools()).filter((tool) =>
      tool.name.startsWith('mcp__'),
    )
    assert.deepEqual(
      tools.map((tool) => tool.name),
      ['mcp__parallel-search__web_search', 'mcp__parallel-search__web_fetch'],
    )
    for (const tool of tools) {
      assert.equal(tool.needsPermissions(), true)
      const results = []
      for await (const result of tool.call(
        tool.name.endsWith('web_search')
          ? {
              objective: 'MCP docs',
              search_queries: ['MCP official documentation'],
            }
          : { urls: ['https://modelcontextprotocol.io/'] },
        context(),
      ))
        results.push(result)
      assert.match(
        JSON.stringify(results[0]),
        /https:\/\/modelcontextprotocol.io\//,
      )
      assert.deepEqual(results[0].data, results[0].resultForAssistant)
    }
    assert.throws(() => addParallelSearchServer(), /already exists/)
    const search = tools[0]
    await assert.rejects(async () => {
      for await (const _ of search.call({ objective: 'error' }, context())) {
      }
    }, /Explicit server error/)
    await assert.rejects(async () => {
      for await (const _ of search.call(
        { objective: 'http-error' },
        context(),
      )) {
      }
    }, /Service unavailable/)
    const before = requests.length
    const cancelled = context()
    cancelled.abortController.abort()
    await assert.rejects(async () => {
      for await (const _ of search.call({ objective: 'cancel' }, cancelled)) {
      }
    }, /abort/i)
    assert.equal(requests.length, before)
    await t.test('in-flight cancellation', async () => {
      const running = context()
      const held = new Promise<void>((resolve) => {
        onHeldCall = resolve
      })
      const pending = search.call({ objective: 'hold' }, running).next()
      await held
      running.abortController.abort()
      await assert.rejects(pending, /abort/i)
    })
    await t.test('tool request timeout', async (sub) => {
      sub.mock.timers.enable({ apis: ['setTimeout'] })
      const held = new Promise<void>((resolve) => {
        onHeldCall = resolve
      })
      const pending = search.call({ objective: 'hold' }, context()).next()
      await held
      sub.mock.timers.tick(60001)
      await assert.rejects(pending, /timed out/i)
      sub.mock.timers.reset()
    })
    assert.ok(requests.some((r) => r.message.method === 'initialize'))
    assert.ok(requests.some((r) => r.message.method === 'tools/list'))
    assert.ok(requests.some((r) => r.message.params?.name === 'web_fetch'))
    assert.ok(
      requests.every(
        (r) => r.headers['user-agent'] === userAgent && r.path === '/mcp',
      ),
    )
    assert.equal(
      requests.some((r) => r.message.params?.arguments?.session_id),
      false,
    )
    await reset()
    await t.test('connection timeout', async (sub) => {
      holdInitialize = true
      sub.mock.timers.enable({ apis: ['setTimeout'] })
      const held = new Promise<void>((resolve) => {
        onHeldCall = resolve
      })
      const pending = getClients()
      await held
      sub.mock.timers.tick(5001)
      assert.deepEqual(await pending, [
        { name: 'parallel-search', type: 'failed' },
      ])
      sub.mock.timers.reset()
      holdInitialize = false
    })
    await reset()
    removeMcpServer('parallel-search', 'mcprc')
    addMcpServer('parallel-search', {
      type: 'stdio',
      command: 'existing-choice',
      args: [],
    })
    assert.throws(() => addParallelSearchServer('global'), /already exists/)
    assert.equal(listMCPServers()['parallel-search'].type, 'stdio')
    removeMcpServer('parallel-search')
  } finally {
    await reset()
    globalThis.fetch = originalFetch
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
