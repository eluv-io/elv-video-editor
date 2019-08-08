import React from "react";
import PropTypes from "prop-types";
import {inject, observer} from "mobx-react";
import {reaction} from "mobx";
import ToolTip from "elv-components-js/src/components/Tooltip";

const defaultColor = "#00ff00";
const hoverColor = "#ffffff";
const selectedColor = "#0fafff";

@inject("video")
@inject("overlay")
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

  componentDidMount() {
    this.setState({
      // Draw reaction - Ensure canvas gets redrawn when state changes
      DisposeDrawReaction: reaction(
        () => {
          return ({
            frame: this.props.video.frame,
            videoWidth: this.props.videoWidth,
            hoverEntries: this.props.entry.hoverEntries.map(entry => entry.entryId).sort(),
            selectedEntries: this.props.entry.entries.map(entry => entry.entryId).sort(),
            selectedEntry: this.props.entry.selectedEntry
          });
        },
        () => this.Draw(),
        {
          delay: 5,
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
    return this.props.overlay.overlayTracks.map(track =>
      track.entries[this.props.video.frame]
    )
      .flat();
  }

  EntriesAt({clientX, clientY}) {
    // Convert clientX and clientY into percentages to match box values
    const {top, left, height, width} = this.state.context.canvas.getBoundingClientRect();
    clientX = (clientX - left) / width;
    clientY = (clientY - top) / height;

    return this.Entries().filter(entry => {
      const {x1, x2, y1, y2} = entry.box;

      return (x1 <= clientX && x2 >= clientX && y1 <= clientY && y2 >= clientY);
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
    if(!this.state.hovering || this.props.entry.hoverEntries.length === 0) {
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

    // Draw
    const context = this.state.context;
    const width = context.canvas.width;
    const height = context.canvas.height;

    context.clearRect(0, 0, context.canvas.width, context.canvas.height);

    if(entries.length === 0) { return; }

    entries.forEach(entry => {
      const {x1, x2, y1, y2} = entry.box;
      const startX = x1 * width;
      const startY = y1 * height;
      const endX = x2 * width;
      const endY = y2 * height;

      const selectedEntryIds = this.props.entry.entries.map(entry => entry.entryId);
      const hoverEntryIds = this.props.entry.hoverEntries.map(entry => entry.entryId);

      let color = defaultColor;
      if(selectedEntryIds.includes(entry.entryId)) {
        color = selectedColor;
      } else if(hoverEntryIds.includes(entry.entryId)) {
        color = hoverColor;
      }

      context.globalAlpha = 0.5;
      if(entry.entryId === this.props.entry.selectedEntry) {
        context.globalAlpha = 1.0;
      }

      context.strokeStyle = color;

      context.beginPath();
      context.rect(startX, startY, endX - startX, endY - startY);
      context.stroke();
    });
  }

  render() {
    return (
      <div className="overlay-container" style={{width: `${this.props.videoWidth}px`}}>
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
  videoWidth: PropTypes.number.isRequired
};

export default Overlay;
