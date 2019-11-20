import React from "react";
import PropTypes from "prop-types";
import {inject, observer} from "mobx-react";
import {reaction} from "mobx";
import ToolTip from "elv-components-js/src/components/Tooltip";
import ResizeObserver from "resize-observer-polyfill";

const hoverColor = "#45fdff";
const selectedColor = "#0fafff";
const currentSelectionColor = "#ffffff";

@inject("video")
@inject("overlay")
@inject("tracks")
@inject("entry")
@observer
class Overlay extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      context: undefined,
      hovering: false,
    };

    this.InitializeCanvas = this.InitializeCanvas.bind(this);
    this.Click = this.Click.bind(this);
    this.Hover = this.Hover.bind(this);
    this.ClearHover = this.ClearHover.bind(this);
    this.Draw = this.Draw.bind(this);
    this.ToolTipContent = this.ToolTipContent.bind(this);
  }

  // Observe resizing of the video element to adjust the overlay size accordingly
  componentWillMount() {
    const debounceInterval = 100;

    // Add resize observer for overlay component
    this.resizeObserver = new ResizeObserver((elements) => {
      // Debounce resize updates
      if(this.lastUpdate && (performance.now() - this.lastUpdate) < debounceInterval ) {
        clearTimeout(this.resizeUpdate);
      }

      this.resizeUpdate = setTimeout(() => {
        const video = elements[0].target;
        let {height, width} = elements[0].contentRect;

        const videoAspectRatio = video.videoWidth / video.videoHeight;
        const elementAspectRatio = width / height;

        // Since the video element is pegged to 100% height, when the AR of the
        // video element becomes taller than the video content, they no longer match.
        // Calculate the actual video height using the reported aspect ratio of the content.
        if(elementAspectRatio < videoAspectRatio) {
          height = width / videoAspectRatio;
        }

        this.setState({
          videoHeight: height,
          videoWidth: width
        });
      }, debounceInterval);

      this.lastUpdate = performance.now();
    });

    this.resizeObserver.observe(this.props.element);
  }

  componentDidMount() {
    this.setState({
      DisposeDrawReaction: reaction(
        () => {
          return ({
            enabled: this.props.overlay.overlayEnabled,
            frame: this.props.video.frame,
            hoverEntries: this.props.entry.hoverEntries,
            selectedEntries: this.props.entry.entries,
            selectedEntry: this.props.entry.selectedEntry,
            videoWidth: this.state.videoWidth,
            videoHeight: this.state.videoHeight
          });
        },
        () => this.Draw(),
        {
          delay: 25,
          equals: (from, to) => JSON.stringify(from) === JSON.stringify(to)
        },
      )
    });
  }

  componentWillUnmount() {
    if(this.state.DisposeDrawReaction) {
      this.state.DisposeDrawReaction();
    }
  }

  InitializeCanvas(canvas) {
    if(!canvas) { return; }

    this.setState({context: canvas.getContext("2d")});
  }

  Entries() {
    if(this.props.video.frame === 0) { return []; }

    // Get the entries for the current frame, injecting the overlay track label into each entry
    const frame = this.props.overlay.overlayTrack[this.props.video.frame.toString()] ||
      this.props.overlay.overlayTrack[(this.props.video.frame - 1).toString()];

    if(!frame) { return []; }

    let entries = [];
    this.props.tracks.tracks
      .filter(track => track.trackType === "metadata")
      .forEach(track => {
        let key = track.key;
        if(key === "optical_character_recognition") {
          key = "ocr";
        }

        if(frame[key] && frame[key].tags) {
          entries = entries.concat(
            frame[key].tags.map(tag => ({
              ...tag,
              label: track.label,
              color: track.color
            }))
          );
        }
      });

    return entries;
  }

  EntriesAt({clientX, clientY}) {
    // Convert clientX and clientY into percentages to match box values
    const {top, left, height, width} = this.state.context.canvas.getBoundingClientRect();
    clientX = (clientX - left) / width;
    clientY = (clientY - top) / height;

    return this.Entries().filter(entry => {
      const {x1, x2, y1, y2, x3, y3, x4, y4} = entry.box;
      const minX = Math.min(x1, x2, x3 || x1, x4 || x2);
      const maxX = Math.max(x1, x2, x3 || x1, x4 || x2);
      const minY = Math.min(y1, y2, y3 || y1, y4 || y2);
      const maxY = Math.max(y1, y2, y3 || y1, y4 || y2);

      return (minX <= clientX && maxX >= clientX && minY <= clientY && maxY >= clientY);
    });
  }

  Click({clientX, clientY}) {
    if(this.props.video.playing) { return; }

    const entries = this.EntriesAt({clientX, clientY});

    this.props.entry.SetEntries(entries, this.props.video.smpte);
  }

  Hover({clientX, clientY}) {
    if(this.props.video.playing) { return; }

    const hoverEntries = this.EntriesAt({clientX, clientY});

    this.props.entry.SetHoverEntries(hoverEntries, this.props.video.smpte);

    this.setState({hovering: true});
  }

  ClearHover() {
    this.setState({hovering: false});

    this.props.entry.SetHoverEntries([]);
  }

  ToolTipContent() {
    if(
      !this.state.hovering ||
      this.props.entry.hoverEntries.length === 0 ||
      this.props.video.playing
    ) {
      return null;
    }

    return (
      <div className="track-entry-container">
        {this.props.entry.hoverEntries.map(entry =>
          <div className="track-entry" key={`entry-${entry.entryId}`}>
            <div className="track-entry-content">
              { entry.text }
            </div>
          </div>
        )}
      </div>
    );
  }

  Draw() {
    if(!this.state.context) { return; }

    const entries = this.Entries();

    this.state.context.canvas.width = this.state.videoWidth;
    this.state.context.canvas.height = this.state.videoHeight;

    // Draw
    const context = this.state.context;
    const width = context.canvas.width;
    const height = context.canvas.height;

    context.clearRect(0, 0, context.canvas.width, context.canvas.height);

    if(entries.length === 0) { return; }

    entries.forEach(entry => {
      if(!entry.box) { return; }

      let {x1, x2, y1, y2, x3, y3, x4, y4} = entry.box;

      let points = [];
      if(!x3) {
        points = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
      } else {
        points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
      }
      points = points.map(point => [point[0] * width, point[1] * height]);

      const selectedEntryIds = this.props.entry.entries;
      const hoverEntryIds = this.props.entry.hoverEntries;

      context.globalAlpha = 1.0;
      context.lineWidth = 2;

      const toHex = n => n.toString(16).padStart(2, "0");
      let color = `#${toHex(entry.color.r)}${toHex(entry.color.g)}${toHex(entry.color.b)}`;
      if(selectedEntryIds.includes(entry.entryId)) {
        context.globalAlpha = 0.8;
        color = selectedColor;
      } else if(hoverEntryIds.includes(entry.entryId)) {
        context.globalAlpha = 0.8;
        color = hoverColor;
      }

      // Highlight current entry in entry panel, if the panel is visible
      if(this.props.entry.entries.length > 0 && entry.entryId === this.props.entry.selectedEntry) {
        color = currentSelectionColor;
      }

      context.strokeStyle = color;

      context.beginPath();
      context.moveTo(points[0][0], points[0][1]);
      context.lineTo(points[1][0], points[1][1]);
      context.lineTo(points[2][0], points[2][1]);
      context.lineTo(points[3][0], points[3][1]);
      context.lineTo(points[0][0], points[0][1]);
      context.stroke();
    });
  }

  render() {
    if(!this.props.overlay.overlayEnabled) { return null; }

    return (
      <div className="overlay-container" style={{width: `${this.state.videoWidth}px`}}>
        <ToolTip
          onMouseMove={this.Hover}
          onMouseLeave={this.ClearHover}
          content={this.ToolTipContent()}
        >
          <canvas
            onClick={this.Click}
            ref={this.InitializeCanvas}
            className="overlay-canvas"
          />
        </ToolTip>
      </div>
    );
  }
}

Overlay.propTypes = {
  element: PropTypes.object.isRequired,
};

export default Overlay;
