# Cougar CLI

**An AI-powered programming assistant for the command line**

## LLM providers

Supported model providers:

- OpenRouter
- OpenAI
- Claude
- 智谱（Zhipu）
- Any provider compatible with the OpenAI API standard

## Start (from source)

1. Download the source code
2. Install dependencies

```bash
npm install
```

3. Build

```bash
npm run build
```

4. Start the CLI

```bash
node dist\index.js
```

## Optional Parallel Search MCP

Add free web search and page fetching with [Parallel Search MCP](https://docs.parallel.ai/integrations/mcp/search-mcp), using Fast mode for anonymous search. No Parallel account or API key is needed.

```bash
node dist/index.js mcp add-parallel
```

Restart Cougar, then ask it to use `parallel-search:web_search` or `parallel-search:web_fetch`. These tools use the existing MCP tool permission prompts. The command configures the current project; add `--scope global` for all projects or `--scope mcprc` for a shared `.mcprc` file, which still requires each project's server approval. Existing servers named `parallel-search` are never overwritten.

DuckDuckGo remains the built-in WebSearch default. Remove this optional server with `node dist/index.js mcp remove parallel-search` (use the same `--scope` used to add it), then restart Cougar. Anonymous service limits apply; server errors are reported without switching providers. Search queries and fetched URLs are sent to Parallel when its tools are called.

## Windows notes

- We fixed multiple Windows compatibility issues during dependency installation and runtime (including issues related to AWS SDK and other packages on Windows).
- Image input is supported on Windows via:
  - Drag-and-drop an image into the terminal
  - Copy an image file path and paste it into the CLI

## License

Apache License 2.0. See `LICENSE`.

Thanks to shareAI-lab/Kode-cli for their contributions.








