'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { DiagramElement, Position, ElementType, Size } from '@/types/diagram';
import { snapToGrid, generateId, distance } from '@/utils/helpers';
import styles from './Canvas.module.scss';

export interface CanvasProps {
  elements: DiagramElement[];
  selectedElementId: string | null;
  selectedTool: ElementType | 'select' | null;
  zoom: number;
  pan: Position;
  gridSize: number;
  snapToGridEnabled: boolean;
  showGrid: boolean;
  onElementsChange: (elements: DiagramElement[]) => void;
  onSelectElement: (id: string | null) => void;
  onPanChange: (pan: Position) => void;
}

// Minimum distance for arrow creation (in canvas units)
const MIN_ARROW_DISTANCE = 20;

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

// Helper to update arrow endpoints when a connected element changes
const updateArrowsForElement = (
  elements: DiagramElement[],
  elementId: string
): DiagramElement[] => {
  return elements.map((el) => {
    if (el.type !== 'arrow') return el;

    if (el.startElementId === elementId || el.endElementId === elementId) {
      const startEl = el.startElementId
        ? elements.find((e) => e.id === el.startElementId)
        : null;
      const endEl = el.endElementId
        ? elements.find((e) => e.id === el.endElementId)
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
};

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  selectedElementId,
  selectedTool,
  zoom,
  pan,
  gridSize,
  snapToGridEnabled,
  showGrid,
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
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Track canvas size for grid rendering
  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasRef.current) {
        setCanvasSize({
          width: canvasRef.current.clientWidth,
          height: canvasRef.current.clientHeight,
        });
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

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

      if (selectedTool === 'arrow' || selectedTool === 'doubleArrow') {
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
        
        // Check minimum distance - don't create arrow if it's too short (prevents single-click arrows)
        const arrowDistance = distance(drawingArrow.start, endPos);
        if (arrowDistance < MIN_ARROW_DISTANCE) {
          setDrawingArrow(null);
          setArrowPreviewEnd(null);
          return;
        }
        
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

        // Use the selectedTool to determine arrow type
        const arrowType = selectedTool === 'doubleArrow' ? 'doubleArrow' : 'arrow';

        const newArrow: DiagramElement = {
          id: generateId(),
          type: arrowType,
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
          updatedElements = updateArrowsForElement(updatedElements, selectedElementId);
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
        updatedElements = updateArrowsForElement(updatedElements, selectedElementId);

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

  // Handle double click to edit text on shapes
  const handleElementDoubleClick = useCallback(
    (e: React.MouseEvent, elementId: string) => {
      e.stopPropagation();
      const element = elements.find((el) => el.id === elementId);
      if (element && element.type !== 'arrow') {
        setEditingElementId(elementId);
      }
    },
    [elements]
  );

  // Render grid using tracked canvas size
  const renderGrid = () => {
    if (canvasSize.width === 0 || canvasSize.height === 0) return null;
    const { width, height } = canvasSize;

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
        const startAngle = Math.PI / 2;
        const angleStep = Math.PI / 5;
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const angle = startAngle + (i * angleStep);
          points.push(`${cx + r * Math.cos(angle)} ${cy - r * Math.sin(angle)}`);
        }
        return `M ${points.join(' L ')} Z`;
      }
      case 'parallelogram':
        return `M ${width * 0.2} 0 L ${width} 0 L ${width * 0.8} ${height} L 0 ${height} Z`;
      case 'document': {
        const waveHeight = height * 0.1;
        return `M 0 0 L ${width} 0 L ${width} ${height - waveHeight} Q ${width * 0.75} ${height - waveHeight * 2}, ${width * 0.5} ${height - waveHeight} Q ${width * 0.25} ${height}, 0 ${height - waveHeight} Z`;
      }
      case 'cylinder': {
        const ellipseHeight = height * 0.15;
        return `M 0 ${ellipseHeight} A ${width / 2} ${ellipseHeight} 0 0 1 ${width} ${ellipseHeight} L ${width} ${height - ellipseHeight} A ${width / 2} ${ellipseHeight} 0 0 1 0 ${height - ellipseHeight} Z`;
      }
      case 'cloud': {
        return `M ${width * 0.25} ${height * 0.6} 
                C ${width * 0.1} ${height * 0.6}, ${width * 0.05} ${height * 0.45}, ${width * 0.15} ${height * 0.35}
                C ${width * 0.1} ${height * 0.2}, ${width * 0.25} ${height * 0.1}, ${width * 0.4} ${height * 0.15}
                C ${width * 0.45} ${height * 0.05}, ${width * 0.65} ${height * 0.05}, ${width * 0.7} ${height * 0.15}
                C ${width * 0.85} ${height * 0.1}, ${width * 0.95} ${height * 0.25}, ${width * 0.9} ${height * 0.4}
                C ${width * 0.98} ${height * 0.5}, ${width * 0.95} ${height * 0.65}, ${width * 0.8} ${height * 0.7}
                C ${width * 0.85} ${height * 0.85}, ${width * 0.7} ${height * 0.95}, ${width * 0.55} ${height * 0.85}
                C ${width * 0.45} ${height * 0.95}, ${width * 0.3} ${height * 0.9}, ${width * 0.25} ${height * 0.75}
                C ${width * 0.1} ${height * 0.75}, ${width * 0.05} ${height * 0.65}, ${width * 0.15} ${height * 0.6}
                Z`;
      }
      case 'callout': {
        const tailSize = Math.min(width, height) * 0.15;
        return `M 0 0 L ${width} 0 L ${width} ${height - tailSize} L ${width * 0.3} ${height - tailSize} L ${width * 0.15} ${height} L ${width * 0.2} ${height - tailSize} L 0 ${height - tailSize} Z`;
      }
      case 'plus': {
        const armWidth = width * 0.3;
        const armStart = (width - armWidth) / 2;
        const armEnd = armStart + armWidth;
        const armStartV = (height - armWidth * (height / width)) / 2;
        const armEndV = armStartV + armWidth * (height / width);
        return `M ${armStart} 0 L ${armEnd} 0 L ${armEnd} ${armStartV} L ${width} ${armStartV} L ${width} ${armEndV} L ${armEnd} ${armEndV} L ${armEnd} ${height} L ${armStart} ${height} L ${armStart} ${armEndV} L 0 ${armEndV} L 0 ${armStartV} L ${armStart} ${armStartV} Z`;
      }
      case 'database': {
        const ellipseH = height * 0.12;
        return `M 0 ${ellipseH} A ${width / 2} ${ellipseH} 0 0 0 ${width} ${ellipseH} L ${width} ${height - ellipseH} A ${width / 2} ${ellipseH} 0 0 1 0 ${height - ellipseH} Z`;
      }
      case 'cube': {
        const depth = Math.min(width, height) * 0.25;
        return `M 0 ${depth} L ${width - depth} ${depth} L ${width - depth} ${height} L 0 ${height} Z 
                M 0 ${depth} L ${depth} 0 L ${width} 0 L ${width - depth} ${depth} Z 
                M ${width - depth} ${depth} L ${width} 0 L ${width} ${height - depth} L ${width - depth} ${height} Z`;
      }
      default:
        return '';
    }
  };

  // Check if element type is an SVG-based shape
  const isSvgShape = (type: ElementType): boolean => {
    return ['diamond', 'triangle', 'hexagon', 'star', 'parallelogram', 'document', 
            'cylinder', 'cloud', 'callout', 'plus', 'database', 'cube'].includes(type);
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

    if (isSvgShape(drawingShape.type) && width > 0 && height > 0) {
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

  // Check if the currently selected element is an arrow type
  const isArrowSelected = (): boolean => {
    if (!selectedElementId) return false;
    const selectedElement = elements.find(el => el.id === selectedElementId);
    return selectedElement?.type === 'arrow' || selectedElement?.type === 'doubleArrow';
  };

  // Render connection handles when arrow is selected (for connecting shapes)
  const renderConnectionHandles = (element: DiagramElement) => {
    if (!isArrowSelected()) return null;
    if (element.type === 'arrow' || element.type === 'doubleArrow' || element.type === 'text') return null;
    if (element.id === selectedElementId) return null;

    const size = element.size || { width: 100, height: 100 };
    const handleSize = 20;
    const handles = [
      { direction: 'top', x: size.width / 2, y: 0 },
      { direction: 'right', x: size.width, y: size.height / 2 },
      { direction: 'bottom', x: size.width / 2, y: size.height },
      { direction: 'left', x: 0, y: size.height / 2 },
    ];

    return handles.map((handle) => (
      <div
        key={handle.direction}
        className={styles.connectionHandle}
        style={{
          left: handle.x - handleSize / 2,
          top: handle.y - handleSize / 2,
          width: handleSize,
          height: handleSize,
        }}
        title={`Connect ${handle.direction}`}
      >
        <svg width={handleSize} height={handleSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {handle.direction === 'top' && <path d="M12 19V5M5 12l7-7 7 7" />}
          {handle.direction === 'right' && <path d="M5 12h14M12 5l7 7-7 7" />}
          {handle.direction === 'bottom' && <path d="M12 5v14M19 12l-7 7-7-7" />}
          {handle.direction === 'left' && <path d="M19 12H5M12 19l-7-7 7-7" />}
        </svg>
      </div>
    ));
  };

  // Render resize handles
  const renderResizeHandles = (element: DiagramElement) => {
    if (element.id !== selectedElementId) return null;
    if (element.type === 'arrow' || element.type === 'doubleArrow' || element.type === 'text') return null;
    // Don't show resize handles when an arrow is selected (show connection handles instead)
    if (isArrowSelected() && element.id !== selectedElementId) return null;

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

    // Single and double arrows
    if ((element.type === 'arrow' || element.type === 'doubleArrow') && element.startPoint && element.endPoint) {
      const x1 = element.startPoint.x * zoom + pan.x;
      const y1 = element.startPoint.y * zoom + pan.y;
      const x2 = element.endPoint.x * zoom + pan.x;
      const y2 = element.endPoint.y * zoom + pan.y;
      const isDoubleArrow = element.type === 'doubleArrow';

      return (
        <svg
          key={element.id}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <defs>
            <marker
              id={`arrowhead-end-${element.id}`}
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill={isSelected ? '#0070f3' : element.color || '#333333'} />
            </marker>
            {isDoubleArrow && (
              <marker
                id={`arrowhead-start-${element.id}`}
                markerWidth="10"
                markerHeight="10"
                refX="1"
                refY="3"
                orient="auto"
              >
                <polygon points="10 0, 0 3, 10 6" fill={isSelected ? '#0070f3' : element.color || '#333333'} />
              </marker>
            )}
          </defs>
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isSelected ? '#0070f3' : element.color || '#333333'}
            strokeWidth={element.borderWidth || 2}
            markerEnd={`url(#arrowhead-end-${element.id})`}
            markerStart={isDoubleArrow ? `url(#arrowhead-start-${element.id})` : undefined}
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

    // SVG-based shapes
    if (isSvgShape(element.type)) {
      const width = element.size?.width || 100;
      const height = element.size?.height || 100;
      const path = getSvgPath(element.type, width, height);
      const isEditing = editingElementId === element.id;

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
          onDoubleClick={(e) => handleElementDoubleClick(e, element.id)}
        >
          <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            <path
              d={path}
              fill={element.color || '#ffffff'}
              stroke={element.borderColor || '#333333'}
              strokeWidth={element.borderWidth || 2}
              fillRule="evenodd"
            />
          </svg>
          {isEditing ? (
            <textarea
              className={styles.shapeTextInput}
              value={element.text || ''}
              onChange={(e) => handleTextChange(element.id, e.target.value)}
              onBlur={() => setEditingElementId(null)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditingElementId(null);
              }}
              style={{ fontSize: element.fontSize }}
              autoFocus
              placeholder="Enter text..."
            />
          ) : (
            <span className={styles.shapeText} style={{ fontSize: element.fontSize }}>
              {element.text || ''}
            </span>
          )}
          {renderResizeHandles(element)}
          {renderConnectionHandles(element)}
        </div>
      );
    }

    // Ellipse shape
    if (element.type === 'ellipse') {
      const width = element.size?.width || 100;
      const height = element.size?.height || 100;
      const isEditing = editingElementId === element.id;

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
          onDoubleClick={(e) => handleElementDoubleClick(e, element.id)}
        >
          <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            <ellipse
              cx={width / 2}
              cy={height / 2}
              rx={width / 2 - 1}
              ry={height / 2 - 1}
              fill={element.color || '#ffffff'}
              stroke={element.borderColor || '#333333'}
              strokeWidth={element.borderWidth || 2}
            />
          </svg>
          {isEditing ? (
            <textarea
              className={styles.shapeTextInput}
              value={element.text || ''}
              onChange={(e) => handleTextChange(element.id, e.target.value)}
              onBlur={() => setEditingElementId(null)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditingElementId(null);
              }}
              style={{ fontSize: element.fontSize }}
              autoFocus
              placeholder="Enter text..."
            />
          ) : (
            <span className={styles.shapeText} style={{ fontSize: element.fontSize }}>
              {element.text || ''}
            </span>
          )}
          {renderResizeHandles(element)}
          {renderConnectionHandles(element)}
        </div>
      );
    }

    // Standard shapes (rectangle, circle, roundedRect)
    const shapeStyle: React.CSSProperties = {
      width: element.size?.width,
      height: element.size?.height,
      background: element.color,
      borderColor: element.borderColor,
      borderWidth: element.borderWidth,
    };

    const isEditing = editingElementId === element.id;

    return (
      <div
        key={element.id}
        className={`${styles.element} ${styles[element.type]} ${isSelected ? styles.selected : ''}`}
        style={{ ...style, ...shapeStyle }}
        onMouseDown={(e) => handleElementMouseDown(e, element.id)}
        onDoubleClick={(e) => handleElementDoubleClick(e, element.id)}
      >
        {isEditing ? (
          <textarea
            className={styles.shapeTextInput}
            value={element.text || ''}
            onChange={(e) => handleTextChange(element.id, e.target.value)}
            onBlur={() => setEditingElementId(null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditingElementId(null);
            }}
            style={{ fontSize: element.fontSize }}
            autoFocus
            placeholder="Enter text..."
          />
        ) : (
          <span className={styles.shapeText} style={{ fontSize: element.fontSize }}>
            {element.text || ''}
          </span>
        )}
        {renderResizeHandles(element)}
        {renderConnectionHandles(element)}
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
      {showGrid && renderGrid()}
      <div className={styles.viewport}>
        {elements.map((element) => renderElement(element))}
        {renderArrowPreview()}
        {renderShapePreview()}
      </div>
    </div>
  );
};
