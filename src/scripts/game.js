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
  revenue = 100000; // Starting revenue
  maintenanceCost = 0;
  pollution = 0; // 0-100 scale
  happiness = 70; // Starting higher for growth (0-100)
  lifespan = 75; // Realistic starting lifespan (years)

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
      this.city.game = this; // Link Game to City for population updates
      this.initialize(this.city);
      this.start();
      setInterval(this.simulate.bind(this), 500); // Faster pace: 2 ticks/sec
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
      console.log('Left mouse down, calling useTool');
      this.useTool();
    }
    this.renderer.render(this.scene, this.cameraManager.camera);
  }

  simulate() {
    if (window.ui.isPaused) return;
    this.city.simulate(1);
    this.updateMetrics();
    window.ui.updateTitleBar(this);
    window.ui.updateInfoPanel(this.selectedObject);
  }

  updateMetrics() {
    // Population: Realistic growth tied to residential capacity, happiness, pollution
    const residentialCapacity = this.buildingCounts.residential * 200; // 200 per building
    const happinessFactor = this.happiness / 100; // 0-1 scale
    const pollutionPenalty = Math.min(1, this.pollution / 50); // Caps at 100% reduction
    const growthRate = 0.05 * happinessFactor * (1 - pollutionPenalty); // 5% base rate
    const targetPopulation = residentialCapacity * happinessFactor * (1 - pollutionPenalty);
    const currentPopulation = this.city.population;
    const popChange = (targetPopulation - currentPopulation) * 0.1; // 10% migration per tick
    this.city.populationDelta = Math.round(popChange); // Pass to city.js

    // Pollution: Density-based and building-driven (threat)
    const densityPollution = (currentPopulation / (this.city.size * this.city.size)) * 50; // Pop/tile
    this.pollution = Math.min(
      100,
      densityPollution +
        this.buildingCounts.road * 2 + // 2% per road
        this.buildingCounts.residential * 5 // 5% per residential
    );

    // Happiness: Pollution hurts, residential helps
    this.happiness = Math.max(
      0,
      Math.min(
        100,
        70 - // Base happiness
          (this.pollution * 0.8) + // Strong pollution impact
          (this.buildingCounts.residential > 0 ? 0 : -20) // Penalty if no homes
      )
    );

    // Lifespan: Pollution as a real threat
    const pollutionLifespanImpact = this.pollution * 0.5; // Up to 50 years lost
    this.lifespan = Math.max(20, 75 - pollutionLifespanImpact); // Min 20 years

    // Revenue: Taxes + commerce income
    const taxRevenue = currentPopulation * 1.0; // $1 per resident
    const commerceIncome = this.buildingCounts.residential * 50; // $50 per residential (jobs)
    this.maintenanceCost = this.buildingCounts.road * 10 + this.buildingCounts.residential * 20;
    this.revenue += taxRevenue + commerceIncome - this.maintenanceCost;
  }

  useTool() {
    console.log('useTool called, activeToolId:', window.ui.activeToolId, 'focusedObject:', this.focusedObject?.constructor.name || 'null');
    switch (window.ui.activeToolId) {
      case 'select':
        this.updateSelectedObject();
        window.ui.updateInfoPanel(this.selectedObject);
        break;
      case 'bulldoze':
        if (this.focusedObject) {
          const { x, y } = this.focusedObject;
          console.log('Bulldozing at:', x, y);
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
          console.log('Attempting to place:', type, 'at', x, y);
          const building = this.city.placeBuilding(x, y, type);
          if (building) {
            console.log('Building placed successfully at:', x, y);
            this.buildings.push(building);
            building.type = type;
            if (type === 'road') this.buildingCounts.road++;
            if (type === 'residential') this.buildingCounts.residential++;
          }
        }
        break;
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
    console.log('Focused object:', this.focusedObject?.constructor.name || 'null', 'at:', this.focusedObject?.x, this.focusedObject?.y);
  }

  #raycast() {
    var coords = {
      x: (this.inputManager.mouse.x / this.renderer.domElement.clientWidth) * 2 - 1,
      y: -(this.inputManager.mouse.y / this.renderer.domElement.clientHeight) * 2 + 1
    };
    this.raycaster.setFromCamera(coords, this.cameraManager.camera);
    let intersections = this.raycaster.intersectObjects(this.city.root.children, true);
    if (intersections.length > 0) {
      const selectedObject = intersections[0].object.userData;
      return selectedObject;
    }
    return null;
  }

  onResize() {
    this.cameraManager.resize(window.ui.gameWindow);
    this.renderer.setSize(window.ui.gameWindow.clientWidth, window.ui.gameWindow.clientHeight);
  }

  setTool(toolId) {
    window.ui.activeToolId = toolId;
    console.log('Tool set to:', toolId);
  }
}

window.onload = () => {
  window.game = new Game();
};