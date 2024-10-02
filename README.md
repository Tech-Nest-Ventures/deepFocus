# DeepFocus

<p align="center">
  <img src="resources/icon.png" alt="DeepFocus Logo" width="200" height="200">
</p>

[![Release](https://github.com/Tech-Nest-Ventures/deepFocus/actions/workflows/release.yml/badge.svg)](https://github.com/Tech-Nest-Ventures/deepFocus/actions/workflows/release.yml)
[![Version](https://img.shields.io/npm/v/project.svg)](https://www.npmjs.com/package/project)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Building the Oura for productivity. Get insights on how productive you are.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Goals](#goals)
- [Philosophy](#philosophy)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Features

- Daily email summaries of deep work hours
- Productivity tracking and insights
- Customizable productivity site labeling

## Tech Stack

![Electron](https://img.shields.io/badge/-Electron-47848F?style=flat-square&logo=electron&logoColor=white)
![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![SolidJS](https://img.shields.io/badge/-SolidJS-2C4F7C?style=flat-square&logo=solid&logoColor=white)

## Getting Started

### Prerequisites

- Node.js LTS >=v20.12.2
- npm v10.5.0 or pnpm

### Installation

```bash
pnpm install
```

```bash
pnpm dev
```

## Usage

Note, for running this app locally, you may run into issues with active-window. Try running `npm install --ignore-scripts` to fix this. More info [here](https://github.com/sindresorhus/active-window/issues/10).

## Goals

- [x] Allow all users to download on any machine through an Electron JS app
- [x] Migrate to TypeScript and implement SolidJS
- [x] Set up CI/CD pipeline and automatic releases
- [x] Implement changelog using conventional commits
- [x] Add integration and automated tests
- [x] Implement user authentication and cloud-based data persistence
- [ ] Allow users to enter session goals and customize productive/unproductive sites
- [ ] Migrate from electron-storage to SQLite for improved data handling
- [ ] Implement progress bar for deep work visualization
- [ ] Enhance data analysis and insights
- [ ] Improve user onboarding experience
- [ ] Develop comprehensive test suite for main and renderer processes
- [ ] Create cloud synchronization for user data and preferences
- [ ] Implement secure user authentication system
- [ ] Use inspiration from debugtron to render the electron apps most commonly used. Use another API service to get the favicons of the top websites and include this in email and in the desktop app.
- [ ] Collect each site visited. Show users all sites visited in the past day at the end of the day/next day and ask them to label them as productive or unproductive.
- [ ] To do list like functionality? Have people add tasks to their list and mark as productive or not productive. Then, at the end of the day, they can see a list of tasks and see how productive they were.
- [ ] Add a light

## Philosophy

DeepFocus is built primarily for Software Engineers, Product Managers, and Designers. We believe in:

- Creating systems to combat imposter syndrome
- Focusing on the journey, not just the end goal
- Encouraging consistent, focused work

## Roadmap

- Implement progress bar for deep work visualization
- Enhance data analysis and insights
- Improve user onboarding experience
- Develop comprehensive test suite for main and renderer processes
- Create cloud synchronization for user data and preferences
- Implement secure user authentication system

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

Timeo Williams [@timeowilliams](https://twitter.com/timeowilliams) - timeo.williams@gmail.com

Problems:

1. UI for Analytics doesn't send a request to get fresh data after 24 hours if
   the user stays on the same Analytics page. Perhaps a refresh button would be
   better? Or force a refresh after a certain amount of time?

2. Need to allow customers to add websites that are productive
   so that we can track the time spent on those sites.

As a default, the Login Window and Settings page should be hidden.
windowInfo {
owner: {
name: 'loginwindow',
processId: 186,
bundleId: 'com.apple.loginwindow',
path: '/System/Library/CoreServices/loginwindow.app'
},
bounds: { width: 30000, y: -15000, height: 30000, x: -15000 },
memoryUsage: 18672,
title: '',
platform: 'macos',
id: 23597
}
windowInfo {
owner: {
processId: 516,
bundleId: 'com.apple.finder',
name: 'Finder',
path: '/System/Library/CoreServices/Finder.app'
},
}

Honestly, if any of the bundleIDs contain com.apple, it's probably not productive.

Last, but not least, let's sign this App up for the Apple Developer Program.
