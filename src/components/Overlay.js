import React from "react";
import PropTypes from "prop-types";
import {inject, observer} from "mobx-react";
import {reaction} from "mobx";


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
      context: undefined
    };

    this.InitializeCanvas = this.InitializeCanvas.bind(this);
    this.Click = this.Click.bind(this);
    this.Hover = this.Hover.bind(this);
    this.ClearHover = this.ClearHover.bind(this);
    this.Draw = this.Draw.bind(this);
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
          });
        },
        () => this.Draw(),
        {
          delay: 10,
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
    // Get the entries for the current frame, injecting the overlay track label into each entry
    return this.props.overlay.overlayTracks.map(track =>
      track.entries[this.props.video.frame].map(entry =>
        ({
          overlayTrack: track.label,
          ...entry,
        })
      )
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
  }

  ClearHover() {
    this.props.entry.SetHoverEntries([]);
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

    context.globalAlpha = 0.5;

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

      context.strokeStyle = color;

      context.beginPath();
      context.rect(startX, startY, endX - startX, endY - startY);
      context.stroke();
    });
  }

  render() {
    return (
      <div className="overlay-container" style={{width: `${this.props.videoWidth}px`}}>
        <canvas
          onClick={this.Click}
          onMouseMove={this.Hover}
          onMouseLeave={this.ClearHover}
          ref={this.InitializeCanvas}
          className="overlay-canvas"
        />
      </div>
    );
  }
}

Overlay.propTypes = {
  videoWidth: PropTypes.number.isRequired
};

export default Overlay;
