# @injurkx/vault-locator

Discover Obsidian vaults on the local machine and normalize cross-platform paths (Windows / WSL / tilde).

The lookup strategy mirrors how Obsidian itself knows about vaults:

1. The official vault registry (`obsidian.json` in `%APPDATA%/obsidian` on Windows, `~/Library/Application Support/obsidian` on macOS, `~/.config/obsidian` on Linux). Under WSL, Windows registry copies under `/mnt/c/Users/*/AppData/Roaming/obsidian` are scanned as well.
2. Standard user folders (`~/Documents`, `~/Obsidian`, ...) that contain a `.obsidian` marker.

## Install

```bash
bun add @injurkx/vault-locator
```

## Usage

```typescript
import { discoverVaultFolders, discoverVaultRoots, normalizeFsPath } from '@injurkx/vault-locator'

// All known vault roots (registry + .obsidian marker folders)
const roots = discoverVaultRoots()
// => ['/home/user/Documents/notes', '/mnt/c/Users/me/Documents/wiki']

// Find target folders inside known vaults (checks the vault root,
// then descends one level deep, e.g. <vault>/Personal/Travel)
const travelFolders = discoverVaultFolders('Travel')
// => [{ path: '/home/user/Documents/notes/Travel', vaultRoot: '...', name: 'Travel' }]

// Normalize a pasted path: strips quotes, converts backslashes,
// maps C:/... to /mnt/c/... under WSL, expands ~, makes absolute
normalizeFsPath('"C:\\Users\\me\\Documents\\notes"')
// => '/mnt/c/Users/me/Documents/Documents/notes'
```

## API

| Function | Description |
| --- | --- |
| `normalizeFsPath(rawPath)` | Normalize a raw path: quotes, backslashes, Windows drives under WSL, `~`, relative paths. |
| `readObsidianVaultRegistry()` | Read vault paths from the official Obsidian registry (returns only existing directories). |
| `discoverVaultRoots()` | Find real vault roots (registry + standard folders with `.obsidian`). |
| `discoverVaultFolders(target?)` | Find target folders (default `Travel`) inside known vaults, up to one level deep. |
| `getCandidateTravelDirs(target?)` | Last-resort candidates: registry paths and home folders, without the `.obsidian` check. |

## License

MIT
