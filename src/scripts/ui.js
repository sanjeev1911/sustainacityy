export class GameUI {
  constructor() {
    this.gameWindow = document.getElementById('render-target');
    this.activeToolId = 'select'; // Default tool
    this.isPaused = false;

    // Bind event listeners for toolbar buttons
    document.querySelectorAll('.ui-button').forEach(button => {
      button.addEventListener('click', this.onToolSelected.bind(this));
    });

    // Bind pause toggle
    const pauseButton = document.getElementById('button-pause');
    if (pauseButton) {
      pauseButton.addEventListener('click', this.togglePause.bind(this));
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

  updateTitleBar(game) {
    if (!game) return;
    window.updateMetrics(); // Leverage game.html’s updateMetrics function
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
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
  }
}

// Initialize UI and expose globally
window.ui = new GameUI();