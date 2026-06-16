# se.kertasfoto - Professional Photobooth App

![se.kertasfoto Banner](./build/icon.ico) <!-- You can replace this with an actual screenshot or banner -->

**se.kertasfoto** is a professional-grade, cross-platform photobooth application built with web technologies (Electron + React). Designed to offer a premium experience similar to industry-standard software like dslrBooth, it provides event organizers and photobooth operators with powerful features including dynamic templates, DSLR camera integration, and instant Google Drive uploads.

## ✨ Features

* **📷 Advanced Camera Support**
  * **Webcam & Action Cams**: Plug-and-play support for standard USB cameras.
  * **DSLR Integration**: Direct control over DSLR cameras (ISO, Shutter Speed, Aperture) via USB using *digiCamControl*.
  * **Capture Card Mode**: Low-latency live preview using HDMI capture cards while retaining full quality capture via DSLR USB.
  * **Smart Rotation**: Seamlessly handle 90° and 270° portrait camera mounting without stretching or cropping.

* **🎨 Visual Template Editor**
  * Fully interactive drag-and-drop template designer.
  * Custom photo slots, text elements, background colors, and images.
  * Support for various standard paper sizes (4x6, 2x6 strips, square, etc.).

* **🎉 Interactive Booth Mode**
  * Beautiful, animated user interface designed to "WOW" your guests.
  * Capture photos or record animated GIFs.
  * Professional countdowns, DSLR flash overlays, and immediate photo reviews.

* **☁️ Cloud & QR Code Integration**
  * Automatic, silent background uploads to Google Drive folders categorized by Event.
  * Instant QR code generation on-screen for guests to download their photos directly to their smartphones.

* **🖨️ Hardware Printing**
  * Direct printing capabilities matched precisely to the chosen paper size and template aspect ratio.

## 🚀 Tech Stack

* **Core**: [Electron](https://www.electronjs.org/)
* **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/)
* **Styling**: Vanilla CSS with modern aesthetics + [Tailwind CSS v4](https://tailwindcss.com/)
* **Drag & Drop**: [@dnd-kit](https://docs.dndkit.com/)
* **Cloud**: Google Drive API (`googleapis`)
* **Utilities**: `qrcode.react`, `gifshot`

---

## 🛠️ Installation & Setup

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* *Optional (for DSLR control)*: [digiCamControl](https://digicamcontrol.com/) installed and running with Webserver enabled.

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/se-kertasfoto-app.git
cd se-kertasfoto-app
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run in Development Mode
Starts the Vite development server for the React frontend and launches the Electron wrapper with hot-reloading enabled.
```bash
npm run dev
```

### 4. Build for Production
Compiles the application into a standalone, installable `.exe` file for Windows.
```bash
npm run build
```
Once the build is complete, you can find the installer and the unpacked executable in the `release/` directory.

---

## 📸 Usage Guide

### Connecting a DSLR
1. Install [digiCamControl](https://digicamcontrol.com/).
2. Open digiCamControl and connect your camera via USB.
3. In digiCamControl, go to **Settings > Webserver** and enable it.
4. Open **se.kertasfoto**, navigate to **Settings > Camera**, and your DSLR should show as **Connected (Online)**.
5. *(Optional)* If using an HDMI capture card for better frame rates, enable **Capture Card Mode** in the settings.

### Creating an Event
1. Go to the **Events** tab and create a new event.
2. Link the event to a specific Google Drive folder if you want cloud uploads.
3. Select or create a new template for the event.

### Launching the Booth
1. Navigate to **Launch Booth** from the sidebar menu.
2. Ensure your camera is properly positioned.
3. Guests can choose between Print (Photos) or GIF modes.
4. After capture, guests can scan the generated QR code to download their session.

---

## 🤝 Contributing
Contributions, issues, and feature requests are welcome!
Feel free to check the [issues page](https://github.com/yourusername/se-kertasfoto-app/issues).

## 📄 License
This project is proprietary. All rights reserved. 
*(Update this section if you plan to open-source it under MIT, GPL, etc.)*

---
*Built with ❤️ for professional photobooth operators.*
