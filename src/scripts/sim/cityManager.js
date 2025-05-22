import { CONFIG } from '../config.js';
import { buildingConfigurations } from '../assets/models.js';

/**
 * Manages the overall city simulation state, including finances, citizen metrics, and time-based events.
 * It calculates revenue, costs, pollution, happiness, and checks for game over conditions.
 */
export class CityManager {
  /**
   * Creates an instance of CityManager.
   * @param {import('./city.js').City} city - A reference to the City object.
   * @param {number} [initialRevenue=10000] - The starting revenue for the city.
   */
  constructor(city, initialRevenue = 10000) {
    /** @type {import('./city.js').City} Reference to the city instance. */
    this.city = city;
    /** @type {number} The current total revenue of the city. */
    this.revenue = initialRevenue;
    /** @type {number} The total maintenance cost for all buildings in the current simulation tick. */
    this.maintenanceCost = 0;
    /** @type {number} The current overall pollution level in the city. */
    this.pollution = 0;
    /** @type {number} The current overall happiness level of citizens (0-100). */
    this.happiness = 100; // Initial happiness
    /** @type {number} The average lifespan of citizens in simulation ticks, affected by happiness and pollution. */
    this.lifespan = CONFIG.citizenLifespan; // Average lifespan in simulation ticks
    /** @type {number} The revenue threshold below which the game is over. */
    this.gameOverThreshold = 0;
  }

  /**
   * Deducts a specified amount from the city's revenue.
   * @param {number} amount - The amount to deduct.
   */
  deductRevenue(amount) {
    this.revenue -= amount;
  }

  /**
   * Updates the core simulation statistics based on the current city state.
   * This includes tax revenue, maintenance costs, pollution, happiness, and lifespan adjustments.
   * @param {Array<import('./buildings/building.js').Building>} buildingsArray - An array of all building objects in the city.
   * @param {number} population - The current total population of the city.
   * @returns {{gameOver: boolean}} Object indicating if a game over condition was met.
   */
  simulateStats(buildingsArray, population) {
    // Calculate revenue from taxes
    const taxRevenue = population * CONFIG.taxRate;
    this.revenue += taxRevenue;

    // Calculate maintenance costs and pollution from buildings
    this.maintenanceCost = 0;
    this.pollution = 0;
    for (const building of buildingsArray) {
      const config = buildingConfigurations[building.type];
      if (config) {
        this.maintenanceCost += config.maintenance || 0;
        this.pollution += config.pollution || 0;
      }
    }
    this.revenue -= this.maintenanceCost;

    // Calculate happiness
    // Simplified: high taxes or pollution decreases happiness
    let happinessReduction = 0;
    if (CONFIG.taxRate > 0.1) { // Example: Tax rate above 10% is high
      happinessReduction += (CONFIG.taxRate - 0.1) * 100; // Reduce happiness proportionally
    }
    happinessReduction += this.pollution * 0.5; // Pollution impact

    this.happiness = Math.max(0, 100 - happinessReduction); // Ensure happiness doesn't go below 0

    // Adjust lifespan based on happiness (simple model)
    // Ensure happiness is not NaN or undefined before using it in calculations
    const currentHappiness = isNaN(this.happiness) ? 50 : this.happiness; // Default to 50 if NaN

    if (currentHappiness < 50) {
      this.lifespan = CONFIG.citizenLifespan * (currentHappiness / 50); // Reduced lifespan if unhappy
    } else {
      this.lifespan = CONFIG.citizenLifespan; // Normal lifespan if reasonably happy
    }
    this.lifespan = Math.max(1, this.lifespan); // Lifespan should not be less than 1

    // Check for game over
    if (this.revenue < this.gameOverThreshold) {
      return { gameOver: true };
    }

    return { gameOver: false };
  }

  // Getters for stats
  /** @returns {number} The current revenue. */
  get currentRevenue() {
    return this.revenue;
  }

  /** @returns {number} The current pollution level. */
  get currentPollution() {
    return this.pollution;
  }

  /** @returns {number} The current happiness level. */
  get currentHappiness() {
    return this.happiness;
  }

  /** @returns {number} The current average citizen lifespan. */
  get currentLifespan() {
    return this.lifespan;
  }

  /** @returns {number} The current total maintenance cost. */
  get currentMaintenanceCost() {
    return this.maintenanceCost;
  }

  /**
   * Saves the current game state to localStorage.
   * Serializes revenue, happiness, pollution, lifespan, city size, and detailed tile/building data.
   */
  saveGame() {
    console.log('CityManager: Saving game...');
    try {
      const tilesData = [];
      for (let x = 0; x < this.city.size; x++) {
        for (let y = 0; y < this.city.size; y++) {
          const tile = this.city.getTile(x, y);
          if (tile && tile.building) {
            const tileEntry = {
              x: tile.x,
              y: tile.y,
              buildingType: tile.building.type,
            };
            if (tile.building.type === 'residential' && tile.building.residents) {
              tileEntry.residents = tile.building.residents.count;
              tileEntry.buildingCapacity = tile.building.capacity;
            }
            tilesData.push(tileEntry);
          }
        }
      }

      const gameState = {
        timestamp: new Date().toISOString(),
        revenue: this.revenue,
        happiness: this.happiness,
        pollution: this.pollution,
        lifespan: this.lifespan,
        citySize: this.city.size,
        tiles: tilesData,
        // Note: Game.js buildings array and buildingCounts will be rebuilt from tiles.
        // City.js simTime could also be saved if relevant for simulation state.
      };

      const jsonString = JSON.stringify(gameState);
      localStorage.setItem('citySimSaveData', jsonString);
      console.log('Game saved successfully to localStorage.');
      // Optionally, provide UI feedback through a callback or event (e.g., window.ui.showNotification('Game Saved!'))
    } catch (error) {
      console.error('Error saving game:', error);
      // Optionally, provide UI feedback (e.g., window.ui.showNotification('Error saving game.', 'error'))
    }
  }

  /**
   * Loads game state from localStorage.
   * Restores CityManager's simple stats (revenue, happiness, etc.) directly.
   * @returns {object|null} The full savedState object if successful (for Game.js to reconstruct city details), otherwise null.
   */
  loadGame() {
    console.log('CityManager: Loading game...');
    try {
      const jsonString = localStorage.getItem('citySimSaveData');
      if (!jsonString) {
        console.log('No saved game data found in localStorage.');
        return null; // Or false, to indicate no data
      }

      const savedState = JSON.parse(jsonString);
      
      // Directly restore simple stats in CityManager
      this.revenue = savedState.revenue !== undefined ? savedState.revenue : this.revenue;
      this.happiness = savedState.happiness !== undefined ? savedState.happiness : this.happiness;
      this.pollution = savedState.pollution !== undefined ? savedState.pollution : this.pollution;
      this.lifespan = savedState.lifespan !== undefined ? savedState.lifespan : this.lifespan;
      // citySize and tiles will be handled by Game.js using the returned savedState

      console.log('Game data loaded and parsed successfully from localStorage.');
      return savedState; // Return the full state for Game.js to handle city reconstruction
    } catch (error) {
      console.error('Error loading game:', error);
      return null; // Or false, to indicate failure
    }
  }
}
