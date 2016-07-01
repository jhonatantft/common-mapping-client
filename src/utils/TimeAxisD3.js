import d3 from 'd3';

export default class TimeAxisD3 {
    constructor(options) {
        this.initValues(options);
    }

    initValues(options) {
        // extract values
        this._selectNode = options.selectNode || this._selectNode;
        this._onClick = options.onClick || this._onClick;
        this._onHover = options.onHover || this._onHover;
        this._onMouseOut = options.onMouseOut || this._onMouseOut;
        this._minDt = options.minDt || this._minDt;
        this._maxDt = options.maxDt || this._maxDt;
        this._elementWidth = options.elementWidth || this._elementWidth;
        this._elementHeight = options.elementHeight || this._elementHeight;
        this._margin = options.margin || this._margin;

        // derive values
        this._width = this._elementWidth - (this._margin.left + this._margin.right);
        this._height = this._elementHeight - (this._margin.top + this._margin.bottom);

        // grab d3 selection if needed
        this._selection = this._selection || d3.select(this._selectNode);

        // time format function
        this._timeFormat = this._timeFormat || d3.time.format.multi([
            [".%L", (d) => {
                return d.getMilliseconds();
            }],
            [":%S", (d) => {
                return d.getSeconds();
            }],
            ["%I:%M %p", (d) => {
                return d.getMinutes();
            }],
            ["%I %p", (d) => {
                return d.getHours();
            }],
            ["%b %d", (d) => {
                return d.getDate() != 1;
            }],
            ["%B", (d) => {
                return d.getMonth();
            }],
            ["%Y", () => {
                return true;
            }]
        ]);

        // prep the axis functions if needed
        this._xFn = this._xFn || d3.time.scale()
            .domain([this._minDt, this._maxDt])
            .range([this._margin.left, this._margin.left + this._width]);
        this._xAxis = this._xAxis || d3.svg.axis()
            .scale(this._xFn)
            .orient('bottom')
            .tickSize(-this._height)
            .tickFormat(this._timeFormat);
    }

    enter() {
        // configure the zoom
        this._selection.zoom = d3.behavior.zoom()
            .x(this._xFn)
            .on('zoom', () => {
                this.zoomed();
            });

        // configure the drag
        this._selection.drag = d3.behavior.drag()
            .on('dragstart', () => {
                d3.event.sourceEvent.stopPropagation();
            });

        // enable the zooming
        this._selection
            .call(this._selection.zoom)
            .on("dblclick.zoom", null)
            .call(this._selection.drag)
            .on("click", () => {
                if (!d3.event.defaultPrevented && typeof this._onClick === "function") {
                    this._onClick(d3.event.x);
                }
            })
            .on("mousemove", () => {
                if (typeof this._onHover === "function") {
                    this._onHover(d3.event.x);
                }
            })
            .on("mouseleave", () => {
                if (typeof this._onMouseOut === "function") {
                    this._onMouseOut();
                }
            });

        // configure the axis
        this._selection.select("#x-axis")
            .attr('transform', 'translate(0,' + this._height + ')')
            .call(this._xAxis);

        // configure the single date bounds
        this._selection.select(".singleDate")
            .attr('x', (d) => this._xFn(d.date))
            .attr('y', 2)
            .attr('clip-path', "url(#chart-content)");

        // done entering time to update
        this.update();
    }

    update(options = false) {
        // update sizes
        this._selection.select('clipPath rect')
            .attr('x', this._margin.left)
            .attr('y', 0)
            .attr('height', this._height)
            .attr('width', this._width);
        this._selection.select('rect#chart-bounds')
            .attr('x', this._margin.left)
            .attr('y', 0)
            .attr('height', this._height)
            .attr('width', this._width);

        // configure the axis
        this._selection.select('#x-axis')
            .call(this._xAxis);

        // update the single date display
        this._selection.select(".singleDate")
            .transition()
            .duration(100)
            .attr('x', (d) => this._xFn(d.date));

        // update the resolution
        this.setResolution(options);
    }

    setResolution(options) {
        if (options && options.scale && options.date) {

            // See: http://bl.ocks.org/mbostock/7ec977c95910dd026812
            this._selection.call(this._selection.zoom.event);

            // Record the coordinates (in data space) of the center( in screen space).
            let center0 = [this._xFn(options.date), 0];
            let translate0 = this._selection.zoom.translate();
            let coordinates0 = this.coordinates(center0);
            this._selection.zoom.scale(options.scale);

            // Translate back to the center.
            let center1 = this.point(coordinates0);
            this._selection.zoom.translate([translate0[0] + center0[0] - center1[0], translate0[1] + center0[1] - center1[1]]);
            let translate1 = this._selection.zoom.translate();
            let xOffset = ((this._xFn.range()[1] - (this._width / 2)) - this._xFn(options.date));
            this._selection.zoom.translate([translate1[0] + xOffset, translate1[1]]);

            this._selection.transition().duration(750).call(this._selection.zoom.event);
        }
    }

    coordinates(point) {
        let scale = this._selection.zoom.scale();
        let translate = this._selection.zoom.translate();
        return [(point[0] - translate[0]) / scale, (point[1] - translate[1]) / scale];
    }

    point(coordinates) {
        let scale = this._selection.zoom.scale();
        let translate = this._selection.zoom.translate();
        return [coordinates[0] * scale + translate[0], coordinates[1] * scale + translate[1]];
    }

    zoomed() {
        // Check that the domain is not larger than bounds
        if (this._xFn.domain()[1] - this._xFn.domain()[0] > this._maxDt - this._minDt) {
            // Constrain scale to 1
            this._selection.zoom.scale(1);
        }

        if (this._xFn.domain()[0] <= this._minDt) {
            this._selection.zoom.translate([this._selection.zoom.translate()[0] - this._xFn(this._minDt) + this._xFn.range()[0], this._selection.zoom.translate()[1]]);
        }
        if (this._xFn.domain()[1] >= this._maxDt) {
            this._selection.zoom.translate([this._selection.zoom.translate()[0] - this._xFn(this._maxDt) + this._xFn.range()[1], this._selection.zoom.translate()[1]]);
        }

        // configure the axis
        this._selection.select('#x-axis')
            .call(this._xAxis);

        let singleDate = this._selection.select('.singleDate');
        // If not isDragging, set x of singledate to new value
        // If isDragging, do not set value so that single date can be
        //  dragged while zoom is in progress
        if (!singleDate.attr().data()[0].isDragging) {
            singleDate.attr('x', d => {
                return this._xFn(d.date);
            });
        }
    }

    getDateFromX(value) {
        return this._xFn.invert(value);
    }
    
    getXFromDate(value) {
        return this._xFn(value);
    }

    autoScroll(toLeft) {
        // get current translation
        let currTrans = this._selection.zoom.translate();

        // determine autoscroll amount (one-fifth tick)
        let currTicks = this._xFn.ticks();
        let scrollDiff = (this._xFn(currTicks[1]) - this._xFn(currTicks[0])) / 5;

        // prep the timeline
        this._selection.call(this._selection.zoom.translate(currTrans).event);

        // shift the timeline
        if (toLeft) {
            this._selection.transition()
                .duration(50)
                .call(this._selection.zoom.translate([currTrans[0] - scrollDiff, currTrans[1]]).event);
        } else {
            this._selection.transition()
                .duration(50)
                .call(this._selection.zoom.translate([currTrans[0] + scrollDiff, currTrans[1]]).event);
        }
    }

    resize(options) {
        // Largely based on http://stackoverflow.com/questions/25875316/d3-preserve-scale-translate-after-resetting-range

        // update the dimension values
        this.initValues(options);

        // Cache scale
        let cacheScale = this._selection.zoom.scale();

        // Cache translate
        let cacheTranslate = this._selection.zoom.translate();

        // Cache translate values as percentages/ratio of the full width
        let cacheTranslatePerc = this._selection.zoom.translate().map((v, i, a) => {
            return -(v) / this.getScaledWidth();
        });

        // Manually reset the zoom
        this._selection.zoom.scale(1).translate([0, 0]);

        // Update range values based on resized container dimensions
        this._xFn.range([this._margin.left, this._margin.left + this._width]);

        // Apply the updated xFn to the zoom
        this._selection.zoom.x(this._xFn);

        // Revert the scale back to our cached value
        this._selection.zoom.scale(cacheScale);

        // Overwrite the cacheTranslate based on our cached percentage
        cacheTranslate = cacheTranslate.map((v, i, a) => {
            return -(cacheTranslatePerc[i] * this.getScaledWidth());
        });

        // Finally apply the updated translate
        this._selection.zoom.translate(cacheTranslate);


        this.update();
    }

    getScaledWidth() {
        return (this._xFn.range()[1] - this._xFn.range()[0]) * this._selection.zoom.scale();
    }
}