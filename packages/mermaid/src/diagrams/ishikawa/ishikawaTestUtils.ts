import { lineBreakRegex } from '../common/common.js';
import type { IshikawaNode, TextStyle, WrappedTextMetrics } from './ishikawaTypes.js';
import type { MeasureText } from './ishikawaLayout.js';
// @ts-expect-error No types available for JISON
import parser from './parser/ishikawa.jison';
import { IshikawaDB } from './ishikawaDb.js';
// cspell:ignore alnum punct fullwidth

const asciiPunct = /[!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~-]/;
const asciiAlnum = /[\dA-Za-z]/;
const asciiSpace = /\s/;
const cjkRange = /[\u3040-\u30ff\u3400-\u9fff\uF900-\uFAFF]/;
const fullwidthPunct = /[\u3000-\u303F\uFF01-\uFF5E]/;
const emojiRange = /[\u{1F300}-\u{1FAFF}]/u;

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

const charWeight = (char: string) => {
  if (emojiRange.test(char)) {
    return 1.2;
  }
  if (cjkRange.test(char)) {
    return 1.0;
  }
  if (fullwidthPunct.test(char)) {
    return 0.9;
  }
  if (asciiSpace.test(char)) {
    return 0.28;
  }
  if (asciiAlnum.test(char)) {
    return 0.58;
  }
  if (asciiPunct.test(char)) {
    return 0.45;
  }
  return 0.58;
};

const measureLineWidth = (line: string, fontSize: number) => {
  let width = 0;
  for (const char of [...line]) {
    width += charWeight(char) * fontSize;
  }
  return width;
};

const wrapLine = (line: string, maxWidth: number, fontSize: number) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return [''];
  }
  const isCjk = cjkRange.test(trimmed);
  const words = trimmed.split(/\s+/).filter(Boolean);
  const useWordWrap = words.length > 1 && !isCjk;
  const chunks = useWordWrap ? words : [...trimmed];
  const lines: string[] = [];
  let current = '';

  const measure = (value: string) => measureLineWidth(value || ' ', fontSize);

  for (const chunk of chunks) {
    const candidate = current ? `${current}${useWordWrap ? ' ' : ''}${chunk}` : chunk;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (!current) {
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

  return lines;
};

export const measureTextStub = (
  text: string,
  style: TextStyle,
  maxWidth?: number
): WrappedTextMetrics => {
  const lineHeight = style.fontSize * 1.25;
  let lines = splitByLineBreaks(text);
  if (maxWidth !== undefined) {
    const wrapped: string[] = [];
    lines.forEach((line) => wrapped.push(...wrapLine(line, maxWidth, style.fontSize)));
    lines = wrapped.length ? wrapped : [''];
  }
  const widths = lines.map((line) => measureLineWidth(line || ' ', style.fontSize));
  const width = widths.length ? Math.max(...widths) : 0;
  return {
    width,
    height: lines.length * lineHeight,
    lineHeight,
    lines,
  };
};

export const createMeasureText = (): MeasureText => {
  return (text: string, style: TextStyle) => {
    const metrics = measureTextStub(text, style);
    return { width: metrics.width, height: metrics.height, lineHeight: metrics.lineHeight };
  };
};

export const parseIshikawa = (input: string): IshikawaNode => {
  const db = new IshikawaDB();
  parser.yy = db;
  db.clear();
  parser.parse(input);
  const root = db.getRoot();
  if (!root) {
    throw new Error('No ishikawa root node parsed');
  }
  return root;
};
