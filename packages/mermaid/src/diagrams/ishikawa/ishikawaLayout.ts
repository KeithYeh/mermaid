import { lineBreakRegex } from '../common/common.js';
import type {
  IshikawaLabelBox,
  IshikawaLayoutResult,
  IshikawaLayoutSegment,
  IshikawaNode,
  TextMetrics,
  TextStyle,
  WrappedTextMetrics,
} from './ishikawaTypes.js';

export interface IshikawaLayoutConfig {
  angleDeg: number;
  minGap: number;
  categorySpacing: number;
  maxLabelWidth: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
}

export type MeasureText = (text: string, style: TextStyle) => TextMetrics;

const DEFAULT_MAX_ITERATIONS = 12;

const isCjk = (text: string) => /[\u3040-\u30ff\u3400-\u9fff\uF900-\uFAFF]/.test(text);

const splitByLineBreaks = (text: string): string[] => {
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const expanded: string[] = [];
  for (const line of lines) {
    if (lineBreakRegex.test(line)) {
      expanded.push(...line.split(lineBreakRegex));
    } else {
      expanded.push(line);
    }
  }
  return expanded.length ? expanded : [''];
};

const wrapLine = (line: string, maxWidth: number, measureText: MeasureText, style: TextStyle) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return [''];
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const useWordWrap = tokens.length > 1 && !isCjk(trimmed);
  const chunks = useWordWrap ? tokens : [...trimmed];
  const lines: string[] = [];
  let current = '';

  const measure = (value: string) => measureText(value || ' ', style).width;

  for (const chunk of chunks) {
    const candidate = current ? `${current}${useWordWrap ? ' ' : ''}${chunk}` : chunk;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (!current) {
      // chunk itself is too wide, force char wrap
      const chars = [...chunk];
      let charLine = '';
      for (const char of chars) {
        const charCandidate = `${charLine}${char}`;
        if (measure(charCandidate) <= maxWidth || !charLine) {
          charLine = charCandidate;
        } else {
          lines.push(charLine);
          charLine = char;
        }
      }
      if (charLine) {
        lines.push(charLine);
      }
      continue;
    }

    lines.push(current);
    current = chunk;
  }

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : [''];
};

export const wrapText = (
  text: string,
  maxWidth: number,
  measureText: MeasureText,
  style: TextStyle
): WrappedTextMetrics => {
  const lineHeight = measureText('Mg', style).height || style.fontSize * 1.25;
  const lines: string[] = [];
  for (const line of splitByLineBreaks(text)) {
    lines.push(...wrapLine(line, maxWidth, measureText, style));
  }
  const widths = lines.map((line) => measureText(line || ' ', style).width);
  const width = widths.length ? Math.max(...widths) : 0;
  const height = lines.length * lineHeight;
  return { lines, width, height, lineHeight };
};

const bboxOverlap = (a: IshikawaLabelBox, b: IshikawaLabelBox) => {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return xOverlap > 0 && yOverlap > 0;
};

const collectDescendants = (node: IshikawaNode): IshikawaNode[] => {
  const nodes: IshikawaNode[] = [];
  const stack = [...node.children];
  while (stack.length) {
    const current = stack.shift();
    if (!current) {
      continue;
    }
    nodes.push(current);
    if (current.children.length) {
      stack.unshift(...current.children);
    }
  }
  return nodes;
};

const computeStats = (root: IshikawaNode) => {
  let maxDepth = 0;
  let leafCount = 0;
  const walk = (node: IshikawaNode) => {
    maxDepth = Math.max(maxDepth, node.level);
    if (!node.children.length) {
      leafCount += 1;
    }
    node.children.forEach(walk);
  };
  walk(root);
  return { maxDepth, leafCount };
};

const computeBounds = (labels: IshikawaLabelBox[], segments: IshikawaLayoutSegment[]) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const label of labels) {
    minX = Math.min(minX, label.x);
    minY = Math.min(minY, label.y);
    maxX = Math.max(maxX, label.x + label.width);
    maxY = Math.max(maxY, label.y + label.height);
  }

  for (const seg of segments) {
    minX = Math.min(minX, seg.x1, seg.x2);
    minY = Math.min(minY, seg.y1, seg.y2);
    maxX = Math.max(maxX, seg.x1, seg.x2);
    maxY = Math.max(maxY, seg.y1, seg.y2);
  }

  if (!labels.length && !segments.length) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

const lineIntersectsRect = (segment: IshikawaLayoutSegment, rect: IshikawaLabelBox): boolean => {
  const within = (value: number, min: number, max: number) => value >= min && value <= max;
  const inside = (x: number, y: number) =>
    within(x, rect.x, rect.x + rect.width) && within(y, rect.y, rect.y + rect.height);

  if (inside(segment.x1, segment.y1) || inside(segment.x2, segment.y2)) {
    return true;
  }

  const edges = [
    { x1: rect.x, y1: rect.y, x2: rect.x + rect.width, y2: rect.y },
    { x1: rect.x + rect.width, y1: rect.y, x2: rect.x + rect.width, y2: rect.y + rect.height },
    { x1: rect.x + rect.width, y1: rect.y + rect.height, x2: rect.x, y2: rect.y + rect.height },
    { x1: rect.x, y1: rect.y + rect.height, x2: rect.x, y2: rect.y },
  ];

  const intersects = (a: any, b: any) => {
    const det = (a.x2 - a.x1) * (b.y2 - b.y1) - (a.y2 - a.y1) * (b.x2 - b.x1);
    if (det === 0) {
      return false;
    }
    const lambda = ((b.y2 - b.y1) * (b.x2 - a.x1) + (b.x1 - b.x2) * (b.y2 - a.y1)) / det;
    const gamma = ((a.y1 - a.y2) * (b.x2 - a.x1) + (a.x2 - a.x1) * (b.y2 - a.y1)) / det;
    return lambda >= 0 && lambda <= 1 && gamma >= 0 && gamma <= 1;
  };

  return edges.some((edge) => intersects(segment, edge));
};

const createLabelBox = (
  node: IshikawaNode,
  metrics: WrappedTextMetrics,
  x: number,
  y: number,
  side: IshikawaLabelBox['side']
): IshikawaLabelBox => ({
  id: node.id,
  label: node.label,
  x,
  y,
  width: metrics.width,
  height: metrics.height,
  lines: metrics.lines,
  lineHeight: metrics.lineHeight,
  side,
});

const applyOffset = (
  labels: IshikawaLabelBox[],
  segments: IshikawaLayoutSegment[],
  offsetX: number,
  offsetY: number
) => {
  labels.forEach((label) => {
    label.x += offsetX;
    label.y += offsetY;
  });
  segments.forEach((seg) => {
    seg.x1 += offsetX;
    seg.x2 += offsetX;
    seg.y1 += offsetY;
    seg.y2 += offsetY;
  });
};

export const layoutIshikawa = (
  root: IshikawaNode,
  config: IshikawaLayoutConfig,
  measureText: MeasureText
): IshikawaLayoutResult => {
  const angle = (config.angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const categories = root.children;
  const style: TextStyle = {
    fontFamily: config.fontFamily,
    fontSize: config.fontSize,
    fontWeight: config.fontWeight,
  };

  const rootMetrics = wrapText(root.label, config.maxLabelWidth, measureText, style);
  const labels: IshikawaLabelBox[] = [];
  const segments: IshikawaLayoutSegment[] = [];
  const categoryBoxesTop: IshikawaLabelBox[] = [];
  const categoryBoxesBottom: IshikawaLabelBox[] = [];

  const headPadding = config.minGap * 2;
  const headX = 0;
  const headY = 0;

  const rootLabel = createLabelBox(
    root,
    rootMetrics,
    headX + headPadding,
    headY - rootMetrics.height / 2,
    'root'
  );
  labels.push(rootLabel);

  let currentX = headX;

  const buildCategory = (
    node: IshikawaNode,
    side: 'top' | 'bottom',
    attachX: number,
    iteration: number
  ) => {
    const boneDir = { x: -cos, y: side === 'top' ? -sin : sin };
    const outwardDir = { x: sin, y: side === 'top' ? -cos : cos };

    const descendants = collectDescendants(node);
    const branchSpacing = Math.max(config.fontSize * 1.6, config.minGap + 4);
    const branchStart = config.minGap * 2;
    const baseBoneLength = Math.max(
      config.categorySpacing,
      branchStart + descendants.length * branchSpacing
    );
    const boneLength = baseBoneLength + iteration * config.minGap * 2;

    const categoryMetrics = wrapText(node.label, config.maxLabelWidth, measureText, style);
    const boneEnd = {
      x: attachX + boneDir.x * boneLength,
      y: headY + boneDir.y * boneLength,
    };

    const categoryLabelGap = config.minGap * 3;
    const labelX = boneEnd.x - categoryMetrics.width - config.minGap;
    const labelY =
      side === 'top'
        ? boneEnd.y - categoryMetrics.height - categoryLabelGap
        : boneEnd.y + categoryLabelGap;
    const categoryLabel = createLabelBox(node, categoryMetrics, labelX, labelY, side);

    const localLabels: IshikawaLabelBox[] = [categoryLabel];
    const localSegments: IshikawaLayoutSegment[] = [
      {
        id: `bone-${node.id}`,
        x1: attachX,
        y1: headY,
        x2: boneEnd.x,
        y2: boneEnd.y,
        kind: 'bone',
        ownerId: node.id,
      },
    ];
    const childEntries: { label: IshikawaLabelBox; segment: IshikawaLayoutSegment }[] = [];

    descendants.forEach((child, index) => {
      const depth = child.level;
      const offset = branchStart + index * branchSpacing + (depth - 2) * branchSpacing * 0.4;
      const bonePoint = {
        x: attachX + boneDir.x * offset,
        y: headY + boneDir.y * offset,
      };
      const leaderLength = config.minGap * 2 + (depth - 1) * (config.minGap * 0.6);
      const leaderEnd = {
        x: bonePoint.x + outwardDir.x * leaderLength,
        y: bonePoint.y + outwardDir.y * leaderLength,
      };
      const labelOffset = config.minGap * 4 + index * config.minGap * 2;
      const labelAnchor = {
        x: bonePoint.x + outwardDir.x * (leaderLength + labelOffset),
        y: bonePoint.y + outwardDir.y * (leaderLength + labelOffset),
      };
      const childMetrics = wrapText(child.label, config.maxLabelWidth, measureText, style);
      const childLabelX = labelAnchor.x + config.minGap * 0.5;
      const stagger = 0;
      const childLabelY =
        side === 'top'
          ? labelAnchor.y - childMetrics.height - config.minGap * 0.25 - stagger
          : labelAnchor.y + config.minGap * 0.25 + stagger;

      const leaderSegment: IshikawaLayoutSegment = {
        id: `leader-${node.id}-${child.id}`,
        x1: bonePoint.x,
        y1: bonePoint.y,
        x2: leaderEnd.x,
        y2: leaderEnd.y,
        kind: 'leader',
        ownerId: child.id,
      };

      localSegments.push(leaderSegment);
      const childLabel = createLabelBox(child, childMetrics, childLabelX, childLabelY, side);
      localLabels.push(childLabel);
      childEntries.push({ label: childLabel, segment: leaderSegment });
    });

    const separateChildLabels = () => {
      if (childEntries.length <= 1) {
        return;
      }
      if (side === 'top') {
        const ordered = [...childEntries].sort((a, b) => b.label.y - a.label.y);
        for (let i = 1; i < ordered.length; i += 1) {
          const prev = ordered[i - 1].label;
          const current = ordered[i].label;
          const desiredY = prev.y - config.minGap - current.height;
          if (current.y > desiredY) {
            const deltaY = current.y - desiredY;
            const distance = deltaY / Math.abs(outwardDir.y || 1);
            current.x += outwardDir.x * distance;
            current.y += outwardDir.y * distance;
          }
        }
      } else {
        const ordered = [...childEntries].sort((a, b) => a.label.y - b.label.y);
        for (let i = 1; i < ordered.length; i += 1) {
          const prev = ordered[i - 1].label;
          const current = ordered[i].label;
          const desiredY = prev.y + prev.height + config.minGap;
          if (current.y < desiredY) {
            const deltaY = desiredY - current.y;
            const distance = deltaY / Math.abs(outwardDir.y || 1);
            current.x += outwardDir.x * distance;
            current.y += outwardDir.y * distance;
          }
        }
      }
    };

    separateChildLabels();

    const boneSegment = localSegments[0];
    childEntries.forEach((entry) => {
      let guard = 0;
      while (lineIntersectsRect(boneSegment, entry.label) && guard < DEFAULT_MAX_ITERATIONS) {
        const distance = config.minGap / Math.abs(outwardDir.y || 1);
        entry.label.x += outwardDir.x * distance;
        entry.label.y += outwardDir.y * distance;
        guard += 1;
      }
    });

    childEntries.forEach((entry) => {
      let guard = 0;
      while (
        localSegments.some(
          (segment) =>
            segment.ownerId !== entry.label.id && lineIntersectsRect(segment, entry.label)
        ) &&
        guard < DEFAULT_MAX_ITERATIONS
      ) {
        const distance = config.minGap / Math.abs(outwardDir.y || 1);
        entry.label.x += outwardDir.x * distance;
        entry.label.y += outwardDir.y * distance;
        guard += 1;
      }
    });

    separateChildLabels();

    if (localLabels.length > 1) {
      const childLabels = localLabels.slice(1);
      if (side === 'top') {
        const minChildY = Math.min(...childLabels.map((label) => label.y));
        const overlapGap = categoryLabel.y + categoryLabel.height + config.minGap - minChildY;
        if (overlapGap > 0) {
          categoryLabel.y -= overlapGap;
        }
      } else {
        const maxChildY = Math.max(...childLabels.map((label) => label.y + label.height));
        const overlapGap = maxChildY + config.minGap - categoryLabel.y;
        if (overlapGap > 0) {
          categoryLabel.y += overlapGap;
        }
      }
    }

    return { localLabels, localSegments };
  };

  categories.forEach((category, index) => {
    const side: 'top' | 'bottom' = index % 2 === 0 ? 'top' : 'bottom';
    const sideBoxes = side === 'top' ? categoryBoxesTop : categoryBoxesBottom;
    let attachX = currentX - config.categorySpacing;
    let attempt = 0;
    let layoutResult = buildCategory(category, side, attachX, attempt);

    const resolveOverlaps = () => {
      let needsShift = false;
      let shift = 0;
      for (const label of layoutResult.localLabels) {
        for (const existing of sideBoxes) {
          if (!bboxOverlap(label, existing)) {
            continue;
          }
          const required = existing.x + existing.width - label.x + config.minGap;
          if (required > shift) {
            shift = required;
          }
          needsShift = true;
        }
        for (const segment of segments) {
          if (lineIntersectsRect(segment, label)) {
            needsShift = true;
            shift = Math.max(shift, config.minGap * 2);
          }
        }
      }
      if (needsShift) {
        attachX -= shift;
      }
      return needsShift;
    };

    let iterations = 0;
    while (iterations < DEFAULT_MAX_ITERATIONS) {
      layoutResult = buildCategory(category, side, attachX, attempt);
      const overlapped = resolveOverlaps();
      if (!overlapped) {
        break;
      }
      attempt += 1;
      iterations += 1;
    }

    labels.push(...layoutResult.localLabels);
    segments.push(...layoutResult.localSegments);
    sideBoxes.push(...layoutResult.localLabels);
    currentX = attachX;
  });

  const spineEnd = currentX - config.categorySpacing;
  segments.push({
    id: 'spine',
    x1: spineEnd,
    y1: headY,
    x2: headX,
    y2: headY,
    kind: 'spine',
  });

  let bounds = computeBounds(labels, segments);
  const pad = config.minGap * 2;
  const offsetX = -bounds.minX + pad;
  const offsetY = -bounds.minY + pad;
  applyOffset(labels, segments, offsetX, offsetY);
  bounds = computeBounds(labels, segments);
  bounds = {
    minX: 0,
    minY: 0,
    maxX: bounds.maxX,
    maxY: bounds.maxY,
    width: bounds.maxX,
    height: bounds.maxY,
  };

  const stats = computeStats(root);
  return {
    labels,
    segments,
    bounds,
    stats: {
      maxDepth: stats.maxDepth,
      categoryCount: categories.length,
      leafCount: stats.leafCount,
    },
    config: {
      angleDeg: config.angleDeg,
      minGap: config.minGap,
      categorySpacing: config.categorySpacing,
      maxLabelWidth: config.maxLabelWidth,
      fontSize: config.fontSize,
    },
  };
};
