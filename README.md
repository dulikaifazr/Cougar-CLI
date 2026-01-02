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

## Windows notes

- We fixed multiple Windows compatibility issues during dependency installation and runtime (including issues related to AWS SDK and other packages on Windows).
- Image input is supported on Windows via:
  - Drag-and-drop an image into the terminal
  - Copy an image file path and paste it into the CLI

## License

Apache License 2.0. See `LICENSE`.

Thanks to shareAI-lab/Kode-cli for their contributions.








