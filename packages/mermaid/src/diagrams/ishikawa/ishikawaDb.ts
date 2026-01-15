import { getConfig } from '../../diagram-api/diagramAPI.js';
import { sanitizeText } from '../../diagrams/common/common.js';
import { log } from '../../logger.js';
import type { IshikawaNode } from './ishikawaTypes.js';

const nodeType = {
  DEFAULT: 0,
  NO_BORDER: 0,
  ROUNDED_RECT: 1,
  RECT: 2,
  CIRCLE: 3,
  CLOUD: 4,
  BANG: 5,
  HEXAGON: 6,
} as const;

export class IshikawaDB {
  private nodes: IshikawaNode[] = [];
  private count = 0;
  private baseLevel?: number;
  public readonly nodeType: typeof nodeType;

  constructor() {
    this.getLogger = this.getLogger.bind(this);
    this.nodeType = nodeType;
    this.clear();
    this.getType = this.getType.bind(this);
    this.getParent = this.getParent.bind(this);
    this.getRoot = this.getRoot.bind(this);
    this.addNode = this.addNode.bind(this);
    this.decorateNode = this.decorateNode.bind(this);
  }

  public clear() {
    this.nodes = [];
    this.count = 0;
    this.baseLevel = undefined;
  }

  public getParent(level: number): IshikawaNode | null {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      if (this.nodes[i].level < level) {
        return this.nodes[i];
      }
    }
    return null;
  }

  public getRoot(): IshikawaNode | null {
    return this.nodes.length > 0 ? this.nodes[0] : null;
  }

  public addNode(level: number, id: string, descr: string, _type: number): void {
    log.info('addNode', level, id, descr, _type);

    let isRoot = false;

    if (this.nodes.length === 0) {
      this.baseLevel = level;
      level = 0;
      isRoot = true;
    } else if (this.baseLevel !== undefined) {
      level = level - this.baseLevel;
    }

    const conf = getConfig();
    const node: IshikawaNode = {
      id: `ishikawa-${this.count++}`,
      label: sanitizeText(descr, conf),
      level,
      children: [],
      isRoot,
    };

    const parent = this.getParent(level);
    if (parent) {
      parent.children.push(node);
      this.nodes.push(node);
    } else {
      if (isRoot) {
        this.nodes.push(node);
      } else {
        throw new Error(
          `There can be only one root. No parent could be found for ("${node.label}")`
        );
      }
    }
  }

  public getType(startStr: string, endStr: string) {
    log.debug('In get type', startStr, endStr);
    switch (startStr) {
      case '[':
        return this.nodeType.RECT;
      case '(':
        return endStr === ')' ? this.nodeType.ROUNDED_RECT : this.nodeType.CLOUD;
      case '((':
        return this.nodeType.CIRCLE;
      case ')':
        return this.nodeType.CLOUD;
      case '))':
        return this.nodeType.BANG;
      case '{{':
        return this.nodeType.HEXAGON;
      default:
        return this.nodeType.DEFAULT;
    }
  }

  public decorateNode(decoration?: { class?: string; icon?: string }): void {
    if (!decoration) {
      return;
    }

    const config = getConfig();
    const node = this.nodes[this.nodes.length - 1];
    if (decoration.icon) {
      node.icon = sanitizeText(decoration.icon, config);
    }
    if (decoration.class) {
      node.class = sanitizeText(decoration.class, config);
    }
  }

  // Expose logger to grammar
  public getLogger() {
    return log;
  }
}
