/**
 * Timeline Date Range Slider
 * Filters map markers based on a date range with dual slider handles
 */

window.TimelineDateSlider = {
  /**
   * Initialize the timeline slider
   * @param {Object} options - Configuration options
   *   - features: Array of feature objects (from API response)
   *   - containerSelector: CSS selector for the slider container
   *   - onDateRangeChange: Callback when date range changes
   */
  init: function(options) {
    this.features = options.features || [];
    this.containerSelector = options.containerSelector || '.timeline-date-slider-container';
    this.onDateRangeChange = options.onDateRangeChange || function() {};
    
    // Extract unique dates from features
    this.allDates = this.extractAndSortDates();
    
    if (this.allDates.length === 0) {
      return;
    }

    // Initialize min/max dates
    this.minDate = new Date(this.allDates[0]);
    this.maxDate = new Date(this.allDates[this.allDates.length - 1]);
    this.currentMinDate = new Date(this.minDate);
    this.currentMaxDate = new Date(this.maxDate);

    // Calculate step interval based on date range
    this.determineStepInterval();

    // Create the slider HTML (this will also setup handlers and generate labels after loading)
    this.createSliderHTML();
  },

  /**
   * Extract unique dates from features and sort them
   */
  extractAndSortDates: function() {
    const dateSet = new Set();
    
    this.features.forEach((feature, idx) => {
      const dates = feature.dates || feature[5] || []; // Dates are at index 5 in the array
      
      if (Array.isArray(dates)) {
        dates.forEach(dateStr => {
          if (dateStr) {
            const date = this.parseDate(dateStr);
            if (date) {
              dateSet.add(date.getTime());
            }
          }
        });
      }
    });

    // Convert timestamps to sorted unique dates
    const uniqueDates = Array.from(dateSet)
      .sort((a, b) => a - b)
      .map(timestamp => new Date(timestamp));
    
    return uniqueDates;
  },

  /**
   * Parse various date formats
   */
  parseDate: function(dateStr) {
    if (!dateStr) return null;
    
    // Try standard ISO format first
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try DD/MM/YYYY format (common in Europe)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/');
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Try YYYY format (year only)
    if (/^\d{4}$/.test(dateStr)) {
      date = new Date(parseInt(dateStr), 0, 1);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Try YYYY-MM format
    if (/^\d{4}-\d{2}$/.test(dateStr)) {
      const [year, month] = dateStr.split('-');
      date = new Date(parseInt(year), parseInt(month) - 1, 1);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    return null;
  },

  /**
   * Determine the best step interval based on date range
   */
  determineStepInterval: function() {
    const diff = this.maxDate - this.minDate;
    const days = diff / (1000 * 60 * 60 * 24);

    if (days <= 31) {
      // Less than a month: show daily steps
      this.stepInterval = 'daily';
      this.stepSize = 1000 * 60 * 60 * 24; // 1 day in ms
    } else if (days <= 365) {
      // Less than a year: show monthly steps
      this.stepInterval = 'monthly';
      this.stepSize = null; // Varies
    } else if (days <= 365 * 10) {
      // Less than 10 years: show yearly steps
      this.stepInterval = 'yearly';
      this.stepSize = null; // Varies
    } else {
      // More than 10 years: show multi-year steps (every 5 years)
      this.stepInterval = 'yearly';
      this.stepSize = null; // Varies
    }
  },

  /**
   * Create the slider DOM structure
   */
  createSliderHTML: function() {
    const container = document.querySelector(this.containerSelector);
    
    if (!container) {
      return;
    }
    
    const self = this;
    
    // Create the slider HTML (using inline template)
    this.createSliderHTMLInline(container);
    
    // Setup event handlers and generate labels
    this.setupEventHandlers();
    this.generateStepLabels();
  },

  /**
   * Create slider HTML with inline template
   */
  createSliderHTMLInline: function(container) {
    container.innerHTML = `
      <div class="timeline-slider-wrapper" id="timeline-slider-wrapper">
        <div class="timeline-slider-date-label timeline-slider-date-left">
          <div class="date-label">Start Date</div>
          <div class="date-value" id="timeline-min-date-display">${this.formatDateDisplay(this.minDate)}</div>
        </div>

        <div class="timeline-slider-main">
          <div class="timeline-slider-container">
            <div class="timeline-slider-track">
              <div class="timeline-slider-range" id="timeline-slider-range"></div>
              <div class="timeline-slider-steps" id="timeline-slider-steps"></div>
            </div>
            
            <input 
              type="range" 
              id="timeline-slider-min" 
              class="timeline-slider-input timeline-slider-min"
              min="0" 
              max="100" 
              value="0"
              step="0.01">
            
            <input 
              type="range" 
              id="timeline-slider-max" 
              class="timeline-slider-input timeline-slider-max"
              min="0" 
              max="100" 
              value="100"
              step="0.01">
          </div>
        </div>

        <div class="timeline-slider-date-label timeline-slider-date-right">
          <div class="date-label">End Date</div>
          <div class="date-value" id="timeline-max-date-display">${this.formatDateDisplay(this.maxDate)}</div>
        </div>
      </div>
    `;
  },

  /**
   * Setup event handlers for the sliders
   */
  setupEventHandlers: function() {
    const minInput = document.getElementById('timeline-slider-min');
    const maxInput = document.getElementById('timeline-slider-max');

    if (!minInput || !maxInput) {
      console.error('Slider inputs not found');
      return;
    }

    // Handle min slider change
    minInput.addEventListener('input', (e) => {
      let minVal = parseFloat(e.target.value);
      const maxVal = parseFloat(maxInput.value);

      // Prevent crossing
      if (minVal > maxVal) {
        minVal = maxVal;
        e.target.value = minVal;
      }

      this.updateSliderRange(minVal, maxVal);
      this.updateDateDisplay();
      this.applyDateFilter();
    });

    // Handle max slider change
    maxInput.addEventListener('input', (e) => {
      let maxVal = parseFloat(e.target.value);
      const minVal = parseFloat(minInput.value);

      // Prevent crossing
      if (maxVal < minVal) {
        maxVal = minVal;
        e.target.value = maxVal;
      }

      this.updateSliderRange(minVal, maxVal);
      this.updateDateDisplay();
      this.applyDateFilter();
    });
  },

  /**
   * Update the visual range bar
   */
  updateSliderRange: function(minVal, maxVal) {
    const range = document.getElementById('timeline-slider-range');
    if (range) {
      range.style.left = minVal + '%';
      range.style.right = (100 - maxVal) + '%';
    }
  },

  /**
   * Update the date display values
   */
  updateDateDisplay: function() {
    const minInput = document.getElementById('timeline-slider-min');
    const maxInput = document.getElementById('timeline-slider-max');
    const minDisplay = document.getElementById('timeline-min-date-display');
    const maxDisplay = document.getElementById('timeline-max-date-display');

    if (minInput && minDisplay) {
      const minPercent = parseFloat(minInput.value);
      this.currentMinDate = this.getDateAtPercent(minPercent);
      minDisplay.textContent = this.formatDateDisplay(this.currentMinDate);
    }

    if (maxInput && maxDisplay) {
      const maxPercent = parseFloat(maxInput.value);
      this.currentMaxDate = this.getDateAtPercent(maxPercent);
      maxDisplay.textContent = this.formatDateDisplay(this.currentMaxDate);
    }
  },

  /**
   * Get date at a specific percentage along the slider
   */
  getDateAtPercent: function(percent) {
    const dateRange = this.maxDate - this.minDate;
    const offset = (percent / 100) * dateRange;
    return new Date(this.minDate.getTime() + offset);
  },

  /**
   * Format date for display
   */
  formatDateDisplay: function(date) {
    if (!date) return '';
    
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  },

  /**
   * Generate and display step labels
   */
  generateStepLabels: function() {
    const stepsContainer = document.getElementById('timeline-slider-steps');
    if (!stepsContainer) return;

    stepsContainer.innerHTML = '';

    if (this.stepInterval === 'daily') {
      this.generateDailySteps(stepsContainer);
    } else if (this.stepInterval === 'monthly') {
      this.generateMonthlySteps(stepsContainer);
    } else if (this.stepInterval === 'yearly') {
      this.generateYearlySteps(stepsContainer);
    }
  },

  /**
   * Generate daily step labels
   */
  generateDailySteps: function(container) {
    const stepsCount = Math.min(10, Math.ceil(this.allDates.length / 5));
    const step = Math.floor(this.allDates.length / stepsCount);

    for (let i = 0; i < this.allDates.length; i += step) {
      const date = this.allDates[i];
      const percent = (i / (this.allDates.length - 1)) * 100;

      const stepLabel = document.createElement('div');
      stepLabel.className = 'timeline-step';
      stepLabel.style.left = percent + '%';
      
      const label = document.createElement('span');
      label.className = 'timeline-step-label';
      label.textContent = this.formatDateForStep(date);
      
      stepLabel.appendChild(label);
      container.appendChild(stepLabel);
    }
  },

  /**
   * Generate monthly step labels
   */
  generateMonthlySteps: function(container) {
    const monthMap = new Map();
    
    // Group all dates by year-month
    this.allDates.forEach((date, index) => {
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap.has(yearMonth)) {
        monthMap.set(yearMonth, { date, index });
      }
    });

    // Show every Nth month to avoid overcrowding
    const months = Array.from(monthMap.values());
    const maxLabels = 10;
    const step = Math.max(1, Math.ceil(months.length / maxLabels));

    months.forEach((entry, idx) => {
      if (idx % step === 0) {
        const percent = (entry.index / (this.allDates.length - 1)) * 100;

        const stepLabel = document.createElement('div');
        stepLabel.className = 'timeline-step';
        stepLabel.style.left = percent + '%';
        
        const label = document.createElement('span');
        label.className = 'timeline-step-label';
        label.textContent = `${entry.date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}`;
        
        stepLabel.appendChild(label);
        container.appendChild(stepLabel);
      }
    });
  },

  /**
   * Generate yearly step labels
   */
  generateYearlySteps: function(container) {
    const yearMap = new Map();
    
    // Group all dates by year
    this.allDates.forEach((date, index) => {
      const year = date.getFullYear();
      if (!yearMap.has(year)) {
        yearMap.set(year, { date, index });
      }
    });

    // Show every Nth year to avoid overcrowding
    const years = Array.from(yearMap.values());
    const maxLabels = 8;
    const step = Math.max(1, Math.ceil(years.length / maxLabels));

    years.forEach((entry, idx) => {
      if (idx % step === 0) {
        const percent = (entry.index / (this.allDates.length - 1)) * 100;

        const stepLabel = document.createElement('div');
        stepLabel.className = 'timeline-step';
        stepLabel.style.left = percent + '%';
        
        const label = document.createElement('span');
        label.className = 'timeline-step-label';
        label.textContent = entry.date.getFullYear();
        
        stepLabel.appendChild(label);
        container.appendChild(stepLabel);
      }
    });
  },

  /**
   * Format date for step labels
   */
  formatDateForStep: function(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  /**
   * Apply date filter to features
   */
  applyDateFilter: function() {
    const minDateMS = this.currentMinDate.getTime();
    const maxDateMS = this.currentMaxDate.getTime();

    const filteredFeatures = this.features.filter(feature => {
      const dates = feature.dates || feature[5] || [];
      
      if (!Array.isArray(dates) || dates.length === 0) {
        return true; // Include features with no dates
      }

      // Check if any date falls within the selected range
      return dates.some(dateStr => {
        const date = this.parseDate(dateStr);
        if (!date) return true;
        
        const dateMS = date.getTime();
        return dateMS >= minDateMS && dateMS <= maxDateMS;
      });
    });

    // Call the callback with filtered features
    this.onDateRangeChange({
      minDate: this.currentMinDate,
      maxDate: this.currentMaxDate,
      filteredFeatures: filteredFeatures,
    });
  },

  /**
   * Get filtered features
   */
  getFilteredFeatures: function() {
    return this.filteredFeatures || this.features;
  },
};
