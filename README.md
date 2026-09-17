<a id="readme-top"></a>

<!-- PROJECT SHIELDS -->
[![CI][ci-shield]][ci-url]
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![Last Commit][last-commit-shield]][last-commit-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/MiguelCardoso77/GibleTracker">
    <img src="src/assets/Gible.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">GibleTracker</h3>

  <p align="center">
    Find the 100% IV Pokémon spawning near you, on a map, sorted by distance.
    <br />
    <br />
    <a href="https://github.com/MiguelCardoso77/GibleTracker/issues/new?labels=bug">Report Bug</a>
    &middot;
    <a href="https://github.com/MiguelCardoso77/GibleTracker/issues/new?labels=enhancement">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#contributing">Contributing</a></li>
  </ol>
</details>

## About The Project

GibleTracker is a free, small local web app that shows today's 100% IV Pokémon spawns in a given area on an interactive map, using public data.

### Built With

[![TypeScript][TypeScript-badge]][TypeScript-url]<br>
[![Node.js][Node-badge]][Node-url]<br>
[![Leaflet][Leaflet-badge]][Leaflet-url]<br>
[![esbuild][esbuild-badge]][esbuild-url]<br>
[![OpenStreetMap][OSM-badge]][OSM-url]

## Getting Started

Follow these steps to get a local copy up and running.

### Prerequisites

* Node.js 22 or newer
* npm (bundled with Node.js)

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/MiguelCardoso77/GibleTracker.git
   cd GibleTracker
   ```
2. Install dependencies
   ```sh
   npm install
   ```
3. Start the server
   ```sh
   npm start
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Usage

1. Allow the browser to access your location when prompted (optional, but needed for distances and the "away" sorting).
2. Pick an **area** and adjust the **level** range.
3. Hit **Search**. Spawns appear on the map and in the results grid, closest first.
4. Click a tile to open the detail panel and **copy its coordinates**.
5. Search again periodically, the **Likely** badge gets more accurate with every request (see below).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Please run `npm run typecheck` before opening a PR.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[ci-shield]: https://img.shields.io/github/actions/workflow/status/MiguelCardoso77/GibleTracker/gible-tracker-ci.yml?branch=master&style=for-the-badge&label=CI
[ci-url]: https://github.com/MiguelCardoso77/GibleTracker/actions/workflows/gible-tracker-ci.yml
[contributors-shield]: https://img.shields.io/github/contributors/MiguelCardoso77/GibleTracker.svg?style=for-the-badge
[contributors-url]: https://github.com/MiguelCardoso77/GibleTracker/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/MiguelCardoso77/GibleTracker.svg?style=for-the-badge
[forks-url]: https://github.com/MiguelCardoso77/GibleTracker/network/members
[stars-shield]: https://img.shields.io/github/stars/MiguelCardoso77/GibleTracker.svg?style=for-the-badge
[stars-url]: https://github.com/MiguelCardoso77/GibleTracker/stargazers
[issues-shield]: https://img.shields.io/github/issues/MiguelCardoso77/GibleTracker.svg?style=for-the-badge
[issues-url]: https://github.com/MiguelCardoso77/GibleTracker/issues
[last-commit-shield]: https://img.shields.io/github/last-commit/MiguelCardoso77/GibleTracker.svg?style=for-the-badge
[last-commit-url]: https://github.com/MiguelCardoso77/GibleTracker/commits/master
[TypeScript-badge]: https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/
[Node-badge]: https://img.shields.io/badge/Node.js-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white
[Node-url]: https://nodejs.org/
[Leaflet-badge]: https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white
[Leaflet-url]: https://leafletjs.com/
[esbuild-badge]: https://img.shields.io/badge/esbuild-FFCF00?style=for-the-badge&logo=esbuild&logoColor=black
[esbuild-url]: https://esbuild.github.io/
[OSM-badge]: https://img.shields.io/badge/OpenStreetMap-7EBC6F?style=for-the-badge&logo=openstreetmap&logoColor=white
[OSM-url]: https://www.openstreetmap.org/
