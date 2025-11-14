# Polaroid A4 Sheet Generator

A Next.js application that generates Polaroid-style A4 sheets with rotated captions. Upload multiple images (including HEIC/HEIF format) and they'll be automatically arranged in a printable A4 format.

## Features

- Upload multiple images at once
- Automatic HEIC/HEIF to JPEG conversion
- Polaroid-style layout (2 columns × 4 rows per page)
- Rotated captions (90°) at the bottom of each polaroid
- Print-optimized A4 layout
- Responsive design with Tailwind CSS

## Getting Started

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Usage

1. Click "Choose photos" and select one or more images
2. Images will be automatically arranged in Polaroid-style layouts
3. Each A4 page contains 8 polaroids (2 columns × 4 rows)
4. Captions are automatically extracted from filenames and rotated 90°
5. Use your browser's print function (Ctrl+P / Cmd+P) to print the pages

## Technologies

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- heic2any (for HEIC/HEIF conversion)

# image2poloroid
