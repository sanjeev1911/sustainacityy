/**
 * Manages the game's user interface, including toolbar interactions,
 * metrics display, and game state feedback (like pause or game over).
 */
export class GameUI {
  constructor() {
    /** @type {HTMLElement} The main game window element where the Three.js canvas is rendered. */
    this.gameWindow = document.getElementById('render-target'); // Make sure this is 'render-target' not 'game-window'
    /** @type {string} The ID of the currently active tool (e.g., 'road', 'residential'). */
    this.activeToolId = 'select'; // Default tool
    /** @type {boolean} Indicates if the game simulation is currently paused. */
    this.isPaused = false;
    /** @type {import('./sim/cityManager.js').CityManager | null} Reference to the CityManager instance. Set via `setCityManager`. */
    this.cityManager = null; // Initialize cityManager reference

    // Bind event listeners for toolbar buttons
    document.querySelectorAll('.ui-button').forEach(button => {
      button.addEventListener('click', this.onToolSelected.bind(this));
    });

    // Bind pause toggle
    const pauseButton = document.getElementById('button-pause');
    if (pauseButton) {
      pauseButton.addEventListener('click', this.togglePause.bind(this));
    }

    // Bind Save/Load buttons
    const saveButton = document.getElementById('button-save');
    if (saveButton) {
      saveButton.addEventListener('click', this.onSaveGame.bind(this));
    }
    const loadButton = document.getElementById('button-load');
    if (loadButton) {
      loadButton.addEventListener('click', this.onLoadGame.bind(this));
    }
  }

  /**
   * Handles the click event for the "Save Game" button.
   * Triggers the game saving process via the CityManager.
   */
  onSaveGame() {
    console.log('UI: Save button clicked');
    if (window.game && window.game.cityManager) {
      window.game.cityManager.saveGame();
      // Simple feedback, could be improved with a temporary message on screen
      alert('Game Saved!'); 
    } else {
      console.error('Cannot save game: Game or CityManager not initialized.');
      alert('Error: Could not save game.');
    }
  }

  /**
   * Handles the click event for the "Load Game" button.
   * Triggers the game loading process via the Game object after user confirmation.
   */
  onLoadGame() {
    console.log('UI: Load button clicked');
    if (window.game) {
      // Confirmation before loading, as it will overwrite current state
      if (confirm('Loading a saved game will overwrite your current progress. Are you sure?')) {
        window.game.triggerLoadGame();
        // Feedback that load was attempted. Game.js or CityManager could provide more specific feedback.
        // alert('Load process initiated.'); 
      }
    } else {
      console.error('Cannot load game: Game not initialized.');
      alert('Error: Could not load game.');
    }
  }

  onToolSelected(event) {
    const toolId = event.currentTarget.getAttribute('data-type');
    if (toolId) {
      console.log('Tool selected:', toolId);
      window.game.setTool(toolId); // Call Game’s setTool method
      this.activeToolId = toolId;

      // Update button styles
      document.querySelectorAll('.ui-button').forEach(button => {
        button.classList.remove('selected');
      });
      event.currentTarget.classList.add('selected');
    }
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    const pausedText = document.getElementById('paused-text');
    const pauseIcon = document.getElementById('pause-button-icon');
    if (pausedText) {
      pausedText.style.visibility = this.isPaused ? 'visible' : 'hidden';
    }
    if (pauseIcon) {
      pauseIcon.src = this.isPaused ? '/icons/play-color.png' : '/icons/pause-color.png';
    }
    console.log('Simulation paused:', this.isPaused);
  }

  /**
   * Sets the CityManager instance for the UI to interact with.
   * @param {import('./sim/cityManager.js').CityManager} cityManager - The CityManager instance.
   */
  setCityManager(cityManager) {
    this.cityManager = cityManager;
  }

  /**
   * Updates the metrics display in the UI (e.g., revenue, population, happiness)
   * using data from the CityManager.
   */
  updateMetrics() {
    if (!this.cityManager) {
      // console.warn('CityManager not set in GameUI, cannot update metrics.');
      return;
    }

    const revenue = this.cityManager.currentRevenue;
    // Assuming cityManager.city.population is the correct way to get population
    // If cityManager.city is not guaranteed, add a getter for population in cityManager
    const population = this.cityManager.city ? this.cityManager.city.population : 0; 
    const happiness = this.cityManager.currentHappiness;
    const pollution = this.cityManager.currentPollution;
    const lifespan = this.cityManager.currentLifespan;
    const date = new Date(); // Using current system date for now

    // Helper to update text content safely
    const updateElementText = (id, text) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = text;
      } else {
        // console.warn(`UI element with ID '${id}' not found.`);
      }
    };

    updateElementText('stats-revenue', '$' + revenue.toLocaleString());
    updateElementText('stats-population', population.toLocaleString());
    updateElementText('stats-happiness', Math.round(happiness) + '%');
    updateElementText('stats-pollution', Math.round(pollution) + ' units');
    updateElementText('stats-lifespan', Math.round(lifespan) + ' years');
    updateElementText('stats-date', date.toLocaleDateString());
  }
  
  /**
   * Displays the game over screen.
   * @param {string} reason - The reason for the game over, to be displayed to the player.
   */
  showGameOver(reason) {
    const gameOverOverlay = document.getElementById('game-over-overlay');
    const gameOverReasonEl = document.getElementById('game-over-reason'); // Renamed to avoid conflict with reason param

    if (gameOverOverlay) {
      if (gameOverReasonEl) {
        gameOverReasonEl.textContent = reason || "Your city has crumbled!";
      }
      gameOverOverlay.style.display = 'flex';
    } else {
      alert('Game Over! ' + (reason || "Your city has crumbled!")); // Fallback
    }
  }

  updateInfoPanel(selectedObject) {
    const infoPanel = document.getElementById('info-panel');
    if (!infoPanel) return;

    if (selectedObject && typeof selectedObject.toHTML === 'function') {
      infoPanel.innerHTML = selectedObject.toHTML();
    } else {
      infoPanel.innerHTML = '<p>No object selected</p>';
    }
  }

  hideLoadingText() {
    const loadingElement = document.getElementById('loading'); // Ensure this ID matches game.html
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
  }
}

// Initialize UI and expose globally
window.ui = new GameUI(); // Game.js will pass this to the Game constructor