# Cougar CLI

**An AI-powered programming assistant for the command line**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

## About

Cougar CLI is a derivative work based on the [Cline](https://github.com/cline/cline) project by Cline Bot Inc. It's an autonomous coding agent that can create/edit files, execute commands, use the browser, and more with your permission every step of the way.

This CLI version brings the power of AI-assisted coding directly to your terminal, enabling seamless integration into your development workflow.

## Features

- 🤖 AI-powered code generation and editing
- 📁 Autonomous file operations
- 🔧 Command execution capabilities
- 🌐 Browser integration
- 💬 Interactive chat interface
- 🔐 Secure API key management
- 🎯 Context-aware assistance
- 📋 Session management and history

## Prerequisites

### System Requirements

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 9.0.0 or higher
- **Operating System**: Windows, macOS, or Linux

### API Requirements

- **Claude API Key** from any Claude API provider:
  - Official [Anthropic API](https://console.anthropic.com/)
  - Any third-party API service that provides Claude models
- **Supported Model**: Claude 4.5 Sonnet (currently optimized for this model)
  - Other models may have limited functionality

## Quick Start

### Method 1: Install Directly from GitHub (Recommended)

The fastest way to get started:

```bash
npm install -g https://github.com/dulikaifazr/cougar.git
```

Then configure your API credentials:

```bash
# For official Anthropic API
cougar config set api.apiKey <your-api-key>
cougar config set api.baseUrl https://api.anthropic.com
cougar config set api.modelId claude-4-5-sonnet-20241022

# For third-party API providers
cougar config set api.apiKey <your-api-key>
cougar config set api.baseUrl <your-provider-api-url>
cougar config set api.modelId <model-id-from-provider>
```

Start using Cougar:

```bash
cougar chat "Help me with this task"
```

### Method 2: Clone and Install Locally

If you prefer to clone the repository first:

```bash
git clone https://github.com/dulikaifazr/cougar.git
cd cougar
npm install
npm run build
npm install -g .
```

## Installation

### Step 1: Download and Extract

1. Download the Cougar CLI repository as a ZIP file
2. Extract it to your desired directory:
   ```bash
   unzip cougar-cli.zip
   cd cougar-cli
   ```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Build the Project

```bash
npm run build
```

This will compile the TypeScript source code into the `dist/` directory.

## Configuration

### API Key Setup

Cougar CLI stores configuration in your user home directory:

**Configuration File Location:**
```
~/.cougar/config.json
```

**On Windows:**
```
C:\Users\YourUsername\.cougar\config.json
```

**On macOS/Linux:**
```
~/.cougar/config.json
```

### Setting Up Your API Key

1. Get your Claude API key from any Claude API provider.

2. Configure Cougar with your API credentials:

**For Official Anthropic API:**
```bash
cougar config set api.apiKey <your-api-key>
cougar config set api.baseUrl https://api.anthropic.com
cougar config set api.modelId claude-4-5-sonnet-20241022
```

**For Third-Party API Providers:**
```bash
cougar config set api.apiKey <your-api-key>
cougar config set api.baseUrl <your-provider-api-url>
cougar config set api.modelId <model-id-from-provider>
```

3. Verify your configuration:

```bash
cougar config list
```

### Configuration Options

```bash
# API Configuration
cougar config set api.apiKey <your-api-key>        # Your Claude API key
cougar config set api.baseUrl <api-url>            # API endpoint URL
cougar config set api.modelId <model-id>           # Model identifier
cougar config set api.temperature <0-1>            # Temperature parameter (default: 0.7)

# User Preferences
cougar config set preferences.language zh           # Language (zh/en)
cougar config set preferences.outputFormat json     # Output format (text/json)
```

## Usage

### Basic Chat

```bash
cougar chat "Help me create a React component for a todo list"
```

### Create a New Task

```bash
cougar chat "/newtask Create a new feature for user authentication"
```

### Compress Conversation Context

```bash
cougar chat "/condense Summarize our conversation so far"
```

### Summarize Task

```bash
cougar chat "/summarize What have we accomplished?"
```

### Advanced Options

```bash
# Use specific session
cougar chat "message" --session my-session

# Create new session
cougar chat "message" --new-session

# Custom system prompt
cougar chat "message" -s "You are a Python expert"

# Enable global rules
cougar chat "message" --use-rules

# Enable local project rules
cougar chat "message" --use-local-rules

# Enable workflows
cougar chat "message" --use-workflows

# Enable tool execution mode (AI can execute tools)
cougar chat "message" --tools

# Auto-approve tool operations (use with caution!)
cougar chat "message" --tools --auto-approve
```

## Session Management

### View All Sessions

```bash
cougar session list
```

### Get Session Information

```bash
cougar session info <session-id>
```

### Delete a Session

```bash
cougar session delete <session-id>
```

### Clear Session History

```bash
cougar session clear <session-id>
```

### Export Session

```bash
cougar session export <session-id>
```

## Global Installation

After completing the installation steps above, you can install Cougar globally:

```bash
npm install -g .
```

Or use the global installation command:

```bash
cougar install --global
```

Once installed globally, you can use `cougar` command from any directory:

```bash
cougar chat "Your message here"
```

## Project Structure

```
cougar-cli/
├── src/                          # Source code
│   ├── cli.ts                   # CLI entry point
│   ├── index.ts                 # Main exports
│   ├── api/                     # API handlers
│   ├── core/                    # Core functionality
│   │   ├── context/            # Context management
│   │   ├── rules/              # Rule system
│   │   ├── storage/            # Session storage
│   │   ├── task/               # Task execution
│   │   ├── tools/              # Tool handlers
│   │   └── tracking/           # Usage tracking
│   ├── prompts/                # Prompt templates
│   ├── types/                  # TypeScript types
│   └── utils/                  # Utility functions
├── scripts/                      # Build scripts
├── dist/                         # Compiled output (generated)
├── package.json                  # Project dependencies
├── tsconfig.json                 # TypeScript configuration
├── LICENSE                       # Apache License 2.0
└── README.md                     # This file
```

## Model Support

### Currently Supported

✅ **Claude 4.5 Sonnet** (Recommended)
- Full feature support
- Optimized performance
- Best for complex tasks

### Limited Support

⚠️ **Other Claude Models**
- May have reduced functionality
- Not fully tested
- Use at your own risk

### Configuration

```bash
# Set model
cougar config set api.modelId claude-4-5-sonnet-20241022

# Set custom API endpoint (for third-party providers)
cougar config set api.baseUrl https://your-provider-api.com

# View current model
cougar config get api.modelId

# View current API endpoint
cougar config get api.baseUrl
```

## Rules and Workflows

### Global Rules

Create global rules in:
```
~/.cougar/Rules/
```

### Local Project Rules

Create local rules in your project:
```
.cougarrules/
```

### Using Rules

```bash
# Enable global rules
cougar chat "message" --use-rules

# Enable local project rules
cougar chat "message" --use-local-rules

# Enable workflows
cougar chat "message" --use-workflows
```

## Troubleshooting

### Configuration Not Found

**Error:** `Configuration incomplete, please set API configuration first`

**Solution:**
```bash
cougar config set api.apiKey <your-key>
cougar config set api.baseUrl https://api.anthropic.com
cougar config set api.modelId claude-4-5-sonnet-20241022
```

### API Connection Failed

**Error:** `Failed to connect to API`

**Solutions:**
1. Verify your API key is correct
2. Check your internet connection
3. Verify the API endpoint URL
4. Check if your API key has sufficient quota

### Build Errors

**Error:** `npm run build fails`

**Solutions:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Node.js Version Issue

**Error:** `Node version not supported`

**Solution:**
```bash
# Check your Node version
node --version

# Update Node.js to version 18+
# Visit https://nodejs.org/ for installation instructions
```

## Development

### Watch Mode

For development with automatic recompilation:

```bash
npm run dev
```

### Running Tests

```bash
npm run test
```

## About This Project

### Original Project

This project is based on [Cline](https://github.com/cline/cline) by Cline Bot Inc.

**Original Project URL:** https://github.com/cline/cline

**Original License:** Apache License 2.0

### Changes Made

- Adapted for CLI-first usage
- Optimized configuration management
- Enhanced session handling
- Streamlined command interface

## License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for details.

**Copyright © 2025 dulikaifazr**

**Portions Copyright © 2025 Cline Bot Inc.**

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues, questions, or suggestions:

1. Check the [troubleshooting section](#troubleshooting)
2. Review existing issues on GitHub
3. Create a new issue with detailed information

## Acknowledgments

- Built on top of [Cline](https://github.com/cline/cline)
- Powered by [Claude AI](https://www.anthropic.com/)
- Uses [Commander.js](https://github.com/tj/commander.js) for CLI
- Uses [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-python)

## Disclaimer

This is a derivative work of the Cline project. Please ensure you comply with the Apache License 2.0 when using, modifying, or distributing this software.

---

**Made with ❤️ for developers**
This is a derivative work of the Cline project. Please ensure you comply with the Apache License 2.0 when using, modifying, or distributing this software.

---




