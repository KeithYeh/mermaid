import type { DiagramStylesProvider } from '../../diagram-api/types.js';

const getStyles: DiagramStylesProvider = (options) => `
  .ishikawa .ishikawa-segment {
    stroke: ${options.lineColor};
    stroke-width: 2;
  }
  .ishikawa .ishikawa-spine {
    stroke-width: 3;
  }
  .ishikawa .ishikawa-head {
    fill: ${options.lineColor};
  }
  .ishikawa .ishikawa-label {
    fill: ${options.textColor};
    font-family: ${options.fontFamily};
    font-size: ${options.fontSize};
  }
  .ishikawa .ishikawa-label-root {
    font-weight: bold;
  }
`;

export default getStyles;
