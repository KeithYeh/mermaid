export interface IshikawaNode {
  id: string;
  label: string;
  level: number;
  children: IshikawaNode[];
  isRoot?: boolean;
  class?: string;
  icon?: string;
}

export interface TextStyle {
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
}

export interface TextMetrics {
  width: number;
  height: number;
  lineHeight: number;
}

export interface WrappedTextMetrics extends TextMetrics {
  lines: string[];
}

export interface IshikawaLabelBox {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lines: string[];
  lineHeight: number;
  side: 'top' | 'bottom' | 'root';
}

export interface IshikawaLayoutSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: 'spine' | 'bone' | 'leader';
  ownerId?: string;
}

export interface IshikawaLayoutResult {
  labels: IshikawaLabelBox[];
  segments: IshikawaLayoutSegment[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  stats: {
    maxDepth: number;
    categoryCount: number;
    leafCount: number;
  };
  config: {
    angleDeg: number;
    minGap: number;
    categorySpacing: number;
    maxLabelWidth: number;
    fontSize: number;
  };
}
