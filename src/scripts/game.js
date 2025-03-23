import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AssetManager } from './assets/assetManager.js';
import { CameraManager } from './camera.js';
import { InputManager } from './input.js';
import { City } from './sim/city.js';
import { SimObject } from './sim/simObject.js';

export class Game {
  city;
  focusedObject = null;
  inputManager;
  selectedObject = null;

  // Game state for metrics
  revenue = 100000;
  pollution = 0;
  happiness = 50;
  lifespan = 80;
  buildings = [];
  hasPower = false;
  hasRoads = false;
  maintenanceCost = 0; // New: Tracks extra costs from low lifespan

  constructor(city) {
    this.city = city;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.scene = new THREE.Scene();

    this.inputManager = new InputManager(window.ui.gameWindow);
    this.cameraManager = new CameraManager(window.ui.gameWindow);

    this.renderer.setSize(window.ui.gameWindow.clientWidth, window.ui.gameWindow.clientHeight);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    window.ui.gameWindow.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.cameraManager.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.rotateSpeed = 0.5;
    this.controls.panSpeed = 0.5;
    this.controls.zoomSpeed = 0.5;
    this.controls.screenSpacePanning = true;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    this.controls.enable = true;

    this.raycaster = new THREE.Raycaster();

    window.assetManager = new AssetManager(() => {
      window.ui.hideLoadingText();

      this.city = new City(16);
      this.initialize(this.city);
      this.start();

      setInterval(this.simulate.bind(this), 1000);
      setInterval(this.updateMetricsTick.bind(this), 5000);
    });

    window.addEventListener('resize', this.onResize.bind(this), false);
  }

  initialize(city) {
    this.scene.clear();
    this.scene.add(city);
    this.#setupLights();
    this.#setupGrid(city);
  }

  #setupGrid(city) {
    const gridMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x000000,
      map: window.assetManager.textures['grid'],
      transparent: true,
      opacity: 0.2
    });
    gridMaterial.map.repeat = new THREE.Vector2(city.size, city.size);
    gridMaterial.map.wrapS = city.size;
    gridMaterial.map.wrapT = city.size;

    const grid = new THREE.Mesh(
      new THREE.BoxGeometry(city.size, 0.1, city.size),
      gridMaterial
    );
    grid.position.set(city.size / 2 - 0.5, -0.04, city.size / 2 - 0.5);
    this.scene.add(grid);
  }

  #setupLights() {
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(-10, 20, 0);
    sun.castShadow = true;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 50;
    sun.shadow.normalBias = 0.01;
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  }
  
  start() {
    this.renderer.setAnimationLoop(this.draw.bind(this));
  }

  stop() {
    this.renderer.setAnimationLoop(null);
  }

  draw() {
    this.city.draw();
    this.updateFocusedObject();

    if (this.inputManager.isLeftMouseDown) {
      this.useTool();
    }

    this.controls.update();
    this.renderer.render(this.scene, this.cameraManager.camera);
  }

  simulate() {
    if (window.ui.isPaused) return;

    this.city.simulate(1);
    window.ui.updateTitleBar(this);
    window.ui.updateInfoPanel(this.selectedObject);
  }

  updateMetricsTick() {
    if (window.ui.isPaused) return;

    // Revenue from buildings and population tax
    const taxRevenue = this.city.population * 0.5; // $0.50 per resident
    this.buildings.forEach(building => {
      this.revenue += buildingCosts[building.type].revenuePerTick;
    });
    this.revenue += taxRevenue;

    // Happiness and population growth
    const residentialCount = this.buildings.filter(b => b.type === 'residential').length;
    if (residentialCount > 0) {
      this.happiness += (this.hasPower && this.hasRoads) ? 2 : -3;
      const popGrowth = this.happiness > 70 ? 5 : this.happiness < 30 ? -2 : 1;
      this.city.population = Math.max(0, this.city.population + popGrowth);
    }

    // Pollution impact
    this.pollution = this.buildings.reduce((total, b) => total + buildingCosts[b.type].pollution, 0);
    if (this.pollution > 60) this.happiness -= 2;
    if (this.pollution > 80) this.city.population = Math.max(0, this.city.population - 3);

    // Lifespan and maintenance
    this.happiness = Math.max(0, Math.min(100, this.happiness));
    this.lifespan = Math.max(10, 80 - this.pollution * 0.3 - (this.happiness < 50 ? (50 - this.happiness) * 0.2 : 0));
    this.maintenanceCost = this.lifespan < 50 ? this.buildings.length * 5 : 0; // $5 per building if lifespan < 50
    this.revenue -= this.maintenanceCost;

    if (window.updateMetrics) window.updateMetrics();
  }

  useTool() {
    switch (window.ui.activeToolId) {
      case 'select':
        this.updateSelectedObject();
        window.ui.updateInfoPanel(this.selectedObject);
        break;
      case 'bulldoze':
        if (this.focusedObject) {
          const { x, y } = this.focusedObject;
          this.city.bulldoze(x, y);
          this.removeBuilding(x, y);
        }
        break;
      default:
        if (this.focusedObject) {
          const { x, y } = this.focusedObject;
          const type = window.ui.activeToolId;
          this.placeBuilding(x, y, type);
        }
        break;
    }
  }

  placeBuilding(x, y, type) {
    const buildingCost = buildingCosts[type].cost;
    if (this.revenue >= buildingCost) {
      // Building restrictions based on meters
      if (type === 'residential' && (this.happiness < 20 || this.pollution > 80)) {
        window.showNotification(`Cannot place ${type}! Happiness too low (${this.happiness}%) or pollution too high (${this.pollution}%)`);
        return;
      }
      if (type === 'commercial' && this.happiness < 30) {
        window.showNotification(`Cannot place ${type}! Happiness too low (${this.happiness}%)`);
        return;
      }

      this.revenue -= buildingCost;
      this.city.placeBuilding(x, y, type);
      this.buildings.push({ type, x, y });

      this.pollution += buildingCosts[type].pollution;
      this.happiness += buildingCosts[type].happiness;

      if (type === 'power-plant') this.hasPower = true;
      if (type === 'road') this.hasRoads = true;

      if (window.updateMetrics) window.updateMetrics();
    } else {
      console.log(`Not enough revenue to place ${type}! Need $${buildingCost}`);
      window.showNotification(`Not enough revenue to place ${type}! Need $${buildingCost}`);
    }
  }

  removeBuilding(x, y) {
    const index = this.buildings.findIndex(b => b.x === x && b.y === y);
    if (index !== -1) {
      const removedBuilding = this.buildings.splice(index, 1)[0];
      this.pollution -= buildingCosts[removedBuilding.type].pollution;
      this.happiness -= buildingCosts[removedBuilding.type].happiness;

      if (removedBuilding.type === 'power-plant') {
        this.hasPower = this.buildings.some(b => b.type === 'power-plant');
      }
      if (removedBuilding.type === 'road') {
        this.hasRoads = this.buildings.some(b => b.type === 'road');
      }

      if (window.updateMetrics) window.updateMetrics();
    }
  }

  updateSelectedObject() {
    this.selectedObject?.setSelected(false);
    this.selectedObject = this.focusedObject;
    this.selectedObject?.setSelected(true);
  }

  updateFocusedObject() {  
    this.focusedObject?.setFocused(false);
    const newObject = this.#raycast();
    if (newObject !== this.focusedObject) {
      this.focusedObject = newObject;
    }
    this.focusedObject?.setFocused(true);
  }

  #raycast() {
    const coords = {
      x: (this.inputManager.mouse.x / this.renderer.domElement.clientWidth) * 2 - 1,
      y: -(this.inputManager.mouse.y / this.renderer.domElement.clientHeight) * 2 + 1
    };

    this.raycaster.setFromCamera(coords, this.cameraManager.camera);

    const intersections = this.raycaster.intersectObjects(this.city.root.children, true);
    if (intersections.length > 0) {
      return intersections[0].object.userData;
    }
    return null;
  }

  onResize() {
    this.cameraManager.resize(window.ui.gameWindow);
    this.renderer.setSize(window.ui.gameWindow.clientWidth, window.ui.gameWindow.clientHeight);
  }

  // Expose for UI
  setTool(tool) {
    // Placeholder for compatibility with ui.js
  }

  togglePause() {
    // Placeholder for compatibility with ui.js
  }
}

const buildingCosts = {
  residential: { cost: 150, revenuePerTick: 0, pollution: 0, happiness: 5 }, // Was 200
  commercial: { cost: 225, revenuePerTick: 25, pollution: 2, happiness: 0 }, // Was 300, 20
  industrial: { cost: 375, revenuePerTick: 60, pollution: 10, happiness: -5 }, // Was 500, 50
  road: { cost: 40, revenuePerTick: 0, pollution: 1, happiness: 2 }, // Was 50
  'power-plant': { cost: 750, revenuePerTick: 0, pollution: 15, happiness: -5 }, // Was 1000
  'power-line': { cost: 75, revenuePerTick: 0, pollution: 0, happiness: 0 }, // Was 100
  bulldoze: { cost: 0, revenuePerTick: 0, pollution: 0, happiness: 0 },
  select: { cost: 0, revenuePerTick: 0, pollution: 0, happiness: 0 }
};

window.onload = () => {
  window.game = new Game();
};