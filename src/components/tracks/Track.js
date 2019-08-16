import React from "react";
import PropTypes from "prop-types";
import TrackCanvas from "./TrackCanvas";
import {inject, observer} from "mobx-react";
import Fraction from "fraction.js";
import {ToolTip} from "elv-components-js";
import {reaction} from "mobx";

const color = "#ffffff";
const selectedColor = "#0fafff";
const activeColor = "#36ff00";

@inject("video")
@inject("entry")
@observer
class Track extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      context: undefined,
      hovering: false,
      hoverTime: 0
    };

    this.activeEntryIds = [];

    this.Draw = this.Draw.bind(this);
    this.DrawIfActiveChanged = this.DrawIfActiveChanged.bind(this);
    this.Click = this.Click.bind(this);
    this.Hover = this.Hover.bind(this);
    this.ClearHover = this.ClearHover.bind(this);
  }

  componentDidMount() {
    // Initialize reactionary re-draw handlers

    this.setState({
      // Draw reaction - Ensure canvas gets redrawn when state changes
      DisposeDrawReaction: reaction(
        () => ({
          duration: this.props.video.duration,
          scale: this.props.video.scale,
          scaleMax: this.props.video.scaleMax,
          scaleMin: this.props.video.scaleMin,
          entries: this.props.entry.entries,
          hoverEntries: this.props.entry.hoverEntries,
          selectedEntry: this.props.entry.selectedEntry
        }),
        () => this.Draw(),
        {delay: 25}
      ),
      // Update if active entry changed
      DisposeActiveReaction: reaction(
        () => ({
          frame: this.props.video.frame
        }),
        () => this.DrawIfActiveChanged(),
        {delay: 100}
      ),
      // Resize reaction: Ensure canvas dimensions are updated on resize
      DisposeResizeReaction: reaction(
        () => ({
          width: this.props.width,
          height: this.props.height
        }),
        ({width, height}) => {
          if (this.state.context && this.state.context.canvas) {
            this.state.context.canvas.width = width;
            this.state.context.canvas.height = height;

            this.Draw();
          }
        },
        {delay: 100}
      )
    });
  }

  componentWillUnmount() {
    this.state.DisposeDrawReaction();
    this.state.DisposeActiveReaction();
    this.state.DisposeResizeReaction();
  }

  // X position of mouse over canvas (as percent)
  ClientXToCanvasPosition(clientX) {
    return Fraction(clientX - this.state.context.canvas.offsetLeft).div(this.state.context.canvas.offsetWidth).valueOf();
  }

  // Binary search to find an entry at the given time
  Search(time) {
    return this.props.track.intervalTree.search(time, time);
  }

  TimeAt(clientX) {
    // How much of the duration of the video is currently visible
    const duration = Fraction(this.props.video.scaleMax - this.props.video.scaleMin).div(this.props.video.scale).mul(this.props.video.duration);

    // Where the currently visible segment starts
    const startOffset = Fraction(this.props.video.scaleMin).div(this.props.video.scale).mul(this.props.video.duration);

    // Time corresponding to mouse position
    return duration.mul(this.ClientXToCanvasPosition(clientX)).add(startOffset).valueOf();
  }

  Click({clientX}) {
    const time = this.TimeAt(clientX);
    const entries = this.Search(time);

    this.props.entry.SetEntries(entries, this.props.video.TimeToSMPTE(time));
  }

  Hover({clientX}) {
    const time = this.TimeAt(clientX);
    const entries = this.Search(time);

    this.props.entry.SetHoverEntries(entries, this.props.video.TimeToSMPTE(time));

    this.setState({
      hovering: true,
      hoverTime: this.TimeAt(clientX)
    });
  }

  ClearHover() {
    this.props.entry.SetHoverEntries([]);

    this.setState({hovering: false});
  }

  DrawIfActiveChanged() {
    const activeEntryIds = (this.Search(this.props.video.currentTime)).map(e => e.entryId).sort();

    if(activeEntryIds.toString() === this.activeEntryIds.toString()) { return; }

    this.activeEntryIds = activeEntryIds;

    this.Draw();
  }

  Draw() {
    if(!this.state.context || !this.state.context.canvas) {
      return;
    }

    const context = this.state.context;

    context.clearRect(0, 0, context.canvas.width, context.canvas.height);

    // How much of the duration of the video is currently visible
    const duration = Fraction(this.props.video.scaleMax - this.props.video.scaleMin).div(this.props.video.scale).mul(this.props.video.duration);

    // Where the currently visible segment starts
    const startOffset = Fraction(this.props.video.scaleMin).div(this.props.video.scale).mul(this.props.video.duration);

    const widthRatio = Fraction(context.canvas.offsetWidth).div(duration);
    const halfHeight = Fraction(context.canvas.offsetHeight).div(2);
    const quarterHeight = halfHeight.div(2);
    const startY = quarterHeight.valueOf();

    const activeEntries = this.Search(this.props.video.currentTime);
    const activeEntryIds = activeEntries.map(entry => entry.entryId);
    const selectedEntryIds = this.props.entry.entries.map(entry => entry.entryId);
    const hoverEntryIds = this.props.entry.hoverEntries.map(entry => entry.entryId);

    this.props.track.entries.forEach(entry => {
      const startPixel = (Fraction(entry.startTime).sub(startOffset)).mul(widthRatio).floor().valueOf();
      const endPixel = (Fraction(entry.endTime).sub(startOffset)).mul(widthRatio).floor().valueOf();

      if(endPixel.valueOf() < 0 || startPixel.valueOf() > context.canvas.offsetWidth) {
        return;
      }

      context.beginPath();
      context.globalAlpha = 0.4;

      if(this.props.entry.selectedEntry === entry.entryId) {
        // Currently shown entry

        context.globalAlpha = 0.6;
        context.fillStyle = color;
        context.strokeStyle = color;
        context.fillRect(startPixel, startY, endPixel - startPixel, halfHeight);
        context.rect(startPixel, startY, endPixel - startPixel, halfHeight);
      } else if(selectedEntryIds.includes(entry.entryId)) {
        // Selected item - highlight fill

        context.fillStyle = selectedColor;
        context.strokeStyle = selectedColor;
        context.fillRect(startPixel, startY, endPixel - startPixel, halfHeight);
        context.rect(startPixel, startY, endPixel - startPixel, halfHeight);
      } else if(hoverEntryIds.includes(entry.entryId)) {
        // Hover item - fill

        context.fillStyle = color;
        context.strokeStyle = color;
        context.fillRect(startPixel, startY, endPixel - startPixel, halfHeight);
        context.rect(startPixel, startY, endPixel - startPixel, halfHeight);
      } else if(activeEntryIds.includes(entry.entryId)) {
        // Active item - highlight fill

        context.fillStyle = activeColor;
        context.strokeStyle = activeColor;
        context.fillRect(startPixel, startY, endPixel - startPixel, halfHeight);
        context.rect(startPixel, startY, endPixel - startPixel, halfHeight);
      } else {
        // Regular item - outline

        context.fillStyle = color;
        context.strokeStyle = color;
        context.rect(startPixel, startY, endPixel - startPixel, halfHeight);
      }

      context.stroke();
    });
  }

  ToolTipContent() {
    if(!this.state.hovering || !this.props.entry.hoverEntries || this.props.entry.hoverEntries.length === 0) {
      return null;
    }

    return (
      <div className="track-entry-container">
        {this.props.entry.hoverEntries.map(entry =>
          <div className="track-entry" key={`entry-${entry.entryId}`}>
            <div className="track-entry-timestamps">
              {`${entry.startTimeSMPTE} - ${entry.endTimeSMPTE}`}
            </div>
            <div className="track-entry-content">
              { entry.text }
            </div>
          </div>
        )}
      </div>
    );
  }

  Canvas() {
    return (
      <TrackCanvas
        className="track"
        onClick={this.Click}
        onMouseMove={this.Hover}
        onMouseLeave={this.ClearHover}
        SetRef={context => this.setState({context})}
      />
    );
  }

  render() {
    return (
      <ToolTip content={this.ToolTipContent()}>
        <div
          onWheel={({deltaY, clientX}) => this.props.video.ScrollScale(this.ClientXToCanvasPosition(clientX), deltaY)}
          className="track-container"
        >
          { this.Canvas() }
        </div>
      </ToolTip>
    );
  }
}

Track.propTypes = {
  track: PropTypes.object.isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  entry: PropTypes.object,
  video: PropTypes.object
};

export default Track;
