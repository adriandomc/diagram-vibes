import React, { useState } from 'react';
import { 
  Type, 
  Square, 
  Circle, 
  ArrowRight, 
  Move, 
  ZoomIn, 
  ZoomOut,
  Grid3x3,
  Trash2,
  Diamond,
  Triangle,
  Hexagon,
  Star,
  RectangleHorizontal,
  Database,
  Cloud,
  MessageSquare,
  Plus,
  Box,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { ElementType } from '@/types/diagram';
import styles from './Toolbar.module.scss';

export interface ToolbarProps {
  selectedTool: ElementType | 'select' | null;
  onToolSelect: (tool: ElementType | 'select') => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleGrid: () => void;
  onClear: () => void;
  gridEnabled: boolean;
}

// Custom SVG icons for shapes not in lucide-react
const EllipseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="12" rx="10" ry="6" />
  </svg>
);

const ParallelogramIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 4h14l-4 16H2l4-16z" />
  </svg>
);

const CylinderIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
    <ellipse cx="12" cy="19" rx="8" ry="3" />
  </svg>
);

const DocumentIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h16v14c0 0-4 4-8 2s-8-2-8-2V4z" />
  </svg>
);

const CubeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
    <path d="M2 7v10" />
    <path d="M22 7v10" />
    <path d="M12 12v10" />
  </svg>
);

export const Toolbar: React.FC<ToolbarProps> = ({
  selectedTool,
  onToolSelect,
  onZoomIn,
  onZoomOut,
  onToggleGrid,
  onClear,
  gridEnabled,
}) => {
  const [showMoreShapes, setShowMoreShapes] = useState(false);

  return (
    <div className={styles.toolbar}>
      {/* Selection and Text */}
      <div className={styles.toolGroup}>
        <Button
          variant="icon"
          active={selectedTool === 'select'}
          onClick={() => onToolSelect('select')}
          title="Select (V)"
        >
          <Move />
        </Button>
        <Button
          variant="icon"
          active={selectedTool === 'text'}
          onClick={() => onToolSelect('text')}
          title="Text (T)"
        >
          <Type />
        </Button>
      </div>

      <div className={styles.divider} />

      {/* Basic Shapes */}
      <div className={styles.toolGroup}>
        <Button
          variant="icon"
          active={selectedTool === 'rectangle'}
          onClick={() => onToolSelect('rectangle')}
          title="Rectangle (R)"
        >
          <Square />
        </Button>
        <Button
          variant="icon"
          active={selectedTool === 'roundedRect'}
          onClick={() => onToolSelect('roundedRect')}
          title="Rounded Rectangle"
        >
          <RectangleHorizontal />
        </Button>
        <Button
          variant="icon"
          active={selectedTool === 'circle'}
          onClick={() => onToolSelect('circle')}
          title="Circle (C)"
        >
          <Circle />
        </Button>
        <Button
          variant="icon"
          active={selectedTool === 'ellipse'}
          onClick={() => onToolSelect('ellipse')}
          title="Ellipse"
        >
          <EllipseIcon />
        </Button>
        <Button
          variant="icon"
          active={selectedTool === 'diamond'}
          onClick={() => onToolSelect('diamond')}
          title="Diamond (D)"
        >
          <Diamond />
        </Button>
        <Button
          variant="icon"
          active={selectedTool === 'triangle'}
          onClick={() => onToolSelect('triangle')}
          title="Triangle (I)"
        >
          <Triangle />
        </Button>
      </div>

      <div className={styles.divider} />

      {/* Arrows */}
      <div className={styles.toolGroup}>
        <Button
          variant="icon"
          active={selectedTool === 'arrow'}
          onClick={() => onToolSelect('arrow')}
          title="Arrow (A)"
        >
          <ArrowRight />
        </Button>
        <Button
          variant="icon"
          active={selectedTool === 'doubleArrow'}
          onClick={() => onToolSelect('doubleArrow')}
          title="Double Arrow"
        >
          <ArrowLeftRight />
        </Button>
      </div>

      <div className={styles.divider} />

      {/* More Shapes Toggle */}
      <div className={styles.toolGroup}>
        <Button
          variant="icon"
          onClick={() => setShowMoreShapes(!showMoreShapes)}
          title={showMoreShapes ? 'Hide More Shapes' : 'Show More Shapes'}
          active={showMoreShapes}
        >
          {showMoreShapes ? <ChevronUp /> : <ChevronDown />}
        </Button>
      </div>

      {/* Extended Shapes (Flowchart, etc.) */}
      {showMoreShapes && (
        <>
          <div className={styles.divider} />
          <div className={styles.toolGroup}>
            <Button
              variant="icon"
              active={selectedTool === 'parallelogram'}
              onClick={() => onToolSelect('parallelogram')}
              title="Parallelogram (Input/Output)"
            >
              <ParallelogramIcon />
            </Button>
            <Button
              variant="icon"
              active={selectedTool === 'hexagon'}
              onClick={() => onToolSelect('hexagon')}
              title="Hexagon (H)"
            >
              <Hexagon />
            </Button>
            <Button
              variant="icon"
              active={selectedTool === 'star'}
              onClick={() => onToolSelect('star')}
              title="Star (S)"
            >
              <Star />
            </Button>
            <Button
              variant="icon"
              active={selectedTool === 'cylinder'}
              onClick={() => onToolSelect('cylinder')}
              title="Cylinder"
            >
              <CylinderIcon />
            </Button>
            <Button
              variant="icon"
              active={selectedTool === 'database'}
              onClick={() => onToolSelect('database')}
              title="Database"
            >
              <Database />
            </Button>
            <Button
              variant="icon"
              active={selectedTool === 'document'}
              onClick={() => onToolSelect('document')}
              title="Document"
            >
              <DocumentIcon />
            </Button>
            <Button
              variant="icon"
              active={selectedTool === 'cloud'}
              onClick={() => onToolSelect('cloud')}
              title="Cloud"
            >
              <Cloud />
            </Button>
            <Button
              variant="icon"
              active={selectedTool === 'callout'}
              onClick={() => onToolSelect('callout')}
              title="Callout"
            >
              <MessageSquare />
            </Button>
            <Button
              variant="icon"
              active={selectedTool === 'plus'}
              onClick={() => onToolSelect('plus')}
              title="Plus"
            >
              <Plus />
            </Button>
            <Button
              variant="icon"
              active={selectedTool === 'cube'}
              onClick={() => onToolSelect('cube')}
              title="Cube"
            >
              <CubeIcon />
            </Button>
          </div>
        </>
      )}

      <div className={styles.divider} />

      {/* Zoom and Grid */}
      <div className={styles.toolGroup}>
        <Button
          variant="icon"
          onClick={onZoomIn}
          title="Zoom In (+)"
        >
          <ZoomIn />
        </Button>
        <Button
          variant="icon"
          onClick={onZoomOut}
          title="Zoom Out (-)"
        >
          <ZoomOut />
        </Button>
        <Button
          variant="icon"
          active={gridEnabled}
          onClick={onToggleGrid}
          title="Toggle Grid (G)"
        >
          <Grid3x3 />
        </Button>
      </div>

      <div className={styles.divider} />

      {/* Clear */}
      <div className={styles.toolGroup}>
        <Button
          variant="icon"
          onClick={onClear}
          title="Clear All"
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
};
