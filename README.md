# Diagram Vibes

A modern, intuitive diagram creation web application built with Next.js, TypeScript, and SCSS. Create beautiful diagrams using a drag-and-drop interface with grid snapping, pan/zoom capabilities, and full mobile support.

![Diagram Vibes Screenshot](https://github.com/user-attachments/assets/6b964087-11c2-4d2e-ac34-a808f6ae3cf2)

## Features

- ✨ **Interactive Canvas** - Create diagrams with an intuitive drag-and-drop interface
- 📐 **Multiple Shapes** - Text boxes, rectangles, circles, and arrows
- 🎯 **Grid Snapping** - Automatic alignment to a customizable grid
- 🔍 **Pan & Zoom** - Navigate large diagrams with ease (mouse wheel + Ctrl/Cmd to zoom)
- 📱 **Mobile Responsive** - Fully functional on desktop, tablet, and mobile devices
- ⌨️ **Keyboard Shortcuts** - Fast workflow with intuitive shortcuts
- 🎨 **Clean UI** - Modern interface using Lucide Icons (no emojis)
- 🏗️ **Atomic Design** - Well-structured components following atomic design principles

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: SCSS with modern CSS practices
- **Icons**: Lucide React
- **Architecture**: Atomic Design Pattern (Atoms → Molecules → Organisms)

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/adriandomc/diagram-vibes.git
cd diagram-vibes
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm start
```

## Usage

### Tools

- **Select (V)** - Select and move existing elements
- **Text (T)** - Add text elements to the canvas
- **Rectangle (R)** - Add rectangular shapes
- **Circle (C)** - Add circular shapes
- **Arrow (A)** - Draw arrows between elements

### Controls

- **Zoom In (+)** - Increase canvas zoom
- **Zoom Out (-)** - Decrease canvas zoom
- **Toggle Grid (G)** - Enable/disable grid snapping
- **Clear All** - Remove all elements from canvas

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `V` | Select tool |
| `T` | Text tool |
| `R` | Rectangle tool |
| `C` | Circle tool |
| `A` | Arrow tool |
| `G` | Toggle grid |
| `+` or `=` | Zoom in |
| `-` or `_` | Zoom out |
| `Delete` or `Backspace` | Delete selected element |
| `Escape` | Deselect and return to select tool |

### Mouse Controls

- **Click & Drag** - Move selected elements
- **Alt + Drag** or **Middle Mouse + Drag** - Pan the canvas
- **Ctrl/Cmd + Mouse Wheel** - Zoom in/out

## Project Structure

```
diagram-vibes/
├── src/
│   ├── app/              # Next.js app directory
│   │   ├── layout.tsx    # Root layout
│   │   └── page.tsx      # Home page
│   ├── components/       # React components (Atomic Design)
│   │   ├── atoms/        # Basic building blocks
│   │   │   └── Button/
│   │   ├── molecules/    # Simple component groups
│   │   │   └── Toolbar/
│   │   └── organisms/    # Complex components
│   │       ├── Canvas/
│   │       └── DiagramEditor/
│   ├── styles/           # Global styles and variables
│   │   ├── globals.scss
│   │   └── variables.scss
│   ├── types/            # TypeScript type definitions
│   │   └── diagram.ts
│   └── utils/            # Utility functions
│       └── helpers.ts
├── public/               # Static assets
├── next.config.js        # Next.js configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Project dependencies
```

## Component Architecture

Following **Atomic Design** principles:

- **Atoms** (`Button`): Basic, reusable UI elements
- **Molecules** (`Toolbar`): Simple groups of atoms working together
- **Organisms** (`Canvas`, `DiagramEditor`): Complex, standalone components
- **Templates**: Page-level layouts (via Next.js App Router)

## Mobile Support

The application is fully responsive:
- **Desktop**: Toolbar at the top with full controls
- **Mobile**: Toolbar repositioned to the bottom for better thumb access
- **Touch Support**: Full touch interaction for creating and moving elements

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Icons by [Lucide](https://lucide.dev/)
- Inspired by modern diagramming tools
