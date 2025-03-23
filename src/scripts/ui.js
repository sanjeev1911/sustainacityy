import { Game } from './game';
import playIconUrl from '/icons/play-color.png';
import pauseIconUrl from '/icons/pause-color.png';

// Building costs and effects (mirrors game.js)
const buildingCosts = {
  residential: { cost: 150, revenuePerTick: 0, pollution: 0, happiness: 5 },
  commercial: { cost: 225, revenuePerTick: 25, pollution: 2, happiness: 0 },
  industrial: { cost: 375, revenuePerTick: 60, pollution: 10, happiness: -5 },
  road: { cost: 40, revenuePerTick: 0, pollution: 1, happiness: 2 },
  'power-plant': { cost: 750, revenuePerTick: 0, pollution: 15, happiness: -5 },
  'power-line': { cost: 75, revenuePerTick: 0, pollution: 0, happiness: 0 },
  bulldoze: { cost: 0, revenuePerTick: 0, pollution: 0, happiness: 0 },
  select: { cost: 0, revenuePerTick: 0, pollution: 0, happiness: 0 }
};

export class GameUI {
  activeToolId = 'select';
  selectedControl = document.getElementById('button-select');
  isPaused = false;

  get gameWindow() {
    return document.getElementById('render-target');
  }

  showLoadingText() {
    document.getElementById('loading').style.visibility = 'visible';
  }

  hideLoadingText() {
    document.getElementById('loading').style.visibility = 'hidden';
  }

  onToolSelected(event) {
    if (this.selectedControl) {
      this.selectedControl.classList.remove('selected');
    }
    this.selectedControl = event.target.closest('.ui-button');
    this.selectedControl.classList.add('selected');

    this.activeToolId = this.selectedControl.getAttribute('data-type');
    window.game.setTool(this.activeToolId);

    const type = this.activeToolId;
    const buildingCost = buildingCosts[type].cost;

    if (buildingCost > 0 && window.game.focusedObject) {
      const { x, y } = window.game.focusedObject;
      window.game.placeBuilding(x, y, type);
    } else if (buildingCost > 0) {
      console.log(`No valid location selected to place ${type}!`);
      window.showNotification(`No valid location selected to place ${type}!`);
    }
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    window.game.togglePause();
    if (this.isPaused) {
      document.getElementById('pause-button-icon').src = playIconUrl;
      document.getElementById('paused-text').style.visibility = 'visible';
    } else {
      document.getElementById('pause-button-icon').src = pauseIconUrl;
      document.getElementById('paused-text').style.visibility = 'hidden';
    }
    if (window.updateMetrics) window.updateMetrics();
  }

  updateTitleBar(game) {
    document.getElementById('city-name').innerHTML = game.city.name;
    document.getElementById('population-counter').innerHTML = game.city.population;
    const date = new Date('1/1/2023');
    date.setDate(date.getDate() + game.city.simTime);
    document.getElementById('sim-time').innerHTML = date.toLocaleDateString();
    if (window.updateMetrics) window.updateMetrics();
  }

  updateInfoPanel(object) {
    const infoElement = document.getElementById('info-panel');
    if (object) {
      infoElement.style.visibility = 'visible';
      infoElement.innerHTML = object.toHTML();
    } else {
      infoElement.style.visibility = 'hidden';
      infoElement.innerHTML = '';
    }
  }
}

window.ui = new GameUI();