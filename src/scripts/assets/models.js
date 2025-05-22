/**
 * Configuration object for all placeable building types.
 * Defines cost, capacity (for residential), maintenance, pollution output,
 * descriptive text, and potentially other type-specific properties for each building.
 *
 * @type {Object.<string, {
 *   cost: number,
 *   maintenance: number,
 *   pollution: number,
 *   description: string,
 *   capacity?: number, // Optional: For residential buildings
 *   powerOutput?: number // Optional: For power plants
 *   // Add other type-specific properties as needed
 * }>}
 */
export const buildingConfigurations = {
  road: {
    cost: 100,
    maintenance: 10,
    pollution: 1,
    description: 'Connects your city and allows for transport.'
  },
  residential: {
    cost: 750,
    capacity: 50,
    maintenance: 20,
    pollution: 2,
    description: 'Provides housing for your citizens.'
  },
  commercial: { // Added as a common type
    cost: 1000,
    maintenance: 50,
    pollution: 5,
    description: 'Provides jobs and services.'
  },
  industrial: { // Added as a common type
    cost: 1200,
    maintenance: 70,
    pollution: 20,
    description: 'Provides jobs and manufactures goods.'
  },
  'power-plant': { // From BuildingType.js
    cost: 5000,
    maintenance: 250,
    pollution: 30,
    powerOutput: 1000, // Example custom property
    description: 'Generates power for your city.'
  },
  'power-line': { // From BuildingType.js
    cost: 50,
    maintenance: 5,
    pollution: 0,
    description: 'Transmits power across your city.'
  }
  // Add other building types like 'firestation', 'police', 'park' as needed
  // based on activeToolId values used in ui.js and Game.js.
};

export default { // Keep existing models export for 3D model data
  "under-construction": {
    "type": "zone",
    "filename": "construction-small.glb",
    "scale": 3
  },
  "residential-A1": {
    "type": "zone",
    "filename": "building-house-block-big.glb"
  },
  "residential-B1": {
    "type": "zone",
    "filename": "building-house-family-small.glb"
  },
  "residential-C1": {
    "type": "zone",
    "filename": "building-house-family-large.glb"
  },
  "residential-A2": {
    "type": "zone",
    "filename": "building-block-4floor-short.glb",
  },
  "residential-B2": {
    "type": "zone",
    "filename": "building-block-4floor-corner.glb",
  },
  "residential-C2": {
    "type": "zone",
    "filename": "building-block-5floor.glb",
  },
  "residential-A3": {
    "type": "zone",
    "filename": "building-office-balcony.glb"
  },
  "residential-B3": {
    "type": "zone",
    "filename": "building-office-pyramid.glb"
  },
  "residential-C3": {
    "type": "zone",
    "filename": "building-office-tall.glb"
  },
  "commercial-A1": {
    "type": "zone",
    "filename": "building-cafe.glb"
  },
  "commercial-B1": {
    "type": "zone",
    "filename": "building-burger-joint.glb"
  },
  "commercial-C1": {
    "type": "zone",
    "filename": "building-restaurant.glb"
  },
  "commercial-A2": {
    "type": "zone",
    "filename": "building-cinema.glb"
  },
  "commercial-B2": {
    "type": "zone",
    "filename": "building-casino.glb"
  },
  "commercial-C2": {
    "type": "zone",
    "filename": "data-center.glb"
  },
  "commercial-A3": {
    "type": "zone",
    "filename": "building-office.glb"
  },
  "commercial-B3": {
    "type": "zone",
    "filename": "building-office-big.glb"
  },
  "commercial-C3": {
    "type": "zone",
    "filename": "building-skyscraper.glb"
  },
  "industrial-A1": {
    "type": "zone",
    "filename": "industry-factory.glb"
  },
  "industrial-B1": {
    "type": "zone",
    "filename": "industry-refinery.glb"
  },
  "industrial-C1": {
    "type": "zone",
    "filename": "industry-warehouse.glb"
  },
  "industrial-A2": {
    "type": "zone",
    "filename": "industry-factory.glb"
  },
  "industrial-B2": {
    "type": "zone",
    "filename": "industry-refinery.glb"
  },
  "industrial-C2": {
    "type": "zone",
    "filename": "industry-warehouse.glb"
  },
  "industrial-A3": {
    "type": "zone",
    "filename": "industry-factory.glb"
  },
  "industrial-B3": {
    "type": "zone",
    "filename": "industry-refinery.glb"
  },
  "industrial-C3": {
    "type": "zone",
    "filename": "industry-warehouse.glb"
  },
  "power-plant": {
    "type": "power",
    "filename": "industry-factory-old.glb"
  },
  "power-line": {
    "type": "power",
    "filename": "power_line_pole_modified.glb"
  },
  "road-straight": {
    "type": "road",
    "filename": "tile-road-straight.glb",
    "castShadow": false
  },
  "road-end": {
    "type": "road",
    "filename": "tile-road-end.glb",
    "castShadow": false
  },
  "road-corner": {
    "type": "road",
    "filename": "tile-road-curve.glb",
    "castShadow": false
  },
  "road-three-way": {
    "type": "road",
    "filename": "tile-road-intersection-t.glb",
    "castShadow": false
  },
  "road-four-way": {
    "type": "road",
    "filename": "tile-road-intersection.glb",
    "castShadow": false
  },
  "grass": {
    "type": "terrain",
    "filename": "tile-plain_grass.glb",
    "castShadow": false
  },
  "car-taxi": {
    "type": "vehicle",
    "filename": "car-taxi.glb",
    "rotation": 90
  },
  "car-police": {
    "type": "vehicle",
    "filename": "car-police.glb",
    "rotation": 90
  },
  "car-passenger": {
    "type": "vehicle",
    "filename": "car-passenger.glb",
    "rotation": 90
  },
  "car-veteran": {
    "type": "vehicle",
    "filename": "car-veteran.glb",
    "rotation": 90
  },
  "truck": {
    "type": "vehicle",
    "filename": "truck.glb",
    "rotation": 90
  },
  "car-hippie-van": {
    "type": "vehicle",
    "filename": "car-hippie-van.glb",
    "rotation": 90
  },
  "car-tow-truck": {
    "type": "vehicle",
    "filename": "car-tow-truck.glb",
    "rotation": 90
  },
  "car-ambulance-pickup": {
    "type": "vehicle",
    "filename": "car-ambulance-pickup.glb",
    "rotation": 90
  },
  "car-passenger-race": {
    "type": "vehicle",
    "filename": "car-passenger-race.glb",
    "rotation": 90
  },
  "car-baywatch": {
    "type": "vehicle",
    "filename": "car-baywatch.glb",
    "rotation": 90
  },
  "car-truck-dump": {
    "type": "vehicle",
    "filename": "car-truck-dump.glb",
    "rotation": 90
  },
  "car-truck-armored-truck": {
    "type": "vehicle",
    "filename": "armored-truck.glb",
    "rotation": 90
  }
}