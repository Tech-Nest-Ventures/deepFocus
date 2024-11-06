# DeepFocus

<p align="center">
  <img src="resources/icon.png" alt="DeepFocus Logo" width="200" height="200">
</p>

<p align="center">
  <img src="ezgif.com-optimize.gif" alt="DeepFocus in Action" width="700">
</p>


[![Release](https://github.com/Tech-Nest-Ventures/deepFocus/actions/workflows/release.yml/badge.svg)](https://github.com/Tech-Nest-Ventures/deepFocus/actions/workflows/release.yml)
[![Version](https://img.shields.io/npm/v/project.svg)](https://www.npmjs.com/package/project)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey.svg)

> Building the Oura for productivity. Get insights on how productive you are.

Primarily for macOS. Coming to Windows & Linux shortly.

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


### Installation

1. In the Releases section, click on the [latest release] (https://github.com/Tech-Nest-Ventures/deepFocus/releases/latest) and download the Deep Focus.dmg file.

Open the .dmg or .zip file and drag the Deep Focus app to your Applications folder.

2. Add the Deep Focus app to your Dock.

3. Sign up for an account or log in to your existing account.

## Goals

- [x] Allow all users to download on any machine through an Electron JS app
- [x] Migrate to TypeScript and implement SolidJS
- [x] Set up CI/CD pipeline and automatic releases
- [x] Implement changelog using conventional commits
- [x] Add integration and automated tests
- [x] Implement user authentication and cloud-based data persistence
- [x] Implement progress bar for deep work visualization
- [x] Improve user onboarding experience
- [x] Use inspiration from debugtron to render the electron apps most commonly used. Use another API service to get the favicons of the top websites and include this in email and in the desktop app.
- [x] Implement a basic email notification system
- [x] Sign & Notarize the app for macOS
- [x] Collect each site visited. Show users all sites visited in the past day at the end of the day/next day and ask them to label them as productive or unproductive.
- [x] Fix Auto update logic so users don't have to manually update.
- [x] Fix Emails not sending on schedule. 
- [x] Add onboarding flow to improve user comprehension
- [x] Allow users to customize productive/unproductive sites
- [x] Add a gif to the README that shows the app in action
- [ ] Add more comprehensive test suite for main and renderer processes
- [ ] Add timeline view for daily email summaries
- [ ] Upload app to the App Store
- [ ] Collect error logs (sentry, etc)

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

## Troubleshooting

1. Manually Open the Application
   When macOS shows the “developer cannot be verified” error, you can bypass this warning by manually opening the app.

Right-click on the Deep Focus app in the Applications folder.
Select Open.
You should see the same warning message, but this time there will be an Open button to proceed with opening the app.
This will whitelist the app for future use.

2. pnpm (not supported)
   We saw some issues with how pnpm was bundling dependencies in the electron-builder stage and it's inability to target certain architectures. We recommend using npm for now.

3. Verifying the app:

```bash
  codesign -vvv --deep --strict "${appPath}"

  # Check the code signing status of a binary
  codesign -vvv --strict --verbose "${binary}"

  # Check the notarization status of app
  spctl -a -v --type install "${dmgPath}"

  # Notarize the .dmg after its signed
  xcrun notarytool log "UUID" --apple-id "my apple ID" --team-id "my team id" --password "my app password"


  # Check contents of provision profile
  security cms -D -i "/Users/{yourname}/Library/Developer/Xcode/UserData/Provisioning\ Profiles/{nameOfProvisioningProfile}.provisionprofile"


```

4. For Firefox users, there's addditional setup to get the URL of the active tab.

First enable Firefox support for VoiceOver by going to about:config and setting the accessibility.force_disabled property to -1

Source: https://apple.stackexchange.com/questions/404841/get-url-of-opened-firefox-tabs-from-terminal