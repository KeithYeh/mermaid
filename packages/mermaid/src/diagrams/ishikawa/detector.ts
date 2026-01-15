const id = 'ishikawa';

const detector = (txt: string) => {
  return /^\s*ishikawa/.test(txt);
};

const loader = async () => {
  const { diagram } = await import('./ishikawa-definition.js');
  return { id, diagram };
};

export default {
  id,
  detector,
  loader,
};
