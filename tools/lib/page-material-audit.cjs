'use strict';

const SHARED_BACKDROP_PRESET = /^var\(--lg-backdrop-(?:control|standard|elevated)\)$/;
const CONTROLLED_STUDIO_GLASS = /^blur\(var\(--studio-glass-blur\)\)\s+saturate\(var\(--lg-saturation\)\)$/;
const CONTROLLED_STUDIO_NODE_GLASS = /^blur\(calc\(var\(--node-glass(?:,\s*[-\d.]+\s*)?\)\s*\*\s*0\.45px\)\)\s+saturate\(var\(--lg-saturation\)\)$/;

function hasNonCanonicalPageBackdrop(source = '') {
  const declarations = [...String(source).matchAll(/(?:-webkit-)?backdrop-filter\s*:\s*([^;}]+)/g)];
  return declarations.some(([, rawValue]) => {
    const value = rawValue.replace(/!\s*important/gi, '').trim();
    if (value === 'none' || SHARED_BACKDROP_PRESET.test(value)) return false;
    if (CONTROLLED_STUDIO_GLASS.test(value) || CONTROLLED_STUDIO_NODE_GLASS.test(value)) return false;
    return true;
  });
}

module.exports = { hasNonCanonicalPageBackdrop };
