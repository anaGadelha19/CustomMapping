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
    
    // Initialize the range fill with the full span since sliders start at 0 and 100
    this.updateSliderRange(0, 100);
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
    } else if (days <= 100) {
      // 1-3 months: show weekly steps
      this.stepInterval = 'weekly';
      this.stepSize = 1000 * 60 * 60 * 24 * 7; // 1 week in ms
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
      const minVal = parseFloat(e.target.value);
      const maxVal = parseFloat(maxInput.value);

      // Update dynamic step based on current range
      this.updateDynamicStep(minVal, maxVal);

      this.updateSliderRange(minVal, maxVal);
      this.updateDateDisplay();
      this.applyDateFilter();
    });

    // Handle max slider change
    maxInput.addEventListener('input', (e) => {
      const minVal = parseFloat(minInput.value);
      const maxVal = parseFloat(e.target.value);

      // Update dynamic step based on current range
      this.updateDynamicStep(minVal, maxVal);

      this.updateSliderRange(minVal, maxVal);
      this.updateDateDisplay();
      this.applyDateFilter();
    });

    // Initialize step on load
    this.updateDynamicStep(0, 100);
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
   * Update slider step based on the current selected range
   * - Year+ range: step by months
   * - Month range: step by weeks
   * - Day range: step by days
   */
  updateDynamicStep: function(minVal, maxVal) {
    const minInput = document.getElementById('timeline-slider-min');
    const maxInput = document.getElementById('timeline-slider-max');
    
    if (!minInput || !maxInput) return;

    // Get the dates at the current slider positions
    const minDate = this.getDateAtPercent(minVal);
    const maxDate = this.getDateAtPercent(maxVal);
    
    // Calculate the difference in days
    const diffMs = Math.abs(maxDate - minDate);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    let stepPercent;

    if (diffDays >= 365) {
      // Year+ range: step by months (~30 days)
      const stepMs = 1000 * 60 * 60 * 24 * 30; // 30 days
      const totalRangeMs = this.maxDate - this.minDate;
      stepPercent = (stepMs / totalRangeMs) * 100;
    } else if (diffDays >= 30) {
      // Month+ range: step by weeks (7 days)
      const stepMs = 1000 * 60 * 60 * 24 * 7; // 7 days
      const totalRangeMs = this.maxDate - this.minDate;
      stepPercent = (stepMs / totalRangeMs) * 100;
    } else {
      // Day range: step by days (1 day)
      const stepMs = 1000 * 60 * 60 * 24; // 1 day
      const totalRangeMs = this.maxDate - this.minDate;
      stepPercent = (stepMs / totalRangeMs) * 100;
    }

    // Set the step attribute on both sliders
    minInput.step = stepPercent;
    maxInput.step = stepPercent;
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
    } else if (this.stepInterval === 'weekly') {
      this.generateWeeklySteps(stepsContainer);
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
    // Calculate label step based on slider width
    const labelStep = this.calculateOptimalLabelStep(this.allDates.length);

    for (let i = 0; i < this.allDates.length; i += labelStep) {
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
   * Calculate optimal label step based on slider width
   */
  calculateOptimalLabelStep: function(totalItems) {
    const container = document.querySelector(this.containerSelector);
    if (!container) return Math.max(1, Math.ceil(totalItems / 10)); // Fallback

    // Get the width of the slider track container
    const sliderContainer = container.querySelector('.timeline-slider-container');
    if (!sliderContainer) return Math.max(1, Math.ceil(totalItems / 10)); // Fallback

    let sliderWidth = sliderContainer.offsetWidth;
    
    // If width is 0 or very small, use a fallback calculation
    if (sliderWidth <= 0) {
      // Fallback: show approximately 8-10 labels
      return Math.max(1, Math.ceil(totalItems / 10));
    }
    
    // Estimate space needed per label (approximately 70px per label for typical date labels)
    const spacePerLabel = 70;
    
    // Calculate how many labels can fit in the slider
    const maxLabelsCanFit = Math.max(1, Math.floor(sliderWidth / spacePerLabel));
    
    // Calculate step to fit labels within the slider width
    const optimalStep = Math.max(1, Math.ceil(totalItems / maxLabelsCanFit));
    
    return optimalStep;
  },

  /**
   * Generate weekly step labels
   */
  generateWeeklySteps: function(container) {
    // Generate steps for each week between min and max date
    const allWeeks = [];
    const currentDate = new Date(this.minDate);
    
    // Find the start of the first week
    const dayOfWeek = currentDate.getDay();
    currentDate.setDate(currentDate.getDate() - dayOfWeek);
    
    // Generate all weeks
    while (currentDate <= this.maxDate) {
      allWeeks.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 7);
    }

    // Calculate label step based on slider width
    const labelStep = this.calculateOptimalLabelStep(allWeeks.length);

    // Generate visual step for each week with labels for every Nth week
    allWeeks.forEach((date, idx) => {
      // Calculate the position of this week in the overall date range
      const daysSinceMin = Math.floor((date - this.minDate) / (1000 * 60 * 60 * 24));
      const totalDays = Math.floor((this.maxDate - this.minDate) / (1000 * 60 * 60 * 24));
      const percent = (daysSinceMin / totalDays) * 100;

      const stepLabel = document.createElement('div');
      stepLabel.className = 'timeline-step';
      stepLabel.style.left = Math.min(100, percent) + '%';
      
      const label = document.createElement('span');
      label.className = 'timeline-step-label';
      
      // Add text content for every Nth week (show first day of week only)
      if (idx % labelStep === 0) {
        label.textContent = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      
      stepLabel.appendChild(label);
      container.appendChild(stepLabel);
    });
  },

  /**
   * Generate monthly step labels
   */
  generateMonthlySteps: function(container) {
    // Generate steps for ALL months between min and max date
    const allMonths = [];
    const currentDate = new Date(this.minDate.getFullYear(), this.minDate.getMonth(), 1);
    
    while (currentDate <= this.maxDate) {
      allMonths.push(new Date(currentDate));
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Calculate label step based on slider width
    const labelStep = this.calculateOptimalLabelStep(allMonths.length);

    // Determine if we need to show year (only if spanning multiple years)
    const sameYear = this.minDate.getFullYear() === this.maxDate.getFullYear();

    // Generate visual step for each month with labels for every Nth month
    allMonths.forEach((date, idx) => {
      // Calculate the position of this month in the overall date range
      const daysSinceMin = Math.floor((date - this.minDate) / (1000 * 60 * 60 * 24));
      const totalDays = Math.floor((this.maxDate - this.minDate) / (1000 * 60 * 60 * 24));
      const percent = (daysSinceMin / totalDays) * 100;

      const stepLabel = document.createElement('div');
      stepLabel.className = 'timeline-step';
      stepLabel.style.left = Math.min(100, percent) + '%';
      
      const label = document.createElement('span');
      label.className = 'timeline-step-label';
      
      // Add text content for every Nth month
      if (idx % labelStep === 0) {
        // Only show year if spanning multiple years
        const formatOptions = sameYear ? { month: 'short' } : { month: 'short', year: '2-digit' };
        label.textContent = date.toLocaleDateString('en-US', formatOptions);
      }
      
      stepLabel.appendChild(label);
      container.appendChild(stepLabel);
    });
  },

  /**
   * Generate yearly step labels
   */
  generateYearlySteps: function(container) {
    // Generate steps for ALL years between min and max date
    const allYears = [];
    const minYear = this.minDate.getFullYear();
    const maxYear = this.maxDate.getFullYear();
    
    for (let year = minYear; year <= maxYear; year++) {
      allYears.push(new Date(year, 0, 1)); // January 1st of each year
    }

    // Calculate label step based on slider width
    const labelStep = this.calculateOptimalLabelStep(allYears.length);

    // Generate visual step for each year with labels for every Nth year
    allYears.forEach((date, idx) => {
      // Calculate the position of this year in the overall date range
      const daysSinceMin = Math.floor((date - this.minDate) / (1000 * 60 * 60 * 24));
      const totalDays = Math.floor((this.maxDate - this.minDate) / (1000 * 60 * 60 * 24));
      const percent = (daysSinceMin / totalDays) * 100;

      const stepLabel = document.createElement('div');
      stepLabel.className = 'timeline-step';
      stepLabel.style.left = Math.min(100, percent) + '%';
      
      const label = document.createElement('span');
      label.className = 'timeline-step-label';
      
      // Add text content for every Nth year
      if (idx % labelStep === 0) {
        label.textContent = date.getFullYear();
      }
      
      stepLabel.appendChild(label);
      container.appendChild(stepLabel);
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
