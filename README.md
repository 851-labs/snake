<div align="center">
  <h1><b>Snake</b></h1>
  <p>Classic Snake in your terminal, built with OpenTUI.</p>
</div>

<div align="center">
  <a href="https://github.com/851-labs/snake/releases/latest">
    <img src="https://img.shields.io/github/v/release/851-labs/snake?label=Release&style=flat" alt="Latest Release">
  </a>
  <a href="https://github.com/851-labs/homebrew-tap">
    <img src="https://img.shields.io/badge/Homebrew-851--labs%2Ftap-fbb040?logo=homebrew&logoColor=white&style=flat" alt="Homebrew tap">
  </a>
  <a href="https://github.com/851-labs/snake/releases/latest">
    <img src="https://img.shields.io/badge/Download-macOS%20%2B%20Linux-black?style=flat" alt="Download">
  </a>
  <img src="https://img.shields.io/github/downloads/851-labs/snake/total?label=downloads&style=flat" alt="Downloads">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue?style=flat" alt="MIT License">
  </a>
</div>

## Installation

```bash
brew tap 851-labs/tap
brew install snake
```

## Usage

```bash
snake
```

## Controls

- Arrow keys or WASD: move
- P or Space: pause
- R: restart
- Q: quit

## Development

```bash
bun install
bun run start
```

OpenTUI requires Zig to build its native components. If you see build errors, install Zig first.

## Tech Stack

- [OpenTUI](https://github.com/sst/opentui) - Terminal UI framework
- [Bun](https://bun.sh) - Runtime and build tool

## License

This project is released under the MIT License. See [LICENSE](LICENSE) for details.
