<p align="center">
  <a href=".github/preview/RU.md">🇷🇺 Русский</a> • 🇺🇸 <b>English</b>
</p>

---

# 🛰️ PA: Dashboard — Interactive Canvas & Combat Simulator (Planetary Annihilation)

![General Preview](.github/preview/general.png)

An analytical tool and tactical combat simulator for **Planetary Annihilation: TITANS**. Built using **Vue 3**, **Vite**, and **Vanilla CSS** to deliver exceptional performance and fluid animations.

Demo: https://rimuwu.github.io/PA-Dashboard/

---

## 🚀 Key Features

### 1. 🗺️ Interactive Canvas
* **Infinite Grid**: Smooth zooming and panning using your mouse.
* **Flexible Grid**: Snap-to-grid functionality for precise component alignment.
* **Marquee Selection**: Quick multi-card selection using a click-and-drag bounding box.
* **Group Areas**: Organize units into squads, resize containers, and track aggregate stats automatically.
* **Connections**: Draw dynamic links between individual cards or groups to map out tactical matchups.

![Group Simulation Preview](.github/preview/group-simulation.png)

### 2. ⚔️ Combat Simulator
* **Tick-by-Tick Simulation**: Highly accurate battle calculations accounting for move speed, weapon range, fire rate, and operational layers (Surface, Air, Underwater, Orbital).
* **Animated Playback**: Real-time battle playback featuring an interactive timeline, detailed combat logs, and a survivor list.
* **Counter Matchmaker**: An intelligent, rapid search algorithm (optimized with binary search and FastMode) to find the minimum unit composition needed to defeat a chosen group.

![Simulation Preview](.github/preview/simulation.png)
![Counter Pick Preview](.github/preview/counter-pick.png)

### 3. ⏱️ Build Order Timeline
* **Seamless Drag & Drop**: Effortlessly drag unit cards directly from the sidebar canvas right into specific minutes on the timeline and back.
* **Auto-Scaling Columns**: Timeline columns dynamically adjust their dimensions to seamlessly accommodate added cards.
* **Smart Time Shifting**: Modifying a column's minute automatically shifts subsequent columns forward by 1 minute to preserve order sequence.
* **Resource Cost Calculator**: Aggregates and displays exact Metal and Energy production requirements for every minute block.

![Timeline Preview](.github/preview/timeline.png)

### 4. 📊 Comparison & Specification Modals
* **Unit Stat Comparison**: A comparative matrix featuring automated highlights for optimal and subpar parameters (Tier, metal cost, HP, DPS, build rate, target layers, energy generation/consumption).
* **Detailed Unit Data**: Full descriptive profiles detailing unit weaponry, damage outputs, firing rates, and targeted layers.

![Comparison Preview](.github/preview/comparison.png)
![Info Preview](.github/preview/info.png)

---

## 🛠️ Technology Stack
* **Framework**: [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`)
* **Build Tool**: [Vite](https://vite.dev/)
* **Styling**: Vanilla CSS (Featuring dark-mode optimization, neon glowing effects, glassmorphism UI, and fluid micro-interactions)
* **Icons**: [Lucide Vue Next](https://lucide.dev/)

---

## 🔧 Getting Started

### Prerequisites
* **Node.js** (Version 18 or newer)
* **npm** package manager

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Once started, open your browser and navigate to `http://localhost:5173`.

### 3. Build for Production
```bash
npm run build
```
Optimized and compiled build outputs will be generated inside the `dist/` directory.

---

## 🎮 Hotkeys & Controls

* **Pan Canvas**: Hold Middle Mouse Button (scroll wheel) or Left Mouse Button on empty canvas space and drag.
* **Zoom Canvas**: Use the mouse scroll wheel.
* **Marquee Select**: Click and drag Left Mouse Button across empty space to draw a selection window.
* **Multi-Select**: Hold `Shift` while clicking individual unit cards.
* **Duplicate Card**: Right-click on a card -> select *Duplicate card*.
* **Create Link**: Drag from a card connector port (left/right edge) and drop onto another unit or group area.
* **Context Menu**: Right-click on any card, area, or empty canvas space to access quick action menus.