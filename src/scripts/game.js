import * as THREE from 'three';
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
  buildingCounts = { road: 0, residential: 0 };
  buildings = [];
  revenue = 1000000; // Inflated starting cash
  maintenanceCost = 0;
  pollution = 0;
  happiness = 50;
  lifespan = 100;

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

    this.raycaster = new THREE.Raycaster();

    window.assetManager = new AssetManager(() => {
      window.ui.hideLoadingText();
      this.city = new City(16);
      this.initialize(this.city);
      this.start();
      setInterval(this.simulate.bind(this), 1000); // Runs every second
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

  simulate() {
    if (window.ui.isPaused) return;

    const taxRevenue = this.city.population * 10; // $10 per resident
    this.maintenanceCost = (this.buildingCounts.road * 50) + (this.buildingCounts.residential * 100);
    this.revenue += taxRevenue - this.maintenanceCost;
    this.pollution = Math.min(1000, (this.buildingCounts.road * 10) + (this.buildingCounts.residential * 5));
    this.happiness = Math.max(0, Math.min(100, 50 + (this.city.population / 50) - (this.pollution / 20)));
    this.lifespan = Math.max(50, Math.min(100, 100 - (this.pollution / 10)));

    console.log('Simulate:', { 
      revenue: this.revenue, 
      population: this.city.population, 
      pollution: this.pollution, 
      happiness: this.happiness, 
      lifespan: this.lifespan 
    });

    if (this.revenue < 0) {
      console.log('Game Over: Revenue dropped below 0');
      window.showGameOver();
      this.stop();
      return;
    }

    this.city.simulate(1); // Updates population dynamically via Residents class
  }

  draw() {
    this.city.draw();
    this.updateFocusedObject();
    if (this.inputManager.isLeftMouseDown) {
      this.useTool();
    }
    this.renderer.render(this.scene, this.cameraManager.camera);
    if (window.updateMetrics) {
      window.updateMetrics(); // Syncs UI with latest population
    } else {
      console.log('updateMetrics not found');
    }
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
          const building = this.city.bulldoze(x, y);
          if (building) {
            this.buildings = this.buildings.filter(b => b !== building);
            if (building.type === 'road') this.buildingCounts.road--;
            if (building.type === 'residential') this.buildingCounts.residential--;
          }
        }
        break;
      default:
        if (this.focusedObject) {
          const { x, y } = this.focusedObject;
          const type = window.ui.activeToolId;
          const building = this.city.placeBuilding(x, y, type);
          if (building) {
            this.buildings.push(building);
            building.type = type;
            if (type === 'road') this.buildingCounts.road++;
            if (type === 'residential') this.buildingCounts.residential++;
            const costs = { road: 500, residential: 1500 }; // Inflated costs
            this.revenue -= costs[type] || 0;
          }
        }
        break;
    }
  }

  updateSelectedObject() {
    this.selectedObject?.setFocused(false);
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
    return intersections.length > 0 ? intersections[0].object.userData : null;
  }

  onResize() {
    this.cameraManager.resize(window.ui.gameWindow);
    this.renderer.setSize(window.ui.gameWindow.clientWidth, window.ui.gameWindow.clientHeight);
  }

  setTool(toolId) {
    window.ui.activeToolId = toolId;
  }
}

window.onload = () => {
  window.game = new Game();
};