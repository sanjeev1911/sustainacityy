import * as THREE from 'three';
import { BuildingType } from './buildings/buildingType.js';
import { createBuilding } from './buildings/buildingFactory.js';
import { Tile } from './tile.js';
import { VehicleGraph } from './vehicles/vehicleGraph.js';
import { PowerService } from './services/power.js';
import { SimService } from './services/simService.js';

class Residents {
  constructor(maxCapacity) {
    this.maxCapacity = maxCapacity; // Max residents (e.g., 200)
    this.count = 20; // Start low, not 100
  }

  simulate(happiness, pollution) {
    // Growth rate: +5% if happiness > 60, -5% if pollution > 100, capped at maxCapacity
    const growthFactor = (happiness > 60 ? 0.05 : 0) - (pollution > 100 ? 0.05 : 0);
    this.count += this.count * growthFactor;
    this.count = Math.max(0, Math.min(this.maxCapacity, Math.floor(this.count)));
    console.log(`Residents simulated: ${this.count}/${this.maxCapacity}, Happiness: ${happiness}, Pollution: ${pollution}`);
  }

  dispose() {
    console.log(`Disposing ${this.count} residents`);
  }
}

export class City extends THREE.Group {
  debugMeshes = new THREE.Group();
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
      for (let x = 0; x < this.size; x++) {
        for (let y = 0; y < this.size; y++) {
          const tile = this.getTile(x, y);
          if (tile.building?.residents) {
            tile.building.residents.simulate(window.game.happiness, window.game.pollution);
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
      const building = createBuilding(x, y, buildingType);
      if (building) {
        console.log('Building created:', building.constructor.name, 'Type:', building.type);
        tile.setBuilding(building);
        tile.refreshView(this);

        if (building.type === BuildingType.residential) {
          building.residents = new Residents(200); // Max 200, starts at 20
          console.log('Assigned residents:', building.residents);
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
}