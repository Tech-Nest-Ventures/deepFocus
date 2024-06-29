# deepwork

###
[DeepWork](resources/gaudmire-ig.png)

// TODO: VS Code extension to preview Markdown

Mission: 
Building the oura for productivity. Get insights on how productive you are. 


### Goals

Goal for the next 2 hours: build minimum viable prototype: 
1. ~~Allow all users to download on any machine through an Electron JS app ~~
2. Allow users to enter a goal in their session. 
3. Application will get FULL System Access and collect logs every min to observe what the active window is. We'll ask in onboarding whether certain sites should be labeled as productive or not productive. 


Note: 
Using JS for now, eventually will move to TS. ~~Considering using SolidJS instead of React as well~~
Also, set up a CI/CD pipeline and allow users to download automatic releases. Also add a changelog using conventional commits


## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ pnpm install
```

### Development

```bash
$ pnpm dev
```

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```
