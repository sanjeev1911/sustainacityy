import * as THREE from 'three';
import { BuildingType } from './buildings/buildingType.js';
import { buildingConfigurations } from '../assets/models.js'; // Import buildingConfigurations

// Configurable constants for resident simulation
const RESIDENT_GROWTH_RATE_HIGH_HAPPINESS = 0.05;
const RESIDENT_DECLINE_RATE_HIGH_POLLUTION = 0.05;
const HAPPINESS_THRESHOLD_FOR_GROWTH = 60;
const POLLUTION_THRESHOLD_FOR_DECLINE = 100;
import { createBuilding } from './buildings/buildingFactory.js';
import { Tile } from './tile.js';
import { VehicleGraph } from './vehicles/vehicleGraph.js';
import { PowerService } from './services/power.js';
import { SimService } from './services/simService.js';

/**
 * Represents a group of residents within a residential building.
 * Manages population count based on happiness, pollution, and building capacity.
 */
class Residents {
  /**
   * Creates an instance of Residents.
   * @param {number} initialCapacity - The maximum number of residents this instance can hold (typically the building's capacity).
   */
  constructor(initialCapacity) { 
    /** @type {number} The maximum capacity of residents this instance can hold. */
    this.maxCapacity = initialCapacity; 
    /** @type {number} The current number of residents. Starts at a default low value. */
    this.count = 20; // Start low, not 100
  }

  /**
   * Simulates resident population changes based on city conditions.
   * Population can grow or decline based on happiness and pollution levels,
   * and is capped by the current building capacity.
   * @param {number} happiness - The current city happiness level (0-100).
   * @param {number} pollution - The current city pollution level.
   * @param {number} currentCapacity - The effective maximum capacity for residents in the building.
   */
  simulate(happiness, pollution, currentCapacity) {
    const growthFactor = (happiness > HAPPINESS_THRESHOLD_FOR_GROWTH ? RESIDENT_GROWTH_RATE_HIGH_HAPPINESS : 0) - 
                         (pollution > POLLUTION_THRESHOLD_FOR_DECLINE ? RESIDENT_DECLINE_RATE_HIGH_POLLUTION : 0);
    this.count += this.count * growthFactor;
    // Ensure count does not exceed currentCapacity and is not less than 0
    this.count = Math.max(0, Math.min(Math.floor(this.count), currentCapacity));
    // Log currentCapacity instead of this.maxCapacity if they can differ. For now, they might be the same.
    console.log(`Residents simulated: ${this.count}/${currentCapacity}, Happiness: ${happiness}, Pollution: ${pollution}`);
  }

  dispose() {
    console.log(`Disposing ${this.count} residents`);
  }
}

/**
 * Represents the game's city, managing tiles, buildings, and their simulation.
 * Extends THREE.Group to be added directly to the Three.js scene.
 */
export class City extends THREE.Group {
  /** @type {THREE.Group} For debug visualizations. */
  debugMeshes = new THREE.Group();
  /** @type {THREE.Group} Root object for all city visuals (tiles, buildings). */
  root = new THREE.Group();
  services = [];
  size = 16;
  simTime = 0;
  tiles = [];
  vehicleGraph;

  constructor(size, name = 'My City') {
    super();
    this.name = name;
    this.size = size;

    this.add(this.debugMeshes);
    this.add(this.root);

    this.tiles = [];
    for (let x = 0; x < this.size; x++) {
      const column = [];
      for (let y = 0; y < this.size; y++) {
        const tile = new Tile(x, y);
        tile.refreshView(this);
        this.root.add(tile);
        column.push(tile);
      }
      this.tiles.push(column);
    }

    this.services = [new PowerService()];
    this.vehicleGraph = new VehicleGraph(this.size);
    this.debugMeshes.add(this.vehicleGraph);
  }

  get population() {
    let population = 0;
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const tile = this.getTile(x, y);
        population += tile.building?.residents?.count || 0;
      }
    }
    console.log('City.population:', population);
    return population;
  }

  getTile(x, y) {
    if (x === undefined || y === undefined || x < 0 || y < 0 || x >= this.size || y >= this.size) {
      return null;
    }
    return this.tiles[x][y];
  }

  simulate(steps = 1) {
    let count = 0;
    while (count++ < steps) {
      this.services.forEach(service => service.simulate(this));
    // Access cityManager through window.game as established in previous steps
    const cityManager = window.game.cityManager;
    const currentHappiness = cityManager ? cityManager.currentHappiness : 50; // Default if not found
    const currentPollution = cityManager ? cityManager.currentPollution : 0; // Default if not found

      for (let x = 0; x < this.size; x++) {
        for (let y = 0; y < this.size; y++) {
          const tile = this.getTile(x, y);
        if (tile.building?.residents && tile.building.capacity !== undefined) {
          tile.building.residents.simulate(currentHappiness, currentPollution, tile.building.capacity);
          }
          tile.simulate(this);
        }
      }
    }
    this.simTime++;
  }

  placeBuilding(x, y, buildingType) {
    const tile = this.getTile(x, y);
    console.log('City.placeBuilding called:', x, y, buildingType, 'Tile:', tile?.constructor.name || 'null');

    if (tile && !tile.building) {
      const config = buildingConfigurations[buildingType];
      if (!config) {
        console.error(`No configuration found for building type: ${buildingType}`);
        return null;
      }

      const building = createBuilding(x, y, buildingType); // createBuilding should just create the mesh and basic object
      if (building) {
        // Assign properties from config to the building instance
        building.type = buildingType; // Ensure type is set from the parameter used to get config
        building.maintenanceCost = config.maintenance;
        building.pollutionEffect = config.pollution;
        // Add any other relevant properties from config
        // building.someOtherProperty = config.someOtherProperty;


        console.log('Building created:', building.constructor.name, 'Type:', building.type);
        tile.setBuilding(building); // This sets tile.building = building
        tile.refreshView(this);

        if (buildingType === BuildingType.residential) { // Using BuildingType.residential for direct comparison
          if (config.capacity !== undefined) {
            building.capacity = config.capacity; // Set capacity from config
            building.residents = new Residents(building.capacity); // Pass building's capacity to Residents
            console.log('Assigned residents:', building.residents, 'with capacity:', building.capacity);
          } else {
            console.warn(`Capacity not defined in buildingConfigurations for ${buildingType}. Residents module may not function correctly.`);
          }
        }

        this.getTile(x - 1, y)?.refreshView(this);
        this.getTile(x + 1, y)?.refreshView(this);
        this.getTile(x, y - 1)?.refreshView(this);
        this.getTile(x, y + 1)?.refreshView(this);

        if (building.type === BuildingType.road) {
          this.vehicleGraph.updateTile(x, y, building);
        }
        return building;
      } else {
        console.log('Building creation failed for:', buildingType);
      }
    } else {
      console.log('Cannot place: Tile missing or already has building at:', x, y);
    }
    return null;
  }

  bulldoze(x, y) {
    const tile = this.getTile(x, y);
    if (tile && tile.building) {
      const building = tile.building;
      console.log('Bulldozing building at:', x, y, 'Type:', building.type);
      if (building.type === BuildingType.road) {
        this.vehicleGraph.updateTile(x, y, null);
      }
      building.dispose?.();
      tile.setBuilding(null);
      tile.refreshView(this);

      this.getTile(x - 1, y)?.refreshView(this);
      this.getTile(x + 1, y)?.refreshView(this);
      this.getTile(x, y - 1)?.refreshView(this);
      this.getTile(x, y + 1)?.refreshView(this);

      return building;
    }
    console.log('Nothing to bulldoze at:', x, y);
    return null;
  }

  draw() {
    this.vehicleGraph.updateVehicles();
  }

  findTile(start, filter, maxDistance) {
    const startTile = this.getTile(start.x, start.y);
    if (!startTile) return null;

    const visited = new Set();
    const tilesToSearch = [startTile];

    while (tilesToSearch.length > 0) {
      const tile = tilesToSearch.shift();
      if (visited.has(tile.id)) continue;
      visited.add(tile.id);

      const distance = startTile.distanceTo(tile);
      if (distance > maxDistance) continue;

      tilesToSearch.push(...this.getTileNeighbors(tile.x, tile.y));
      if (filter(tile)) return tile;
    }
    return null;
  }

  getTileNeighbors(x, y) {
    const neighbors = [];
    if (x > 0) neighbors.push(this.getTile(x - 1, y));
    if (x < this.size - 1) neighbors.push(this.getTile(x + 1, y));
    if (y > 0) neighbors.push(this.getTile(x, y - 1));
    if (y < this.size - 1) neighbors.push(this.getTile(x, y + 1));
    return neighbors.filter(n => n !== null);
  }

  /**
   * Clears all buildings from the city and disposes of their associated resources.
   * This method is crucial for resetting the city state, for example, when loading a new game.
   * It iterates through all tiles, removes and disposes of any buildings, clears visual elements,
   * and resets the logical tile and vehicle graph data.
   */
  disposeAllBuildingsAndTiles() {
    console.log('City: Disposing all buildings and tiles...');
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const tile = this.getTile(x, y);
        if (tile) {
          if (tile.building) {
            // If building has a specific dispose method (e.g., for complex Three.js objects)
            if (typeof tile.building.dispose === 'function') {
              tile.building.dispose();
            }
            tile.setBuilding(null); // Removes building from tile, and from tile's THREE.Group
          }
          // If tile itself has a dispose method (e.g., for its own mesh)
          if (typeof tile.dispose === 'function') {
            tile.dispose();
          }
          // Remove tile's visual components from the main root group if they were added directly
          // this.root.remove(tile); // Assuming tile is a THREE.Object3D added to this.root
        }
      }
    }
    // Clear the main container of all tile/building visuals
    while(this.root.children.length > 0){ 
      const child = this.root.children[0];
      this.root.remove(child);
      // If children also have dispose methods (e.g. meshes), call them
      if (typeof child.dispose === 'function') {
        child.dispose();
      }
    }

    this.tiles = []; // Reset the logical tile array
    this.vehicleGraph.dispose(); // Assuming VehicleGraph has a dispose method to clear its data/visuals
    this.debugMeshes.clear(); // Clear any debug meshes

    console.log('City: All buildings and tiles disposed.');
  }
}