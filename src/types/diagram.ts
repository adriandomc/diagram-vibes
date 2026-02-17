// Type definitions for diagram elements

export type ElementType = 'text' | 'rectangle' | 'circle' | 'arrow';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface DiagramElement {
  id: string;
  type: ElementType;
  position: Position;
  size?: Size;
  text?: string;
  rotation?: number;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  fontSize?: number;
  // For arrows
  startPoint?: Position;
  endPoint?: Position;
}

export interface CanvasState {
  elements: DiagramElement[];
  selectedElementId: string | null;
  zoom: number;
  pan: Position;
  gridSize: number;
  snapToGrid: boolean;
}
