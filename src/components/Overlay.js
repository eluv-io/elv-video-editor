import React from "react";
import PropTypes from "prop-types";
import {inject, observer} from "mobx-react";
import {reaction} from "mobx";
import {ToolTip} from "elv-components-js";
import ResizeObserver from "resize-observer-polyfill";

const frameSpread = 10;

@inject("videoStore")
@inject("overlayStore")
@inject("tracksStore")
@inject("entryStore")
@observer
class Overlay extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      context: undefined,
      hovering: false,
      hoverEntries: [],
      clientX: -1,
      clienY: -1
    };

    this.InitializeCanvas = this.InitializeCanvas.bind(this);
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
            enabled: this.props.overlayStore.overlayEnabled,
            frame: this.props.videoStore.frame,
            videoWidth: this.state.videoWidth,
            videoHeight: this.state.videoHeight,
            enabledTracks: JSON.stringify(this.props.overlayStore.enabledOverlayTracks),
            highlightEntry: JSON.stringify(this.props.highlightEntry || "")
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

  AssetEntries() {
    let entries = [];
    Object.keys(this.props.asset.image_tags || {}).forEach(category => {
      if(!this.props.asset.image_tags[category].tags) { return; }

      const trackInfo = this.props.overlayStore.TrackInfo(category);
      entries = entries.concat(
        this.props.asset.image_tags[category].tags.map(tags =>
          ({
            ...tags,
            trackLabel: trackInfo.label,
            color: trackInfo.color
          })
        )
      );
    });

    if(this.props.highlightEntry) {
      entries.push({
        ...this.props.highlightEntry,
        color: { r: 255, g: 255, b: 255}
      });
    }

    return entries.filter(entry => !!entry.box);
  }

  Entries() {
    // Retrieve entries from the asset
    if(this.props.asset) {
      return this.AssetEntries();
    }

    if(this.props.videoStore.frame === 0) { return []; }

    // Get the entries for the current frame, injecting the overlay track label into each entry
    let frame;
    for(let i = this.props.videoStore.frame; i > Math.max(0, this.props.videoStore.frame - frameSpread); i--) {
      frame = this.props.overlayStore.overlayTrack[i.toString()];

      if(frame) {
        break;
      }
    }

    if(!frame) { return []; }

    let entries = [];
    this.props.tracksStore.tracks
      .filter(track => track.trackType === "metadata")
      .forEach(track => {
        if(!this.props.overlayStore.enabledOverlayTracks[track.key]) { return; }

        if(!frame[track.key] || typeof frame[track.key] !== "object") { return; }

        let boxes = [];
        if(frame[track.key].tags) {
          boxes = frame[track.key].tags;
        } else {
          Object.keys(frame[track.key]).map(text => {
            if(typeof frame[track.key][text] !== "object") { return; }

            frame[track.key][text].map(entry => {
              boxes.push({
                ...entry,
                text
              });
            });
          });
        }

        entries = entries.concat(
          boxes.map(tag => ({
            ...tag,
            label: track.label,
            color: track.color
          }))
        );
      });

    return entries.filter(entry => !!entry.box);
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

  Hover({clientX, clientY}) {
    this.setState({
      clientX,
      clientY,
      hoverEntries: this.EntriesAt({clientX, clientY}),
      hovering: true
    });
  }

  ClearHover() {
    this.setState({hovering: false});
  }

  ToolTipContent() {
    if(
      !this.state.hovering ||
      this.state.hoverEntries.length === 0
    ) {
      return null;
    }

    return (
      <div className="track-entry-container">
        {this.state.hoverEntries.map((entry, i) =>
          <div className="track-entry" key={`overlay-hover-entry-${i}`}>
            <div className="track-entry-content">
              { Array.isArray(entry.text) ? entry.text.join(", ") : entry.text }
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
    context.globalAlpha = 0.8;
    context.lineWidth = 2;

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

      const toHex = n => n.toString(16).padStart(2, "0");

      context.strokeStyle = `#${toHex(entry.color.r)}${toHex(entry.color.g)}${toHex(entry.color.b)}`;

      context.beginPath();
      context.moveTo(points[0][0], points[0][1]);
      context.lineTo(points[1][0], points[1][1]);
      context.lineTo(points[2][0], points[2][1]);
      context.lineTo(points[3][0], points[3][1]);
      context.lineTo(points[0][0], points[0][1]);
      context.stroke();
    });

    if(this.state.hovering) {
      this.setState({
        hoverEntries: this.EntriesAt({
          clientX: this.state.clientX,
          clientY: this.state.clientY
        })
      });
    }
  }

  render() {
    if(!this.props.asset && !this.props.overlayStore.overlayEnabled) { return null; }

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
  asset: PropTypes.object,
  highlightEntry: PropTypes.object
};

export default Overlay;
