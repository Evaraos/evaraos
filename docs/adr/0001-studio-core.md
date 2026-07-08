# ADR 0001: Evara Studio Core

## Status
Accepted

## Context
EvaraOS needs to move beyond page-by-page editing. The owner vision requires the platform to be visually editable from inside the app while still remaining maintainable as the app grows across operations, finance, HR, marketplace, customer, AI, and developer systems.

## Decision
Evara Studio will become Studio Core: an internal operating system for building and managing EvaraOS. Studio Core is organized around registries, components, modules, blueprints, assets, permissions, data, and deployment rather than static pages.

## Systems
- Studio Command Center
- Studio Mode
- Canvas Engine
- Layer Panel
- Inspector
- Component Engine
- Module Registry
- Blueprint Manager
- Asset Library
- Theme Engine
- Data Engine
- AI Builder
- Project Center
- Deploy Center
- Developer Tools

## Principles
1. Build systems before pages.
2. Every visible UI element should become editable as a component.
3. Permissions must apply to pages, modules, components, and actions.
4. Assets are uploaded once and reused everywhere.
5. Studio should favor visual editing over code.
6. Developer tools exist, but they are advanced and hidden from non-technical owners.

## Consequences
- The existing Website Builder page will be gradually replaced by Studio Core.
- Live Edit is temporary and will be replaced by Canvas Engine + Inspector.
- Future dashboards should be assembled from reusable components and blueprints.
- Major systems must include registry metadata so Studio can understand them.
