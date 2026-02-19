/**
 * TimelineSlider for filtering map features by date
 */

/**
 * Utility function to parse date strings in various formats
 * Handles DD/MM/YYYY, MM/DD/YYYY, and ISO formats
 * Used globally for consistent date parsing
 */
window.parseCustomDate = function(dateStr) {
    if (!dateStr) return null;
    
    // Try ISO format first (YYYY-MM-DD)
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        return new Date(dateStr);
    }
    
    // Try DD/MM/YYYY or MM/DD/YYYY format
    if (typeof dateStr === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateStr)) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            
            // Determine if it's DD/MM/YYYY or MM/DD/YYYY
            if (day <= 31 && month <= 12) {
                // European format: DD/MM/YYYY
                return new Date(year, month - 1, day);
            }
        }
    }
    
    // Fallback to native Date parsing
    return new Date(dateStr);
};

class TimelineSlider {
    constructor(mapDiv, options = {}) {
        this.mapDiv = $(mapDiv);
        this.sliderContainer = options.sliderContainer || this.createSliderContainer();
        this.features = [];
        this.dateField = options.dateField || 'date';
        this.onDateChange = options.onDateChange || function() {};
        
        this.minDate = null;
        this.maxDate = null;
        this.selectedDate = null;
        
        this.initializeSlider();
    }

    /**
     * Parse date string in various formats (delegates to global function)
     */
    parseDate(dateStr) {
        return window.parseCustomDate(dateStr);
    }

    /**
     * Create the slider container if not provided
     */
    createSliderContainer() {
        const container = $('<div>')
            .attr('id', 'timeline-slider-container')
            .css({
                'padding': '15px',
                'background': '#f5f5f5',
                'border-bottom': '1px solid #ddd',
                'margin-bottom': '10px'
            });
        
        this.mapDiv.parent().prepend(container);
        return container;
    }

    /**
     * Initialize the slider
     */
    initializeSlider() {
        this.sliderContainer.html(`
            <div style="margin-bottom: 10px;">
                <label style="display: block; font-weight: bold; margin-bottom: 8px;">Filter by Date</label>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="range" id="timeline-slider" min="0" max="100" value="0" 
                           style="flex: 1; cursor: pointer;">
                    <span id="timeline-date-label" style="min-width: 150px; text-align: center; font-weight: bold;">No date data</span>
                </div>
                <div id="timeline-ticks" style="position: relative; margin-top: 5px; height: 30px;"></div>
                <div style="margin-top: 8px; text-align: center; font-size: 12px; color: #666;">
                    <span id="timeline-range-display"></span>
                </div>
            </div>
        `);

        this.slider = this.sliderContainer.find('#timeline-slider');
        this.dateLabel = this.sliderContainer.find('#timeline-date-label');
        this.rangeDisplay = this.sliderContainer.find('#timeline-range-display');
        this.ticksContainer = this.sliderContainer.find('#timeline-ticks');

        this.slider.on('input', () => this.onSliderChange());
    }

    /**
     * Update the slider with features
     */
    updateFeatures(features) {
        this.features = features;
        this.extractDates();
        this.updateSliderRange();
    }

    /**
     * Extract dates from features
     */
    extractDates() {
        const dates = [];
        
        console.log('Starting date extraction, total features:', this.features.length);
        
        this.features.forEach((feature, index) => {
            console.log(`Feature ${index}:`, feature);
            console.log(`  - Properties:`, feature.properties);
            console.log(`  - Direct dates:`, feature.dates);
            console.log(`  - Properties dates:`, feature.properties?.dates);
            
            // Try to get dates from multiple sources
            let featureDates = [];
            if (feature.dates) {
                featureDates = Array.isArray(feature.dates) ? feature.dates : [feature.dates];
            } else if (feature.properties && feature.properties.dates) {
                featureDates = Array.isArray(feature.properties.dates) 
                    ? feature.properties.dates 
                    : [feature.properties.dates];
            }
            
            console.log(`  - Final parsed dates:`, featureDates);
            if (featureDates.length > 0) {
                dates.push(...featureDates);
            }
        });

        console.log('All extracted dates:', dates);

        if (dates.length === 0) {
            this.minDate = null;
            this.maxDate = null;
            this.rangeDisplay.text('No date data available');
            return;
        }

        // Parse and sort dates
        const parsedDates = dates.map(d => this.parseDate(d)).filter(d => d && !isNaN(d.getTime()));
        
        console.log('Parsed dates:', parsedDates);
        
        if (parsedDates.length === 0) {
            this.minDate = null;
            this.maxDate = null;
            this.rangeDisplay.text('No valid date data available');
            return;
        }
        
        parsedDates.sort((a, b) => a.getTime() - b.getTime());
        this.minDate = parsedDates[0];
        this.maxDate = parsedDates[parsedDates.length - 1];
        this.selectedDate = new Date(this.minDate);

        console.log('Timeline dates extracted:', this.minDate, this.maxDate);
    }

    /**
     * Update the slider range
     */
    updateSliderRange() {
        if (!this.minDate || !this.maxDate) {
            this.slider.prop('disabled', true);
            return;
        }

        this.slider.prop('disabled', false);
        
        // Reset slider to beginning
        this.slider.val(0);
        this.renderTimelineTicks();
        this.onSliderChange();
    }

    /**
     * Render timeline tick marks with intelligent labeling
     */
    renderTimelineTicks() {
        if (!this.minDate || !this.maxDate) return;
        
        this.ticksContainer.empty();
        
        const yearsDiff = (this.maxDate.getFullYear() - this.minDate.getFullYear());
        const monthsDiff = yearsDiff * 12 + (this.maxDate.getMonth() - this.minDate.getMonth());
        
        let ticks = [];
        
        if (yearsDiff > 10) {
            // Show years for long periods (every 1-5 years depending on span)
            const yearInterval = yearsDiff > 50 ? 10 : yearsDiff > 20 ? 5 : 1;
            const startYear = Math.ceil(this.minDate.getFullYear() / yearInterval) * yearInterval;
            
            for (let year = startYear; year <= this.maxDate.getFullYear(); year += yearInterval) {
                const tickDate = new Date(year, 0, 1);
                if (tickDate >= this.minDate && tickDate <= this.maxDate) {
                    const percent = ((tickDate - this.minDate) / (this.maxDate - this.minDate)) * 100;
                    ticks.push({ date: tickDate, percent, label: year.toString() });
                }
            }
        } else if (monthsDiff > 12) {
            // Show years for periods 1-10 years
            for (let year = this.minDate.getFullYear(); year <= this.maxDate.getFullYear(); year++) {
                const tickDate = new Date(year, 0, 1);
                if (tickDate >= this.minDate && tickDate <= this.maxDate) {
                    const percent = ((tickDate - this.minDate) / (this.maxDate - this.minDate)) * 100;
                    ticks.push({ date: tickDate, percent, label: year.toString() });
                }
            }
        } else if (monthsDiff > 3) {
            // Show months for periods 3-12 months
            let current = new Date(this.minDate.getFullYear(), this.minDate.getMonth(), 1);
            while (current <= this.maxDate) {
                const percent = ((current - this.minDate) / (this.maxDate - this.minDate)) * 100;
                const label = current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                ticks.push({ date: new Date(current), percent, label });
                current.setMonth(current.getMonth() + 1);
            }
        } else {
            // Show weeks for periods under 3 months
            let current = new Date(this.minDate);
            const daysDiff = (this.maxDate - this.minDate) / (1000 * 60 * 60 * 24);
            const interval = daysDiff > 60 ? 14 : 7; // biweekly or weekly
            
            while (current <= this.maxDate) {
                const percent = ((current - this.minDate) / (this.maxDate - this.minDate)) * 100;
                const label = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                ticks.push({ date: new Date(current), percent, label });
                current.setDate(current.getDate() + interval);
            }
        }
        
        // Render ticks
        ticks.forEach(tick => {
            const tickElement = $('<div>')
                .css({
                    'position': 'absolute',
                    'left': tick.percent + '%',
                    'transform': 'translateX(-50%)',
                    'text-align': 'center',
                    'font-size': '10px',
                    'color': '#666'
                })
                .html(`
                    <div style="width: 1px; height: 8px; background: #999; margin: 0 auto;"></div>
                    <div style="margin-top: 2px; white-space: nowrap;">${tick.label}</div>
                `);
            this.ticksContainer.append(tickElement);
        });
    }

    /**
     * Handle slider change
     */
    onSliderChange() {
        if (!this.minDate || !this.maxDate) return;

        const percent = parseInt(this.slider.val());
        this.selectedDate = this.percentToDate(percent);

        this.updateLabels();
        this.onDateChange(this.selectedDate);
    }

    /**
     * Convert percentage to date
     */
    percentToDate(percent) {
        const range = this.maxDate - this.minDate;
        const offset = (range * percent) / 100;
        return new Date(this.minDate.getTime() + offset);
    }

    /**
     * Update label display
     */
    updateLabels() {
        this.dateLabel.text(this.formatDate(this.selectedDate));
        
        const itemsShown = this.countItemsOnDate(this.selectedDate);
        this.rangeDisplay.text(`${itemsShown} item(s) on or after ${this.formatDate(this.selectedDate)}`);
    }

    /**
     * Format date for display
     */
    formatDate(date) {
        if (!date) return 'N/A';
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    /**
     * Count items on or after the selected date
     */
    countItemsOnDate(selectedDate) {
        let count = 0;
        this.features.forEach(feature => {
            // Try to get dates from multiple sources
            let featureDates = [];
            if (feature.dates) {
                featureDates = Array.isArray(feature.dates) ? feature.dates : [feature.dates];
            } else if (feature.properties && feature.properties.dates) {
                featureDates = Array.isArray(feature.properties.dates) 
                    ? feature.properties.dates 
                    : [feature.properties.dates];
            }
            
            if (featureDates.length > 0) {
                featureDates.forEach(dateStr => {
                    const featureDate = this.parseDate(dateStr);
                    if (featureDate && !isNaN(featureDate.getTime()) && featureDate >= selectedDate) {
                        count++;
                        return; // Count item once even if multiple dates
                    }
                });
            }
        });
        return count;
    }

    /**
     * Get the currently selected date
     */
    getSelectedDate() {
        return this.selectedDate;
    }

    /**
     * Hide the slider
     */
    hide() {
        this.sliderContainer.hide();
    }

    /**
     * Show the slider
     */
    show() {
        this.sliderContainer.show();
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimelineSlider;
}
