'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Toolbar } from '@/components/molecules/Toolbar';
import { Canvas } from '@/components/organisms/Canvas';
import { DiagramElement, Position, ElementType } from '@/types/diagram';
import { clamp } from '@/utils/helpers';
import styles from './DiagramEditor.module.scss';

export const DiagramEditor: React.FC = () => {
  const [elements, setElements] = useState<DiagramElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<ElementType | 'select' | null>('select');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 });
  const [snapToGrid, setSnapToGrid] = useState(true);
  const gridSize = 20;

  // Zoom in
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => clamp(prev + 0.1, 0.1, 3));
  }, []);

  // Zoom out
  const handleZoomOut = useCallback(() => {
    setZoom((prev) => clamp(prev - 0.1, 0.1, 3));
  }, []);

  // Toggle grid
  const handleToggleGrid = useCallback(() => {
    setSnapToGrid((prev) => !prev);
  }, []);

  // Clear all elements
  const handleClear = useCallback(() => {
    if (elements.length > 0 && window.confirm('Clear all elements?')) {
      setElements([]);
      setSelectedElementId(null);
    }
  }, [elements.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          setSelectedTool('select');
          break;
        case 't':
          setSelectedTool('text');
          break;
        case 'r':
          setSelectedTool('rectangle');
          break;
        case 'c':
          setSelectedTool('circle');
          break;
        case 'a':
          setSelectedTool('arrow');
          break;
        case 'd':
          setSelectedTool('diamond');
          break;
        case 'i':
          setSelectedTool('triangle');
          break;
        case 'h':
          setSelectedTool('hexagon');
          break;
        case 's':
          setSelectedTool('star');
          break;
        case 'g':
          handleToggleGrid();
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          handleZoomOut();
          break;
        case 'delete':
        case 'backspace':
          if (selectedElementId) {
            e.preventDefault();
            setElements((prev) => prev.filter((el) => el.id !== selectedElementId));
            setSelectedElementId(null);
          }
          break;
        case 'escape':
          setSelectedElementId(null);
          setSelectedTool('select');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, handleZoomIn, handleZoomOut, handleToggleGrid]);

  // Mouse wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom((prev) => clamp(prev + delta, 0.1, 3));
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div className={styles.editor}>
      <Toolbar
        selectedTool={selectedTool}
        onToolSelect={setSelectedTool}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onToggleGrid={handleToggleGrid}
        onClear={handleClear}
        gridEnabled={snapToGrid}
      />
      <Canvas
        elements={elements}
        selectedElementId={selectedElementId}
        selectedTool={selectedTool}
        zoom={zoom}
        pan={pan}
        gridSize={gridSize}
        snapToGridEnabled={snapToGrid}
        onElementsChange={setElements}
        onSelectElement={setSelectedElementId}
        onPanChange={setPan}
      />
    </div>
  );
};
