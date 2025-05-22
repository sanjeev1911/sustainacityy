import * as THREE from 'three';
import * as THREE from 'three';
import { AssetManager } from './assets/assetManager.js';
import { CameraManager } from './camera.js';
import { InputManager } from './input.js';
import { City } from './sim/city.js';
import { SimObject } from './sim/simObject.js';
import { CityManager } from './sim/cityManager.js';
import { buildingConfigurations } from './assets/models.js';

/**
 * Represents the main game controller.
 * Initializes and manages the game loop, scene, city, city manager, and UI interactions.
 * Handles user input for tools, building placement, and simulation updates.
 */
export class Game {
  /** @type {City} The current city instance being simulated. */
  city;
  /** @type {CityManager} Manages the city's economy, stats, and save/load operations. */
  cityManager;
  focusedObject = null;
  inputManager;
  selectedObject = null;
  // buildingCounts is no longer the primary source for simulation stats like maintenance.
  // It can be kept for UI display purposes or removed if UI directly uses this.buildings.
  buildingCounts = { road: 0, residential: 0, commercial: 0, industrial: 0, 'power-plant': 0, 'power-line': 0 }; 
  buildings = []; 
  uiManager;


  constructor(uiManager) {
    this.uiManager = uiManager;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.scene = new THREE.Scene();
    this.inputManager = new InputManager(this.uiManager.gameWindow);
    this.cameraManager = new CameraManager(this.uiManager.gameWindow);

    this.renderer.setSize(this.uiManager.gameWindow.clientWidth, this.uiManager.gameWindow.clientHeight);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.uiManager.gameWindow.appendChild(this.renderer.domElement);

    this.raycaster = new THREE.Raycaster();

    // AssetManager should be initialized here or passed in, but for now, keep global for simplicity
    window.assetManager = new AssetManager(() => {
      this.uiManager.hideLoadingText();
      this.city = new City(16); // Initialize city
      this.cityManager = new CityManager(this.city); // Initialize CityManager
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
    if (this.uiManager.isPaused) return; // Assuming uiManager will have an isPaused property

    // Pass the full buildings array to CityManager for it to calculate maintenance and pollution
    const simStats = this.cityManager.simulateStats(this.buildings, this.city.population);

    console.log('Simulate:', {
      revenue: this.cityManager.currentRevenue, // Getter
      population: this.city.population,
      pollution: this.cityManager.currentPollution,
      happiness: this.cityManager.currentHappiness,
      lifespan: this.cityManager.currentLifespan
    });

    if (simStats.gameOver) {
      console.log('Game Over: Revenue dropped below threshold');
      this.uiManager.showGameOver('Revenue dropped below threshold'); // Pass reason
      this.stop();
      return;
    }

    this.city.simulate(1); // Updates population dynamically
  }

  draw() {
    this.city.draw();
    this.updateFocusedObject();
    if (this.inputManager.isLeftMouseDown) {
      this.useTool();
    }
    this.renderer.render(this.scene, this.cameraManager.camera);
    this.uiManager.updateMetrics(); // Direct call, GameUI checks for cityManager
  }

  useTool() {
    const activeToolId = this.uiManager.activeToolId; // Get active tool from uiManager
    switch (activeToolId) {
      case 'select':
        this.updateSelectedObject();
        this.uiManager.updateInfoPanel(this.selectedObject); // Use uiManager
        break;
      case 'bulldoze':
        if (this.focusedObject) {
          const { x, y } = this.focusedObject;
          const buildingToBulldoze = this.city.getTile(x,y)?.building;
          if (buildingToBulldoze) {
            const buildingType = buildingToBulldoze.type;
            const building = this.city.bulldoze(x, y); // city.bulldoze returns the building object
            if (building) {
              this.buildings = this.buildings.filter(b => b !== building);
              if (this.buildingCounts[buildingType] > 0) {
                this.buildingCounts[buildingType]--;
              }
            }
          }
        }
        break;
      default: // Building placement
        if (this.focusedObject) {
          const { x, y } = this.focusedObject;
          const type = activeToolId; // This is the building type string, e.g., 'residential'

          const config = buildingConfigurations[type];
          if (!config || config.cost === undefined) {
            console.error('No cost configuration for building type:', type);
            // Optionally, provide UI feedback here via uiManager
            return; // Stop building process
          }

          if (this.cityManager.currentRevenue >= config.cost) { // Check if player can afford using getter
            this.cityManager.deductRevenue(config.cost); // Use new method in CityManager
            
            const building = this.city.placeBuilding(x, y, type);
            if (building) {
              // building.type is already set within city.placeBuilding or by createBuilding
              this.buildings.push(building); 
              
              // Update buildingCounts (can be used for UI or other non-simulation logic)
              if (this.buildingCounts[type] !== undefined) {
                this.buildingCounts[type]++;
              } else {
                this.buildingCounts[type] = 1;
              }
            } else {
              // Refund if building placement failed for some reason after cost deduction
              this.cityManager.revenue += config.cost; // Directly adjust or add a refund method
              console.log('Building placement failed, refunding cost for:', type);
            }
          } else {
            console.log('Not enough funds to build:', type);
            // Optionally, provide UI feedback here via uiManager (e.g., this.uiManager.showNotification('Not enough funds!'))
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
    this.cameraManager.resize(this.uiManager.gameWindow);
    this.renderer.setSize(this.uiManager.gameWindow.clientWidth, this.uiManager.gameWindow.clientHeight);
  }

  setTool(toolId) {
    this.uiManager.activeToolId = toolId; // Set active tool via uiManager
  }

  /**
   * Loads and reconstructs the city state from a saved game object.
   * This involves clearing the current city, re-initializing it with saved dimensions,
   * and then re-placing all buildings and restoring their states (like resident counts).
   * @param {object} savedState - The game state object loaded from storage, typically by `CityManager.loadGame()`.
   * @param {number} savedState.citySize - The size (width/height) of the saved city.
   * @param {Array<object>} savedState.tiles - An array of tile data objects, each describing a building and its location.
   * @param {string} savedState.tiles[].buildingType - The type of building on the tile.
   * @param {number} savedState.tiles[].x - The x-coordinate of the tile.
   * @param {number} savedState.tiles[].y - The y-coordinate of the tile.
   * @param {number} [savedState.tiles[].residents] - Optional. The number of residents for residential buildings.
   */
  loadCityState(savedState) {
    console.log('Game: Loading city state...', savedState);

    // Clear existing city visuals and data structures
    if (this.city) {
      this.scene.remove(this.city); // Remove old city from scene
      this.city.disposeAllBuildingsAndTiles(); // Dispose THREE.js objects and clear tiles
    }
    this.buildings = [];
    this.buildingCounts = { road: 0, residential: 0, commercial: 0, industrial: 0, 'power-plant': 0, 'power-line': 0 }; // Reset counts

    // Re-initialize city with saved size
    this.city = new City(savedState.citySize);
    this.initialize(this.city); // Re-adds to scene, sets up grid/lights

    // Re-place buildings
    for (const tileData of savedState.tiles) {
      const newBuilding = this.city.placeBuilding(tileData.x, tileData.y, tileData.buildingType);
      if (newBuilding) {
        this.buildings.push(newBuilding);
        if (this.buildingCounts[tileData.buildingType] !== undefined) {
          this.buildingCounts[tileData.buildingType]++;
        } else {
          this.buildingCounts[tileData.buildingType] = 1;
        }

        if (tileData.buildingType === 'residential' && tileData.residents !== undefined) {
          if (!newBuilding.residents) { // Should be created by placeBuilding if it's residential
            console.warn('Residential building loaded without residents module instance:', newBuilding);
          } else {
            newBuilding.residents.count = tileData.residents;
          }
        }
        // Capacity is set during placeBuilding using buildingConfigurations,
        // but ensure it matches saved data if needed, or that save format is consistent with config.
        // For now, we rely on placeBuilding to set capacity from config.
        // If tileData.buildingCapacity was saved, we could double check:
        // if (newBuilding.capacity !== tileData.buildingCapacity) { console.warn(...); }
      } else {
        console.error(`Failed to re-place building of type ${tileData.buildingType} at ${tileData.x},${tileData.y}`);
      }
    }
    
    // CityManager stats (like revenue, happiness etc.) are already restored by cityManager.loadGame() itself.
    // No need to set this.cityManager.currentRevenue = savedState.revenue; here.

    this.uiManager.updateMetrics(); // Refresh UI with new data
    console.log('Game: City state loaded successfully.');
  }

  /**
   * Initiates the game loading sequence.
   * It calls the CityManager to load data from storage and then, if successful,
   * triggers the reconstruction of the city state via `loadCityState`.
   */
  triggerLoadGame() {
    console.log('Game: Triggering load game...');
    const savedState = this.cityManager.loadGame(); // CityManager.loadGame() already restores its own simple stats
    if (savedState && savedState.tiles && savedState.citySize !== undefined) {
      this.loadCityState(savedState);
    } else {
      console.log("Failed to load game data or data is incomplete.");
      // Optionally, provide UI feedback: this.uiManager.showNotification("Failed to load game data.");
    }
  }
}

window.onload = () => {
  // window.ui is already initialized in ui.js as: window.ui = new GameUI();
  // The Game constructor expects the GameUI instance.

  // Ensure the render target element exists, as GameUI constructor uses it.
  // GameUI uses 'render-target', the old conceptual uiManager used 'game-window'.
  // Let's assume 'render-target' is the correct one from ui.js.
  const renderTarget = document.getElementById('render-target'); 
  if (!renderTarget) {
    console.error('Error: Element with ID "render-target" not found. Please ensure it exists in your HTML.');
    // Display error prominently if core UI element is missing
    document.body.innerHTML = '<div style="color:red; font-size: 20px; padding: 20px;">Error: #render-target not found. Cannot initialize game UI.</div>';
    return;
  }
  
  // Ensure loading text element exists if hideLoadingText is used by GameUI (which it is)
  // ui.js GameUI constructor does not call hideLoadingText, Game.js constructor does.
  // Game.js calls this.uiManager.hideLoadingText() via window.assetManager callback.
  // So, window.ui (the GameUI instance) must be ready.
  if (!document.getElementById('loading')) { // ui.js uses 'loading'
      const loadingTextElement = document.createElement('div');
      loadingTextElement.id = 'loading';
      loadingTextElement.innerText = 'Loading...';
      // Prepend to body so it's likely visible
      document.body.prepend(loadingTextElement); 
      console.warn('Element with ID "loading" was not found. A dummy one was created.');
  }

  window.game = new Game(window.ui); // Pass the global GameUI instance
  window.ui.setCityManager(window.game.cityManager); // Set the cityManager reference in GameUI
};