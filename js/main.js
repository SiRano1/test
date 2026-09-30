'use strict';
/* Запуск */
window.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  G.world = genWorld();
  G.world.paintMini(null);
  UI.buildHud();
  initCanvas();
  UI.showScreen('main');
  window.G = G; // для отладки
});
