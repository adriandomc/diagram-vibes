import React from 'react';
import { 
  Type, 
  Square, 
  Circle, 
  ArrowRight, 
  Move, 
  ZoomIn, 
  ZoomOut,
  Grid3x3,
  Trash2
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

export const Toolbar: React.FC<ToolbarProps> = ({
  selectedTool,
  onToolSelect,
  onZoomIn,
  onZoomOut,
  onToggleGrid,
  onClear,
  gridEnabled,
}) => {
  return (
    <div className={styles.toolbar}>
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
          active={selectedTool === 'circle'}
          onClick={() => onToolSelect('circle')}
          title="Circle (C)"
        >
          <Circle />
        </Button>
        <Button
          variant="icon"
          active={selectedTool === 'arrow'}
          onClick={() => onToolSelect('arrow')}
          title="Arrow (A)"
        >
          <ArrowRight />
        </Button>
      </div>

      <div className={styles.divider} />

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
