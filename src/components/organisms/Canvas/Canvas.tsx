'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { DiagramElement, Position, ElementType, Size } from '@/types/diagram';
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

// Helper to get the center of an element
const getElementCenter = (element: DiagramElement): Position => {
  if (element.type === 'arrow') {
    return element.position;
  }
  const size = element.size || { width: 100, height: 100 };
  return {
    x: element.position.x + size.width / 2,
    y: element.position.y + size.height / 2,
  };
};

// Helper to get connection point on element edge
const getConnectionPoint = (element: DiagramElement, targetPoint: Position): Position => {
  const center = getElementCenter(element);
  const size = element.size || { width: 100, height: 100 };
  
  const dx = targetPoint.x - center.x;
  const dy = targetPoint.y - center.y;
  const angle = Math.atan2(dy, dx);
  
  if (element.type === 'circle') {
    const radius = size.width / 2;
    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    };
  }
  
  // For rectangles and other shapes, find intersection with edge
  const hw = size.width / 2;
  const hh = size.height / 2;
  
  const tan = Math.abs(Math.tan(angle));
  let x: number, y: number;
  
  if (tan * hw <= hh) {
    // Intersects with left or right edge
    x = Math.sign(dx) * hw;
    y = Math.sign(dx) * hw * Math.tan(angle);
  } else {
    // Intersects with top or bottom edge
    x = Math.sign(dy) * hh / Math.tan(angle);
    y = Math.sign(dy) * hh;
  }
  
  return {
    x: center.x + x,
    y: center.y + y,
  };
};

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
  const [drawingArrow, setDrawingArrow] = useState<{ start: Position; startElementId?: string } | null>(null);
  const [arrowPreviewEnd, setArrowPreviewEnd] = useState<Position | null>(null);
  const [drawingShape, setDrawingShape] = useState<{ start: Position; type: ElementType } | null>(null);
  const [shapePreview, setShapePreview] = useState<{ position: Position; size: Size } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);

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

  // Find element at position
  const findElementAtPosition = useCallback(
    (pos: Position): DiagramElement | null => {
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.type === 'arrow' || el.type === 'text') continue;
        
        const size = el.size || { width: 100, height: 100 };
        if (
          pos.x >= el.position.x &&
          pos.x <= el.position.x + size.width &&
          pos.y >= el.position.y &&
          pos.y <= el.position.y + size.height
        ) {
          return el;
        }
      }
      return null;
    },
    [elements]
  );

  // Update arrow endpoints when connected shapes move
  const updateConnectedArrows = useCallback(
    (movedElementId: string, newPosition: Position) => {
      const movedElement = elements.find((el) => el.id === movedElementId);
      if (!movedElement) return elements;

      return elements.map((el) => {
        if (el.type !== 'arrow') return el;

        let updated = { ...el };

        if (el.startElementId === movedElementId) {
          const targetElement = elements.find((e) => e.id === el.endElementId);
          const targetPos = targetElement
            ? getElementCenter({ ...targetElement })
            : el.endPoint!;
          const startPoint = getConnectionPoint(
            { ...movedElement, position: newPosition },
            targetPos
          );
          updated = { ...updated, startPoint, position: startPoint };
        }

        if (el.endElementId === movedElementId) {
          const sourceElement = elements.find((e) => e.id === el.startElementId);
          const sourcePos = sourceElement
            ? getElementCenter(sourceElement)
            : el.startPoint!;
          const endPoint = getConnectionPoint(
            { ...movedElement, position: newPosition },
            sourcePos
          );
          updated = { ...updated, endPoint };
        }

        return updated;
      });
    },
    [elements]
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
        const startElement = findElementAtPosition(pos);
        setDrawingArrow({
          start: pos,
          startElementId: startElement?.id,
        });
        setArrowPreviewEnd(pos);
        return;
      }

      if (selectedTool === 'text') {
        // Text elements are created on click
        const newElement: DiagramElement = {
          id: generateId(),
          type: 'text',
          position: pos,
          text: 'Double click to edit',
          color: '#ffffff',
          borderColor: '#333333',
          borderWidth: 2,
          fontSize: 16,
        };
        onElementsChange([...elements, newElement]);
        onSelectElement(newElement.id);
        return;
      }

      // Start drawing shape with click-and-drag
      setDrawingShape({ start: pos, type: selectedTool });
      setShapePreview({ position: pos, size: { width: 0, height: 0 } });
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
      findElementAtPosition,
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

      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      const pos = snapToGridEnabled ? snapToGrid(canvasPos, gridSize) : canvasPos;

      if (drawingArrow) {
        setArrowPreviewEnd(pos);
        return;
      }

      if (drawingShape) {
        const width = Math.abs(pos.x - drawingShape.start.x);
        const height = Math.abs(pos.y - drawingShape.start.y);
        const x = Math.min(pos.x, drawingShape.start.x);
        const y = Math.min(pos.y, drawingShape.start.y);
        setShapePreview({
          position: { x, y },
          size: { width, height },
        });
      }
    },
    [isPanning, dragStart, onPanChange, drawingArrow, drawingShape, screenToCanvas, snapToGridEnabled, gridSize]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setIsPanning(false);
      }

      if (drawingArrow && arrowPreviewEnd) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        const endPos = snapToGridEnabled ? snapToGrid(canvasPos, gridSize) : canvasPos;
        const endElement = findElementAtPosition(endPos);

        // Calculate proper start and end points based on connections
        let startPoint = drawingArrow.start;
        let endPoint = endPos;

        if (drawingArrow.startElementId) {
          const startEl = elements.find((el) => el.id === drawingArrow.startElementId);
          if (startEl) {
            startPoint = getConnectionPoint(startEl, endPoint);
          }
        }

        if (endElement) {
          endPoint = getConnectionPoint(endElement, startPoint);
        }

        const newArrow: DiagramElement = {
          id: generateId(),
          type: 'arrow',
          position: startPoint,
          startPoint,
          endPoint,
          startElementId: drawingArrow.startElementId,
          endElementId: endElement?.id,
          color: '#333333',
          borderWidth: 2,
        };

        onElementsChange([...elements, newArrow]);
        setDrawingArrow(null);
        setArrowPreviewEnd(null);
      }

      if (drawingShape && shapePreview) {
        const minSize = 20;
        const finalSize = {
          width: Math.max(shapePreview.size.width, minSize),
          height: Math.max(shapePreview.size.height, minSize),
        };

        // If the shape is too small, create with default size at click position
        if (shapePreview.size.width < minSize && shapePreview.size.height < minSize) {
          finalSize.width = 100;
          finalSize.height = 100;
        }

        const newElement: DiagramElement = {
          id: generateId(),
          type: drawingShape.type,
          position: shapePreview.position,
          size: finalSize,
          text: '',
          color: '#ffffff',
          borderColor: '#333333',
          borderWidth: 2,
          fontSize: 16,
        };

        onElementsChange([...elements, newElement]);
        onSelectElement(newElement.id);
        setDrawingShape(null);
        setShapePreview(null);
      }

      setIsDragging(false);
    },
    [
      isPanning,
      drawingArrow,
      arrowPreviewEnd,
      screenToCanvas,
      snapToGridEnabled,
      gridSize,
      elements,
      onElementsChange,
      findElementAtPosition,
      drawingShape,
      shapePreview,
      onSelectElement,
    ]
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

  // Handle resize start
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, elementId: string, handle: string) => {
      e.stopPropagation();
      if (selectedTool !== 'select' && selectedTool !== null) return;

      onSelectElement(elementId);
      setIsResizing(true);
      setResizeHandle(handle);
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      setDragStart(canvasPos);
    },
    [selectedTool, screenToCanvas, onSelectElement]
  );

  // Handle element dragging and resizing
  useEffect(() => {
    if (!selectedElementId) return;
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);

      if (isDragging) {
        const newPos = {
          x: canvasPos.x - dragStart.x,
          y: canvasPos.y - dragStart.y,
        };

        const finalPos = snapToGridEnabled ? snapToGrid(newPos, gridSize) : newPos;

        // Update the element position
        let updatedElements = elements.map((el) =>
          el.id === selectedElementId ? { ...el, position: finalPos } : el
        );

        // Update connected arrows
        const selectedElement = updatedElements.find((el) => el.id === selectedElementId);
        if (selectedElement && selectedElement.type !== 'arrow') {
          updatedElements = updatedElements.map((el) => {
            if (el.type !== 'arrow') return el;

            if (el.startElementId === selectedElementId || el.endElementId === selectedElementId) {
              const startEl = el.startElementId
                ? updatedElements.find((e) => e.id === el.startElementId)
                : null;
              const endEl = el.endElementId
                ? updatedElements.find((e) => e.id === el.endElementId)
                : null;

              let newStartPoint = el.startPoint!;
              let newEndPoint = el.endPoint!;

              if (startEl && endEl) {
                newStartPoint = getConnectionPoint(startEl, getElementCenter(endEl));
                newEndPoint = getConnectionPoint(endEl, getElementCenter(startEl));
              } else if (startEl) {
                newStartPoint = getConnectionPoint(startEl, el.endPoint!);
              } else if (endEl) {
                newEndPoint = getConnectionPoint(endEl, el.startPoint!);
              }

              return { ...el, startPoint: newStartPoint, endPoint: newEndPoint, position: newStartPoint };
            }
            return el;
          });
        }

        onElementsChange(updatedElements);
      }

      if (isResizing && resizeHandle) {
        const element = elements.find((el) => el.id === selectedElementId);
        if (!element || !element.size) return;

        const pos = snapToGridEnabled ? snapToGrid(canvasPos, gridSize) : canvasPos;
        let newWidth = element.size.width;
        let newHeight = element.size.height;
        let newX = element.position.x;
        let newY = element.position.y;

        const minSize = 20;

        if (resizeHandle.includes('e')) {
          newWidth = Math.max(minSize, pos.x - element.position.x);
        }
        if (resizeHandle.includes('w')) {
          const delta = element.position.x - pos.x;
          newWidth = Math.max(minSize, element.size.width + delta);
          if (newWidth > minSize) {
            newX = pos.x;
          }
        }
        if (resizeHandle.includes('s')) {
          newHeight = Math.max(minSize, pos.y - element.position.y);
        }
        if (resizeHandle.includes('n')) {
          const delta = element.position.y - pos.y;
          newHeight = Math.max(minSize, element.size.height + delta);
          if (newHeight > minSize) {
            newY = pos.y;
          }
        }

        let updatedElements = elements.map((el) =>
          el.id === selectedElementId
            ? { ...el, position: { x: newX, y: newY }, size: { width: newWidth, height: newHeight } }
            : el
        );

        // Update connected arrows after resize
        updatedElements = updatedElements.map((el) => {
          if (el.type !== 'arrow') return el;

          if (el.startElementId === selectedElementId || el.endElementId === selectedElementId) {
            const startEl = el.startElementId
              ? updatedElements.find((e) => e.id === el.startElementId)
              : null;
            const endEl = el.endElementId
              ? updatedElements.find((e) => e.id === el.endElementId)
              : null;

            let newStartPoint = el.startPoint!;
            let newEndPoint = el.endPoint!;

            if (startEl && endEl) {
              newStartPoint = getConnectionPoint(startEl, getElementCenter(endEl));
              newEndPoint = getConnectionPoint(endEl, getElementCenter(startEl));
            } else if (startEl) {
              newStartPoint = getConnectionPoint(startEl, el.endPoint!);
            } else if (endEl) {
              newEndPoint = getConnectionPoint(endEl, el.startPoint!);
            }

            return { ...el, startPoint: newStartPoint, endPoint: newEndPoint, position: newStartPoint };
          }
          return el;
        });

        onElementsChange(updatedElements);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    isDragging,
    isResizing,
    selectedElementId,
    dragStart,
    resizeHandle,
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

  // Render arrow preview while drawing
  const renderArrowPreview = () => {
    if (!drawingArrow || !arrowPreviewEnd) return null;

    const x1 = drawingArrow.start.x * zoom + pan.x;
    const y1 = drawingArrow.start.y * zoom + pan.y;
    const x2 = arrowPreviewEnd.x * zoom + pan.x;
    const y2 = arrowPreviewEnd.y * zoom + pan.y;

    return (
      <svg className={styles.arrowPreview}>
        <defs>
          <marker
            id="arrowhead-preview"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#0070f3" />
          </marker>
        </defs>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#0070f3"
          strokeWidth={2}
          strokeDasharray="5,5"
          markerEnd="url(#arrowhead-preview)"
        />
      </svg>
    );
  };

  // Render SVG shape path based on element type
  const getSvgPath = (type: ElementType, width: number, height: number): string => {
    switch (type) {
      case 'diamond':
        return `M ${width / 2} 0 L ${width} ${height / 2} L ${width / 2} ${height} L 0 ${height / 2} Z`;
      case 'triangle':
        return `M ${width / 2} 0 L ${width} ${height} L 0 ${height} Z`;
      case 'hexagon':
        return `M ${width * 0.25} 0 L ${width * 0.75} 0 L ${width} ${height / 2} L ${width * 0.75} ${height} L ${width * 0.25} ${height} L 0 ${height / 2} Z`;
      case 'star': {
        const cx = width / 2;
        const cy = height / 2;
        const outerR = Math.min(width, height) / 2;
        const innerR = outerR * 0.4;
        const points = [];
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const angle = (Math.PI / 2) + (i * Math.PI / 5);
          points.push(`${cx + r * Math.cos(angle)} ${cy - r * Math.sin(angle)}`);
        }
        return `M ${points.join(' L ')} Z`;
      }
      default:
        return '';
    }
  };

  // Render shape preview while drawing
  const renderShapePreview = () => {
    if (!drawingShape || !shapePreview) return null;

    const width = shapePreview.size.width * zoom;
    const height = shapePreview.size.height * zoom;
    const style: React.CSSProperties = {
      left: shapePreview.position.x * zoom + pan.x,
      top: shapePreview.position.y * zoom + pan.y,
      width,
      height,
    };

    const svgShapes: ElementType[] = ['diamond', 'triangle', 'hexagon', 'star'];
    if (svgShapes.includes(drawingShape.type) && width > 0 && height > 0) {
      const path = getSvgPath(drawingShape.type, width, height);
      return (
        <div className={styles.preview} style={style}>
          <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            <path
              d={path}
              fill="rgba(0, 112, 243, 0.1)"
              stroke="#0070f3"
              strokeWidth={2}
              strokeDasharray="5,5"
            />
          </svg>
        </div>
      );
    }

    return (
      <div
        className={`${styles.preview} ${styles[drawingShape.type]}`}
        style={style}
      />
    );
  };

  // Render resize handles
  const renderResizeHandles = (element: DiagramElement) => {
    if (element.id !== selectedElementId) return null;
    if (element.type === 'arrow' || element.type === 'text') return null;

    const size = element.size || { width: 100, height: 100 };
    const handleSize = 8;
    const handles = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];

    const getHandlePosition = (handle: string) => {
      const pos = { x: 0, y: 0 };
      if (handle.includes('w')) pos.x = 0;
      else if (handle.includes('e')) pos.x = size.width;
      else pos.x = size.width / 2;

      if (handle.includes('n')) pos.y = 0;
      else if (handle.includes('s')) pos.y = size.height;
      else pos.y = size.height / 2;

      return pos;
    };

    const getCursor = (handle: string) => {
      const cursors: Record<string, string> = {
        nw: 'nwse-resize',
        ne: 'nesw-resize',
        sw: 'nesw-resize',
        se: 'nwse-resize',
        n: 'ns-resize',
        s: 'ns-resize',
        e: 'ew-resize',
        w: 'ew-resize',
      };
      return cursors[handle];
    };

    return handles.map((handle) => {
      const handlePos = getHandlePosition(handle);
      return (
        <div
          key={handle}
          className={styles.resizeHandle}
          style={{
            left: handlePos.x - handleSize / 2,
            top: handlePos.y - handleSize / 2,
            width: handleSize,
            height: handleSize,
            cursor: getCursor(handle),
          }}
          onMouseDown={(e) => handleResizeMouseDown(e, element.id, handle)}
        />
      );
    });
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
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onSelectElement(element.id);
            }}
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

    // SVG-based shapes (diamond, triangle, hexagon, star)
    const svgShapes: ElementType[] = ['diamond', 'triangle', 'hexagon', 'star'];
    if (svgShapes.includes(element.type)) {
      const width = element.size?.width || 100;
      const height = element.size?.height || 100;
      const path = getSvgPath(element.type, width, height);

      return (
        <div
          key={element.id}
          className={`${styles.element} ${isSelected ? styles.selected : ''}`}
          style={{
            ...style,
            width,
            height,
          }}
          onMouseDown={(e) => handleElementMouseDown(e, element.id)}
        >
          <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            <path
              d={path}
              fill={element.color || '#ffffff'}
              stroke={element.borderColor || '#333333'}
              strokeWidth={element.borderWidth || 2}
            />
          </svg>
          {element.text && (
            <span style={{ fontSize: element.fontSize, position: 'relative', zIndex: 1 }}>
              {element.text}
            </span>
          )}
          {renderResizeHandles(element)}
        </div>
      );
    }

    // Standard shapes (rectangle, circle)
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
        {renderResizeHandles(element)}
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
        {renderArrowPreview()}
        {renderShapePreview()}
      </div>
    </div>
  );
};
