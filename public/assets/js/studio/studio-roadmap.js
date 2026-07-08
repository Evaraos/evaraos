export const STUDIO_ROADMAP_VERSION = 'studio-roadmap-v1';

export const STUDIO_WAVES = Object.freeze([
  {
    id: 'wave-1',
    name: 'Foundation',
    progress: 90,
    status: 'active',
    items: ['Permission Engine', 'Design System', 'Role Separation', 'Component Registry', 'Module Registry']
  },
  {
    id: 'wave-2',
    name: 'Studio Core',
    progress: 24,
    status: 'active',
    items: ['Studio Command Center', 'Studio Mode', 'Canvas Engine', 'Layer Panel', 'Inspector', 'Asset Library', 'Blueprint Manager']
  },
  {
    id: 'wave-3',
    name: 'Visual Platform',
    progress: 0,
    status: 'planned',
    items: ['Component Library', 'Layout Engine', 'Theme Engine', 'Animation Engine', 'Media Engine']
  },
  {
    id: 'wave-4',
    name: 'Intelligence',
    progress: 0,
    status: 'planned',
    items: ['AI Builder', 'AI Design Assistant', 'Data Engine', 'Automation Engine', 'Deploy Center']
  }
]);

export const STUDIO_CORE_SYSTEMS = Object.freeze([
  { id: 'command-center', name: 'Command Center', progress: 28, status: 'active', description: 'Mission control for Studio progress, modules, blueprints, assets, and testing.' },
  { id: 'studio-mode', name: 'Studio Mode', progress: 8, status: 'next', description: 'Transforms the live app into an owner-only editing environment.' },
  { id: 'canvas-engine', name: 'Canvas Engine', progress: 6, status: 'next', description: 'Editable live app canvas with selection, drag, resize, and snap behavior.' },
  { id: 'layer-panel', name: 'Layer Panel', progress: 0, status: 'planned', description: 'Visual hierarchy of the selected blueprint or dashboard.' },
  { id: 'inspector', name: 'Inspector', progress: 12, status: 'active', description: 'Single adaptive properties panel for text, cards, icons, media, permissions, data, and developer settings.' },
  { id: 'assets', name: 'Asset Library', progress: 4, status: 'planned', description: 'Reusable logos, icons, favicons, app icons, images, videos, backgrounds, and documents.' },
  { id: 'blueprints', name: 'Blueprint Manager', progress: 5, status: 'planned', description: 'Role-aware operating layouts for owner, admin, sales, technician, cleaner, HR, vendor, and customer.' },
  { id: 'experience-recorder', name: 'Experience Recorder', progress: 0, status: 'planned', description: 'Timeline of changes with rollback and audit trail.' }
]);

export function studioOverallProgress() {
  const total = STUDIO_WAVES.reduce((sum, wave) => sum + Number(wave.progress || 0), 0);
  return Math.round(total / STUDIO_WAVES.length);
}

window.EvaraStudioRoadmap = { version: STUDIO_ROADMAP_VERSION, waves: STUDIO_WAVES, systems: STUDIO_CORE_SYSTEMS, progress: studioOverallProgress };
