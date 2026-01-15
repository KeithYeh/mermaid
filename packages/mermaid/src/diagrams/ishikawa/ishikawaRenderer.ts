import { select } from 'd3';
import { getConfig } from '../../diagram-api/diagramAPI.js';
import { log } from '../../logger.js';
import { configureSvgSize } from '../../setupGraphViewbox.js';
import type { Diagram } from '../../Diagram.js';
import { calculateTextDimensions } from '../../utils.js';
import { layoutIshikawa } from './ishikawaLayout.js';
import type { IshikawaDB } from './ishikawaDb.js';
import type { IshikawaLabelBox, IshikawaLayoutSegment, TextStyle } from './ishikawaTypes.js';

const defaultConfig = {
  angleDeg: 35,
  minGap: 12,
  categorySpacing: 120,
  maxLabelWidth: 160,
  fontSize: 14,
};

export const draw = (text: string, id: string, _version: string, diagObj: Diagram) => {
  log.debug('Rendering ishikawa diagram\n' + text);

  const conf = getConfig();
  const diagramDb = diagObj.db as IshikawaDB;
  const root = diagramDb.getRoot();
  if (!root) {
    return;
  }

  const ishikawaConfig = {
    angleDeg: conf.ishikawa?.angleDeg ?? defaultConfig.angleDeg,
    minGap: conf.ishikawa?.minGap ?? defaultConfig.minGap,
    categorySpacing: conf.ishikawa?.categorySpacing ?? defaultConfig.categorySpacing,
    maxLabelWidth: conf.ishikawa?.maxLabelWidth ?? defaultConfig.maxLabelWidth,
    fontSize: conf.ishikawa?.fontSize ?? conf.fontSize ?? defaultConfig.fontSize,
    fontFamily: conf.fontFamily ?? 'Arial',
    fontWeight: 400,
  };

  const measureText = (value: string, style: TextStyle) => {
    const dimensions = calculateTextDimensions(value, style);
    return {
      width: dimensions.width,
      height: dimensions.height,
      lineHeight: dimensions.lineHeight ?? style.fontSize,
    };
  };

  const layout = layoutIshikawa(root, ishikawaConfig, measureText);

  const securityLevel = conf.securityLevel;
  const sandboxElement =
    securityLevel === 'sandbox' ? select<HTMLIFrameElement, unknown>(`#i${id}`) : null;
  const sandboxBody = sandboxElement?.node()?.contentDocument?.body;
  const rootNode = securityLevel === 'sandbox' && sandboxBody ? sandboxBody : document.body;
  const rootElement = select(rootNode);

  const svg = rootElement.select<SVGSVGElement>(`[id="${id}"]`);
  const group = svg.append('g').attr('class', 'ishikawa');

  configureSvgSize(
    svg,
    layout.bounds.height,
    layout.bounds.width,
    conf.ishikawa?.useMaxWidth ?? true
  );
  svg.attr('viewBox', `0 0 ${layout.bounds.width} ${layout.bounds.height}`);

  const spineSegment = layout.segments.find((segment) => segment.id === 'spine');
  if (spineSegment) {
    group
      .append('circle')
      .attr('class', 'ishikawa-head')
      .attr('cx', spineSegment.x2)
      .attr('cy', spineSegment.y2)
      .attr('r', ishikawaConfig.minGap / 2);
  }

  group
    .append('g')
    .attr('class', 'ishikawa-segments')
    .selectAll<SVGLineElement, IshikawaLayoutSegment>('line')
    .data(layout.segments)
    .enter()
    .append('line')
    .attr('x1', (d: IshikawaLayoutSegment) => d.x1)
    .attr('y1', (d: IshikawaLayoutSegment) => d.y1)
    .attr('x2', (d: IshikawaLayoutSegment) => d.x2)
    .attr('y2', (d: IshikawaLayoutSegment) => d.y2)
    .attr('class', (d: IshikawaLayoutSegment) => `ishikawa-segment ishikawa-${d.kind}`);

  const labelGroup = group.append('g').attr('class', 'ishikawa-labels');

  const labels = labelGroup
    .selectAll<SVGTextElement, IshikawaLabelBox>('text')
    .data(layout.labels)
    .enter()
    .append('text')
    .attr('x', (d: IshikawaLabelBox) => d.x)
    .attr('y', (d: IshikawaLabelBox) => d.y + d.lineHeight)
    .attr('class', (d: IshikawaLabelBox) => `ishikawa-label ishikawa-label-${d.side}`)
    .attr('text-anchor', 'start');

  labels.each(function (this: SVGTextElement, d: IshikawaLabelBox) {
    const textSelection = select(this);
    d.lines.forEach((line: string, index: number) => {
      const tspan = textSelection.append('tspan').text(line || ' ');
      tspan.attr('x', d.x);
      if (index > 0) {
        tspan.attr('dy', d.lineHeight);
      }
    });
  });
};

export default {
  draw,
};
