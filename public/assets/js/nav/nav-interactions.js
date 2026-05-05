const TILE_SELECTOR = "#evaMenuPanel .eva-menu-app-launcher";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resetTile(tile) {
  if (!tile) return;
  tile.style.setProperty("--eva-tilt-x", "0deg");
  tile.style.setProperty("--eva-tilt-y", "0deg");
  tile.style.setProperty("--eva-light-x", "30%");
  tile.style.setProperty("--eva-light-y", "12%");
}

function updateTileFromPoint(tile, clientX, clientY) {
  const square = tile.querySelector(".eva-menu-app-square");
  if (!square) return;

  const rect = square.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const x = clamp((clientX - rect.left) / rect.width, 0, 1);
  const y = clamp((clientY - rect.top) / rect.height, 0, 1);

  const tiltY = (x - 0.5) * 10;
  const tiltX = (0.5 - y) * 10;

  tile.style.setProperty("--eva-tilt-x", `${tiltX.toFixed(2)}deg`);
  tile.style.setProperty("--eva-tilt-y", `${tiltY.toFixed(2)}deg`);
  tile.style.setProperty("--eva-light-x", `${Math.round(x * 100)}%`);
  tile.style.setProperty("--eva-light-y", `${Math.round(y * 100)}%`);
}

export function bindNavInteractions() {
  const panel = document.getElementById("evaMenuPanel");
  if (!panel || panel.dataset.interactionsBound === "true") return;

  panel.dataset.interactionsBound = "true";

  panel.addEventListener("pointermove", (event) => {
    const tile = event.target.closest(TILE_SELECTOR);
    if (!tile || !panel.contains(tile)) return;
    updateTileFromPoint(tile, event.clientX, event.clientY);
  }, { passive: true });

  panel.addEventListener("pointerleave", (event) => {
    const tile = event.target.closest(TILE_SELECTOR);
    resetTile(tile);
  }, true);

  panel.addEventListener("pointercancel", (event) => {
    const tile = event.target.closest(TILE_SELECTOR);
    resetTile(tile);
  }, true);

  panel.addEventListener("pointerup", (event) => {
    const tile = event.target.closest(TILE_SELECTOR);
    window.setTimeout(() => resetTile(tile), 90);
  }, true);
}
