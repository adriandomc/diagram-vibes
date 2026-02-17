'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { DiagramElement, Position, ElementType } from '@/types/diagram';
import { snapToGrid, generateId } from '@/utils/helpers';
import styles from './Canvas.module.scss';

export interface CanvasProps {
  elements: DiagramElement[];
  selectedElementId: string | null;
  selectedTool: ElementType | 'select' | null;
  zoom: number;
  pan: Position;
  gridSize: number;
  snapToGridEnabled: boolean;
  onElementsChange: (elements: DiagramElement[]) => void;
  onSelectElement: (id: string | null) => void;
  onPanChange: (pan: Position) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  selectedElementId,
  selectedTool,
  zoom,
  pan,
  gridSize,
  snapToGridEnabled,
  onElementsChange,
  onSelectElement,
  onPanChange,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [drawingArrow, setDrawingArrow] = useState<Position | null>(null);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number): Position => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        x: (screenX - rect.left - pan.x) / zoom,
        y: (screenY - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  // Handle mouse down on canvas
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        // Middle mouse or Alt+Click for panning
        setIsPanning(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        return;
      }

      if (selectedTool === 'select' || !selectedTool) {
        setIsPanning(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        return;
      }

      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      const pos = snapToGridEnabled ? snapToGrid(canvasPos, gridSize) : canvasPos;

      if (selectedTool === 'arrow') {
        setDrawingArrow(pos);
        return;
      }

      // Create new element
      const newElement: DiagramElement = {
        id: generateId(),
        type: selectedTool,
        position: pos,
        size: selectedTool === 'text' ? undefined : { width: 100, height: 100 },
        text: selectedTool === 'text' ? 'Double click to edit' : '',
        color: '#ffffff',
        borderColor: '#333333',
        borderWidth: 2,
        fontSize: 16,
      };

      onElementsChange([...elements, newElement]);
      onSelectElement(newElement.id);
    },
    [
      selectedTool,
      pan,
      screenToCanvas,
      snapToGridEnabled,
      gridSize,
      elements,
      onElementsChange,
      onSelectElement,
    ]
  );

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        onPanChange({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
        return;
      }

      if (drawingArrow) {
        // Update arrow endpoint while drawing
      }
    },
    [isPanning, dragStart, onPanChange, drawingArrow]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setIsPanning(false);
      }

      if (drawingArrow) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        const endPos = snapToGridEnabled ? snapToGrid(canvasPos, gridSize) : canvasPos;

        const newArrow: DiagramElement = {
          id: generateId(),
          type: 'arrow',
          position: drawingArrow,
          startPoint: drawingArrow,
          endPoint: endPos,
          color: '#333333',
          borderWidth: 2,
        };

        onElementsChange([...elements, newArrow]);
        setDrawingArrow(null);
      }

      setIsDragging(false);
    },
    [isPanning, drawingArrow, screenToCanvas, snapToGridEnabled, gridSize, elements, onElementsChange]
  );

  // Handle element drag
  const handleElementMouseDown = useCallback(
    (e: React.MouseEvent, elementId: string) => {
      e.stopPropagation();
      if (selectedTool !== 'select' && selectedTool !== null) return;

      onSelectElement(elementId);
      setIsDragging(true);
      const element = elements.find((el) => el.id === elementId);
      if (!element) return;

      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      setDragStart({
        x: canvasPos.x - element.position.x,
        y: canvasPos.y - element.position.y,
      });
    },
    [selectedTool, elements, screenToCanvas, onSelectElement]
  );

  // Handle element dragging
  useEffect(() => {
    if (!isDragging || !selectedElementId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      const newPos = {
        x: canvasPos.x - dragStart.x,
        y: canvasPos.y - dragStart.y,
      };

      const finalPos = snapToGridEnabled ? snapToGrid(newPos, gridSize) : newPos;

      const updatedElements = elements.map((el) =>
        el.id === selectedElementId ? { ...el, position: finalPos } : el
      );
      onElementsChange(updatedElements);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    isDragging,
    selectedElementId,
    dragStart,
    elements,
    screenToCanvas,
    snapToGridEnabled,
    gridSize,
    onElementsChange,
  ]);

  // Handle text change
  const handleTextChange = useCallback(
    (elementId: string, text: string) => {
      const updatedElements = elements.map((el) =>
        el.id === elementId ? { ...el, text } : el
      );
      onElementsChange(updatedElements);
    },
    [elements, onElementsChange]
  );

  // Render grid
  const renderGrid = () => {
    if (!canvasRef.current) return null;
    const width = canvasRef.current.clientWidth;
    const height = canvasRef.current.clientHeight;

    const lines = [];
    const scaledGridSize = gridSize * zoom;

    // Vertical lines
    for (let x = pan.x % scaledGridSize; x < width; x += scaledGridSize) {
      lines.push(
        <line
          key={`v-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={height}
          stroke="#e0e0e0"
          strokeWidth={1}
        />
      );
    }

    // Horizontal lines
    for (let y = pan.y % scaledGridSize; y < height; y += scaledGridSize) {
      lines.push(
        <line
          key={`h-${y}`}
          x1={0}
          y1={y}
          x2={width}
          y2={y}
          stroke="#e0e0e0"
          strokeWidth={1}
        />
      );
    }

    return (
      <svg className={styles.grid} width={width} height={height}>
        {lines}
      </svg>
    );
  };

  // Render element
  const renderElement = (element: DiagramElement) => {
    const style: React.CSSProperties = {
      left: element.position.x * zoom + pan.x,
      top: element.position.y * zoom + pan.y,
      transform: `scale(${zoom})`,
      transformOrigin: 'top left',
    };

    const isSelected = element.id === selectedElementId;

    if (element.type === 'arrow' && element.startPoint && element.endPoint) {
      const x1 = element.startPoint.x * zoom + pan.x;
      const y1 = element.startPoint.y * zoom + pan.y;
      const x2 = element.endPoint.x * zoom + pan.x;
      const y2 = element.endPoint.y * zoom + pan.y;

      return (
        <svg
          key={element.id}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <defs>
            <marker
              id={`arrowhead-${element.id}`}
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill={element.color || '#333333'} />
            </marker>
          </defs>
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isSelected ? '#0070f3' : element.color || '#333333'}
            strokeWidth={element.borderWidth || 2}
            markerEnd={`url(#arrowhead-${element.id})`}
            className={`${styles.arrow} ${isSelected ? styles.selected : ''}`}
          />
        </svg>
      );
    }

    if (element.type === 'text') {
      return (
        <div
          key={element.id}
          className={`${styles.element} ${styles.text} ${isSelected ? styles.selected : ''}`}
          style={style}
          onMouseDown={(e) => handleElementMouseDown(e, element.id)}
        >
          <textarea
            className={styles.textInput}
            value={element.text || ''}
            onChange={(e) => handleTextChange(element.id, e.target.value)}
            style={{ fontSize: element.fontSize }}
            rows={1}
          />
        </div>
      );
    }

    const shapeStyle: React.CSSProperties = {
      width: element.size?.width,
      height: element.size?.height,
      background: element.color,
      borderColor: element.borderColor,
      borderWidth: element.borderWidth,
    };

    return (
      <div
        key={element.id}
        className={`${styles.element} ${styles[element.type]} ${isSelected ? styles.selected : ''}`}
        style={{ ...style, ...shapeStyle }}
        onMouseDown={(e) => handleElementMouseDown(e, element.id)}
      >
        {element.text && <span style={{ fontSize: element.fontSize }}>{element.text}</span>}
      </div>
    );
  };

  return (
    <div
      ref={canvasRef}
      className={`${styles.canvas} ${isPanning ? styles.grabbing : selectedTool && selectedTool !== 'select' ? styles.crosshair : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {snapToGridEnabled && renderGrid()}
      <div className={styles.viewport}>
        {elements.map((element) => renderElement(element))}
      </div>
    </div>
  );
};
