import { describe, expect, it } from 'vitest';
import { layoutIshikawa } from './ishikawaLayout.js';
import { fixtures } from './ishikawaFixtures.js';
import { createMeasureText, parseIshikawa } from './ishikawaTestUtils.js';
import type { IshikawaLabelBox, IshikawaLayoutSegment } from './ishikawaTypes.js';

const baseConfig = {
  angleDeg: 35,
  minGap: 12,
  categorySpacing: 120,
  maxLabelWidth: 160,
  fontSize: 14,
  fontFamily: 'Arial',
  fontWeight: 400,
};

const checkOverlap = (a: IshikawaLabelBox, b: IshikawaLabelBox) => {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return { xOverlap, yOverlap, area: xOverlap * yOverlap };
};

const lineIntersectsRect = (segment: IshikawaLayoutSegment, rect: IshikawaLabelBox) => {
  const within = (x: number, min: number, max: number) => x >= min && x <= max;
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

const assertNoOverlaps = (labels: IshikawaLabelBox[]) => {
  for (let i = 0; i < labels.length; i += 1) {
    for (let j = i + 1; j < labels.length; j += 1) {
      const a = labels[i];
      const b = labels[j];
      if (a.side !== b.side || a.side === 'root') {
        continue;
      }
      const overlap = checkOverlap(a, b);
      if (overlap.area > 0) {
        throw new Error(
          `Label overlap (${a.side}) between "${a.label}" (${a.id}) and "${b.label}" (${b.id}). ` +
            `A=[${a.x},${a.y},${a.width},${a.height}] B=[${b.x},${b.y},${b.width},${b.height}] ` +
            `overlap=${overlap.area}`
        );
      }
    }
  }
};

const assertNoSegmentHits = (labels: IshikawaLabelBox[], segments: IshikawaLayoutSegment[]) => {
  for (const segment of segments) {
    for (const label of labels) {
      if (segment.ownerId && segment.ownerId === label.id) {
        continue;
      }
      if (lineIntersectsRect(segment, label)) {
        throw new Error(
          `Segment ${segment.id} intersects label "${label.label}" (${label.id}) ` +
            `segment=[${segment.x1},${segment.y1} -> ${segment.x2},${segment.y2}] ` +
            `label=[${label.x},${label.y},${label.width},${label.height}]`
        );
      }
    }
  }
};

const assertWithinBounds = (labels: IshikawaLabelBox[], bounds: any) => {
  labels.forEach((label) => {
    if (
      label.x < 0 ||
      label.y < 0 ||
      label.x + label.width > bounds.width ||
      label.y + label.height > bounds.height
    ) {
      throw new Error(
        `Label "${label.label}" (${label.id}) out of bounds ` +
          `label=[${label.x},${label.y},${label.width},${label.height}] bounds=[${bounds.width},${bounds.height}]`
      );
    }
  });
};

const toSvgSnapshot = (layout: ReturnType<typeof layoutIshikawa>) => {
  const lines = layout.segments
    .map(
      (seg) =>
        `<line data-kind="${seg.kind}" x1="${seg.x1}" y1="${seg.y1}" x2="${seg.x2}" y2="${seg.y2}" />`
    )
    .join('');
  const labels = layout.labels
    .map((label) => {
      const tspans = label.lines
        .map((line, index) => {
          const dy = index === 0 ? '' : ` dy="${label.lineHeight}"`;
          return `<tspan x="${label.x}"${dy}>${line}</tspan>`;
        })
        .join('');
      return `<text data-side="${label.side}" x="${label.x}" y="${label.y + label.lineHeight}">${tspans}</text>`;
    })
    .join('');
  return `<svg width="${layout.bounds.width}" height="${layout.bounds.height}">${lines}${labels}</svg>`;
};

const measureText = createMeasureText();

describe('ishikawa layout', () => {
  it('produces deterministic layouts for fixtures', () => {
    const root = parseIshikawa(fixtures.classic6M);
    const first = layoutIshikawa(root, baseConfig, measureText);
    const second = layoutIshikawa(root, baseConfig, measureText);
    expect(second).toEqual(first);
  });

  it('enforces layout invariants across stress fixtures', () => {
    const cases = Object.values(fixtures);
    cases.forEach((fixture) => {
      const root = parseIshikawa(fixture);
      const config =
        fixture === fixtures.tinyWrap ? { ...baseConfig, maxLabelWidth: 90 } : baseConfig;
      const layout = layoutIshikawa(root, config, measureText);
      assertNoOverlaps(layout.labels);
      assertNoSegmentHits(layout.labels, layout.segments);
      assertWithinBounds(layout.labels, layout.bounds);
    });
  });

  it('matches the layout snapshot for classic 6M', () => {
    const root = parseIshikawa(fixtures.classic6M);
    const layout = layoutIshikawa(root, baseConfig, measureText);
    expect(layout).toMatchInlineSnapshot(`
      {
        "bounds": {
          "height": 492.0314740033409,
          "maxX": 1278.5876957465368,
          "maxY": 492.0314740033409,
          "minX": 0,
          "minY": 0,
          "width": 1278.5876957465368,
        },
        "config": {
          "angleDeg": 35,
          "categorySpacing": 120,
          "fontSize": 14,
          "maxLabelWidth": 160,
          "minGap": 12,
        },
        "labels": [
          {
            "height": 35,
            "id": "ishikawa-0",
            "label": "Problem: Excessive Scrap Rate",
            "lineHeight": 17.5,
            "lines": [
              "Problem: Excessive",
              "Scrap Rate",
            ],
            "side": "root",
            "width": 140.14000000000001,
            "x": 1138.4476957465367,
            "y": 276.81451844605544,
          },
          {
            "height": 17.5,
            "id": "ishikawa-1",
            "label": "Man",
            "lineHeight": 17.5,
            "lines": [
              "Man",
            ],
            "side": "top",
            "width": 24.36,
            "x": 859.7894504318576,
            "y": 24,
          },
          {
            "height": 17.5,
            "id": "ishikawa-2",
            "label": "Training gaps",
            "lineHeight": 17.5,
            "lines": [
              "Training gaps",
            ],
            "side": "top",
            "width": 101.36000000000001,
            "x": 1019.7955964924001,
            "y": 173.09756288876997,
          },
          {
            "height": 17.5,
            "id": "ishikawa-3",
            "label": "Shift handoff errors",
            "lineHeight": 17.5,
            "lines": [
              "Shift handoff errors",
            ],
            "side": "top",
            "width": 154.00000000000003,
            "x": 1015.2124251727518,
            "y": 140.58980165157072,
          },
          {
            "height": 17.5,
            "id": "ishikawa-4",
            "label": "Missing checklist",
            "lineHeight": 17.5,
            "lines": [
              "Missing checklist",
            ],
            "side": "top",
            "width": 133.84000000000003,
            "x": 1004.2095499028998,
            "y": 86.00776123719925,
          },
          {
            "height": 17.5,
            "id": "ishikawa-5",
            "label": "Unclear ownership",
            "lineHeight": 17.5,
            "lines": [
              "Unclear ownership",
            ],
            "side": "top",
            "width": 133.84000000000003,
            "x": 999.6263785832515,
            "y": 53.50000000000003,
          },
          {
            "height": 17.5,
            "id": "ishikawa-6",
            "label": "Machine",
            "lineHeight": 17.5,
            "lines": [
              "Machine",
            ],
            "side": "bottom",
            "width": 56.83999999999999,
            "x": 707.3094504318577,
            "y": 460.03923524054017,
          },
          {
            "height": 17.5,
            "id": "ishikawa-7",
            "label": "Worn spindle bearing",
            "lineHeight": 17.5,
            "lines": [
              "Worn spindle bearing",
            ],
            "side": "bottom",
            "width": 154.00000000000003,
            "x": 899.7955964924001,
            "y": 398.0314740033409,
          },
          {
            "height": 17.5,
            "id": "ishikawa-8",
            "label": "Calibration drift",
            "lineHeight": 17.5,
            "lines": [
              "Calibration drift",
            ],
            "side": "bottom",
            "width": 133.84000000000003,
            "x": 895.2124251727518,
            "y": 430.53923524054017,
          },
          {
            "height": 17.5,
            "id": "ishikawa-9",
            "label": "Method",
            "lineHeight": 17.5,
            "lines": [
              "Method",
            ],
            "side": "top",
            "width": 48.71999999999999,
            "x": 551.7698013689219,
            "y": 24,
          },
          {
            "height": 17.5,
            "id": "ishikawa-10",
            "label": "Inconsistent setup",
            "lineHeight": 17.5,
            "lines": [
              "Inconsistent setup",
            ],
            "side": "top",
            "width": 141.96000000000004,
            "x": 755.7955964924001,
            "y": 173.09756288876997,
          },
          {
            "height": 35,
            "id": "ishikawa-11",
            "label": "Unstable process window",
            "lineHeight": 17.5,
            "lines": [
              "Unstable process",
              "window",
            ],
            "side": "top",
            "width": 125.72000000000003,
            "x": 751.2124251727518,
            "y": 123.08980165157072,
          },
          {
            "height": 17.5,
            "id": "ishikawa-12",
            "label": "Narrow tolerance",
            "lineHeight": 17.5,
            "lines": [
              "Narrow tolerance",
            ],
            "side": "top",
            "width": 125.72000000000003,
            "x": 740.2095499028998,
            "y": 86.00776123719925,
          },
          {
            "height": 17.5,
            "id": "ishikawa-13",
            "label": "Manual overrides",
            "lineHeight": 17.5,
            "lines": [
              "Manual overrides",
            ],
            "side": "top",
            "width": 125.72000000000003,
            "x": 735.6263785832515,
            "y": 53.50000000000003,
          },
          {
            "height": 17.5,
            "id": "ishikawa-14",
            "label": "Material",
            "lineHeight": 17.5,
            "lines": [
              "Material",
            ],
            "side": "bottom",
            "width": 64.96,
            "x": 280.740350937064,
            "y": 474.5314740033409,
          },
          {
            "height": 35,
            "id": "ishikawa-15",
            "label": "Supplier batch variation",
            "lineHeight": 17.5,
            "lines": [
              "Supplier batch",
              "variation",
            ],
            "side": "bottom",
            "width": 109.48000000000002,
            "x": 501.00614606054216,
            "y": 398.0314740033409,
          },
          {
            "height": 17.5,
            "id": "ishikawa-16",
            "label": "Incorrect alloy mix",
            "lineHeight": 17.5,
            "lines": [
              "Incorrect alloy mix",
            ],
            "side": "bottom",
            "width": 145.88000000000002,
            "x": 506.5705495681419,
            "y": 445.0314740033409,
          },
          {
            "height": 17.5,
            "id": "ishikawa-17",
            "label": "Measurement",
            "lineHeight": 17.5,
            "lines": [
              "Measurement",
            ],
            "side": "top",
            "width": 89.32000000000001,
            "x": 156.03999999999985,
            "y": 79.09756288876997,
          },
          {
            "height": 35,
            "id": "ishikawa-18",
            "label": "Gauge out of calibration",
            "lineHeight": 17.5,
            "lines": [
              "Gauge out of",
              "calibration",
            ],
            "side": "top",
            "width": 89.32000000000001,
            "x": 381.00614606054216,
            "y": 155.59756288876997,
          },
          {
            "height": 35,
            "id": "ishikawa-19",
            "label": "Sampling plan too sparse",
            "lineHeight": 17.5,
            "lines": [
              "Sampling plan too",
              "sparse",
            ],
            "side": "top",
            "width": 129.64000000000001,
            "x": 386.5705495681419,
            "y": 108.59756288876997,
          },
          {
            "height": 17.5,
            "id": "ishikawa-20",
            "label": "Mother Nature",
            "lineHeight": 17.5,
            "lines": [
              "Mother Nature",
            ],
            "side": "bottom",
            "width": 101.36000000000001,
            "x": 24,
            "y": 460.03923524054017,
          },
          {
            "height": 17.5,
            "id": "ishikawa-21",
            "label": "Humidity swings",
            "lineHeight": 17.5,
            "lines": [
              "Humidity swings",
            ],
            "side": "bottom",
            "width": 117.60000000000002,
            "x": 261.00614606054216,
            "y": 398.0314740033409,
          },
          {
            "height": 17.5,
            "id": "ishikawa-22",
            "label": "Temperature drift",
            "lineHeight": 17.5,
            "lines": [
              "Temperature drift",
            ],
            "side": "bottom",
            "width": 133.84000000000003,
            "x": 256.4229747408939,
            "y": 430.53923524054017,
          },
        ],
        "segments": [
          {
            "id": "bone-ishikawa-1",
            "kind": "bone",
            "ownerId": "ishikawa-1",
            "x1": 994.4476957465367,
            "x2": 896.1494504318578,
            "y1": 294.31451844605544,
            "y2": 225.48534608392993,
          },
          {
            "id": "leader-ishikawa-1-ishikawa-2",
            "kind": "leader",
            "ownerId": "ishikawa-2",
            "x1": 960.1088420499423,
            "x2": 986.2639275475499,
            "y1": 270.2701942342196,
            "y2": 232.91686101464157,
          },
          {
            "id": "leader-ishikawa-1-ishikawa-3",
            "kind": "leader",
            "ownerId": "ishikawa-3",
            "x1": 941.7598362578688,
            "x2": 967.9149217554765,
            "y1": 257.42208205995615,
            "y2": 220.06874884037813,
          },
          {
            "id": "leader-ishikawa-1-ishikawa-4",
            "kind": "leader",
            "ownerId": "ishikawa-4",
            "x1": 908.7316258321366,
            "x2": 943.1462120131994,
            "y1": 234.295480146282,
            "y2": 185.14635748894247,
          },
          {
            "id": "leader-ishikawa-1-ishikawa-5",
            "kind": "leader",
            "ownerId": "ishikawa-5",
            "x1": 890.3826200400632,
            "x2": 924.797206221126,
            "y1": 221.44736797201855,
            "y2": 172.29824531467904,
          },
          {
            "id": "bone-ishikawa-6",
            "kind": "bone",
            "ownerId": "ishikawa-6",
            "x1": 874.4476957465367,
            "x2": 776.1494504318578,
            "y1": 294.31451844605544,
            "y2": 363.14369080818096,
          },
          {
            "id": "leader-ishikawa-6-ishikawa-7",
            "kind": "leader",
            "ownerId": "ishikawa-7",
            "x1": 840.1088420499423,
            "x2": 866.2639275475499,
            "y1": 318.3588426578913,
            "y2": 355.7121758774693,
          },
          {
            "id": "leader-ishikawa-6-ishikawa-8",
            "kind": "leader",
            "ownerId": "ishikawa-8",
            "x1": 821.7598362578688,
            "x2": 847.9149217554764,
            "y1": 331.20695483215474,
            "y2": 368.56028805173275,
          },
          {
            "id": "bone-ishikawa-9",
            "kind": "bone",
            "ownerId": "ishikawa-9",
            "x1": 730.4476957465367,
            "x2": 612.4898013689219,
            "y1": 294.31451844605544,
            "y2": 211.7195116115048,
          },
          {
            "id": "leader-ishikawa-9-ishikawa-10",
            "kind": "leader",
            "ownerId": "ishikawa-10",
            "x1": 696.1088420499423,
            "x2": 722.2639275475499,
            "y1": 270.2701942342196,
            "y2": 232.91686101464157,
          },
          {
            "id": "leader-ishikawa-9-ishikawa-11",
            "kind": "leader",
            "ownerId": "ishikawa-11",
            "x1": 677.7598362578688,
            "x2": 703.9149217554764,
            "y1": 257.42208205995615,
            "y2": 220.06874884037813,
          },
          {
            "id": "leader-ishikawa-9-ishikawa-12",
            "kind": "leader",
            "ownerId": "ishikawa-12",
            "x1": 644.7316258321366,
            "x2": 679.1462120131994,
            "y1": 234.295480146282,
            "y2": 185.14635748894247,
          },
          {
            "id": "leader-ishikawa-9-ishikawa-13",
            "kind": "leader",
            "ownerId": "ishikawa-13",
            "x1": 626.3826200400632,
            "x2": 660.797206221126,
            "y1": 221.44736797201855,
            "y2": 172.29824531467904,
          },
          {
            "id": "bone-ishikawa-14",
            "kind": "bone",
            "ownerId": "ishikawa-14",
            "x1": 475.6582453146789,
            "x2": 357.70035093706406,
            "y1": 294.31451844605544,
            "y2": 376.9095252806061,
          },
          {
            "id": "leader-ishikawa-14-ishikawa-15",
            "kind": "leader",
            "ownerId": "ishikawa-15",
            "x1": 441.3193916180843,
            "x2": 467.474477115692,
            "y1": 318.3588426578913,
            "y2": 355.7121758774693,
          },
          {
            "id": "leader-ishikawa-14-ishikawa-16",
            "kind": "leader",
            "ownerId": "ishikawa-16",
            "x1": 422.9703858260109,
            "x2": 449.1254713236186,
            "y1": 331.20695483215474,
            "y2": 368.56028805173275,
          },
          {
            "id": "bone-ishikawa-17",
            "kind": "bone",
            "ownerId": "ishikawa-17",
            "x1": 355.6582453146789,
            "x2": 257.3599999999999,
            "y1": 294.31451844605544,
            "y2": 225.48534608392993,
          },
          {
            "id": "leader-ishikawa-17-ishikawa-18",
            "kind": "leader",
            "ownerId": "ishikawa-18",
            "x1": 321.3193916180843,
            "x2": 347.474477115692,
            "y1": 270.2701942342196,
            "y2": 232.91686101464157,
          },
          {
            "id": "leader-ishikawa-17-ishikawa-19",
            "kind": "leader",
            "ownerId": "ishikawa-19",
            "x1": 302.9703858260109,
            "x2": 329.1254713236186,
            "y1": 257.42208205995615,
            "y2": 220.06874884037813,
          },
          {
            "id": "bone-ishikawa-20",
            "kind": "bone",
            "ownerId": "ishikawa-20",
            "x1": 235.65824531467888,
            "x2": 137.3599999999999,
            "y1": 294.31451844605544,
            "y2": 363.14369080818096,
          },
          {
            "id": "leader-ishikawa-20-ishikawa-21",
            "kind": "leader",
            "ownerId": "ishikawa-21",
            "x1": 201.3193916180843,
            "x2": 227.47447711569203,
            "y1": 318.3588426578913,
            "y2": 355.7121758774693,
          },
          {
            "id": "leader-ishikawa-20-ishikawa-22",
            "kind": "leader",
            "ownerId": "ishikawa-22",
            "x1": 182.9703858260109,
            "x2": 209.12547132361863,
            "y1": 331.20695483215474,
            "y2": 368.56028805173275,
          },
          {
            "id": "spine",
            "kind": "spine",
            "x1": 115.65824531467888,
            "x2": 1114.4476957465367,
            "y1": 294.31451844605544,
            "y2": 294.31451844605544,
          },
        ],
        "stats": {
          "categoryCount": 6,
          "leafCount": 14,
          "maxDepth": 6,
        },
      }
    `);
  });

  it('matches the SVG snapshot for 6M', () => {
    const root = parseIshikawa(fixtures.classic6M);
    const layout = layoutIshikawa(root, baseConfig, measureText);
    expect(toSvgSnapshot(layout)).toMatchInlineSnapshot(
      `"<svg width="1278.5876957465368" height="492.0314740033409"><line data-kind="bone" x1="994.4476957465367" y1="294.31451844605544" x2="896.1494504318578" y2="225.48534608392993" /><line data-kind="leader" x1="960.1088420499423" y1="270.2701942342196" x2="986.2639275475499" y2="232.91686101464157" /><line data-kind="leader" x1="941.7598362578688" y1="257.42208205995615" x2="967.9149217554765" y2="220.06874884037813" /><line data-kind="leader" x1="908.7316258321366" y1="234.295480146282" x2="943.1462120131994" y2="185.14635748894247" /><line data-kind="leader" x1="890.3826200400632" y1="221.44736797201855" x2="924.797206221126" y2="172.29824531467904" /><line data-kind="bone" x1="874.4476957465367" y1="294.31451844605544" x2="776.1494504318578" y2="363.14369080818096" /><line data-kind="leader" x1="840.1088420499423" y1="318.3588426578913" x2="866.2639275475499" y2="355.7121758774693" /><line data-kind="leader" x1="821.7598362578688" y1="331.20695483215474" x2="847.9149217554764" y2="368.56028805173275" /><line data-kind="bone" x1="730.4476957465367" y1="294.31451844605544" x2="612.4898013689219" y2="211.7195116115048" /><line data-kind="leader" x1="696.1088420499423" y1="270.2701942342196" x2="722.2639275475499" y2="232.91686101464157" /><line data-kind="leader" x1="677.7598362578688" y1="257.42208205995615" x2="703.9149217554764" y2="220.06874884037813" /><line data-kind="leader" x1="644.7316258321366" y1="234.295480146282" x2="679.1462120131994" y2="185.14635748894247" /><line data-kind="leader" x1="626.3826200400632" y1="221.44736797201855" x2="660.797206221126" y2="172.29824531467904" /><line data-kind="bone" x1="475.6582453146789" y1="294.31451844605544" x2="357.70035093706406" y2="376.9095252806061" /><line data-kind="leader" x1="441.3193916180843" y1="318.3588426578913" x2="467.474477115692" y2="355.7121758774693" /><line data-kind="leader" x1="422.9703858260109" y1="331.20695483215474" x2="449.1254713236186" y2="368.56028805173275" /><line data-kind="bone" x1="355.6582453146789" y1="294.31451844605544" x2="257.3599999999999" y2="225.48534608392993" /><line data-kind="leader" x1="321.3193916180843" y1="270.2701942342196" x2="347.474477115692" y2="232.91686101464157" /><line data-kind="leader" x1="302.9703858260109" y1="257.42208205995615" x2="329.1254713236186" y2="220.06874884037813" /><line data-kind="bone" x1="235.65824531467888" y1="294.31451844605544" x2="137.3599999999999" y2="363.14369080818096" /><line data-kind="leader" x1="201.3193916180843" y1="318.3588426578913" x2="227.47447711569203" y2="355.7121758774693" /><line data-kind="leader" x1="182.9703858260109" y1="331.20695483215474" x2="209.12547132361863" y2="368.56028805173275" /><line data-kind="spine" x1="115.65824531467888" y1="294.31451844605544" x2="1114.4476957465367" y2="294.31451844605544" /><text data-side="root" x="1138.4476957465367" y="294.31451844605544"><tspan x="1138.4476957465367">Problem: Excessive</tspan><tspan x="1138.4476957465367" dy="17.5">Scrap Rate</tspan></text><text data-side="top" x="859.7894504318576" y="41.5"><tspan x="859.7894504318576">Man</tspan></text><text data-side="top" x="1019.7955964924001" y="190.59756288876997"><tspan x="1019.7955964924001">Training gaps</tspan></text><text data-side="top" x="1015.2124251727518" y="158.08980165157072"><tspan x="1015.2124251727518">Shift handoff errors</tspan></text><text data-side="top" x="1004.2095499028998" y="103.50776123719925"><tspan x="1004.2095499028998">Missing checklist</tspan></text><text data-side="top" x="999.6263785832515" y="71.00000000000003"><tspan x="999.6263785832515">Unclear ownership</tspan></text><text data-side="bottom" x="707.3094504318577" y="477.53923524054017"><tspan x="707.3094504318577">Machine</tspan></text><text data-side="bottom" x="899.7955964924001" y="415.5314740033409"><tspan x="899.7955964924001">Worn spindle bearing</tspan></text><text data-side="bottom" x="895.2124251727518" y="448.03923524054017"><tspan x="895.2124251727518">Calibration drift</tspan></text><text data-side="top" x="551.7698013689219" y="41.5"><tspan x="551.7698013689219">Method</tspan></text><text data-side="top" x="755.7955964924001" y="190.59756288876997"><tspan x="755.7955964924001">Inconsistent setup</tspan></text><text data-side="top" x="751.2124251727518" y="140.58980165157072"><tspan x="751.2124251727518">Unstable process</tspan><tspan x="751.2124251727518" dy="17.5">window</tspan></text><text data-side="top" x="740.2095499028998" y="103.50776123719925"><tspan x="740.2095499028998">Narrow tolerance</tspan></text><text data-side="top" x="735.6263785832515" y="71.00000000000003"><tspan x="735.6263785832515">Manual overrides</tspan></text><text data-side="bottom" x="280.740350937064" y="492.0314740033409"><tspan x="280.740350937064">Material</tspan></text><text data-side="bottom" x="501.00614606054216" y="415.5314740033409"><tspan x="501.00614606054216">Supplier batch</tspan><tspan x="501.00614606054216" dy="17.5">variation</tspan></text><text data-side="bottom" x="506.5705495681419" y="462.5314740033409"><tspan x="506.5705495681419">Incorrect alloy mix</tspan></text><text data-side="top" x="156.03999999999985" y="96.59756288876997"><tspan x="156.03999999999985">Measurement</tspan></text><text data-side="top" x="381.00614606054216" y="173.09756288876997"><tspan x="381.00614606054216">Gauge out of</tspan><tspan x="381.00614606054216" dy="17.5">calibration</tspan></text><text data-side="top" x="386.5705495681419" y="126.09756288876997"><tspan x="386.5705495681419">Sampling plan too</tspan><tspan x="386.5705495681419" dy="17.5">sparse</tspan></text><text data-side="bottom" x="24" y="477.53923524054017"><tspan x="24">Mother Nature</tspan></text><text data-side="bottom" x="261.00614606054216" y="415.5314740033409"><tspan x="261.00614606054216">Humidity swings</tspan></text><text data-side="bottom" x="256.4229747408939" y="448.03923524054017"><tspan x="256.4229747408939">Temperature drift</tspan></text></svg>"`
    );
  });
});
