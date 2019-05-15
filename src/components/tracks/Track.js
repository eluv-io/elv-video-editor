import React from "react";
import PropTypes from "prop-types";
import TrackCanvas from "./TrackCanvas";
import {inject, observer} from "mobx-react";
import Fraction from "fraction.js";
import {ToolTip} from "elv-components-js";
import {reaction} from "mobx";

const color = "#f0f0f0";
const selectedColor = "#0fafff";

@inject("video")
@inject("entry")
@observer
class Track extends React.Component {
  constructor(props) {
    super(props);

    this.hovering = false;

    this.state = {
      context: undefined,
      // Draw reaction - Ensure canvas gets redrawn when state changes
      DisposeDrawReaction: reaction(
        () => ({
          duration: this.props.video.duration,
          scale: this.props.video.scale,
          scaleMax: this.props.video.scaleMax,
          scaleMin: this.props.video.scaleMin,
          entryId: this.props.entry.entryId,
          hoverEntryId: this.props.entry.hoverEntryId,
        }),
        () => this.Draw(),
        {delay: 100}
      ),
      // Resize reaction: Ensure canvas dimensions are updated on resize
      DisposeResizeReaction: reaction(
        () => ({
          width: this.props.width,
          height: this.props.height
        }),
        ({width, height}) => {
          if(this.state.context && this.state.context.canvas) {
            this.state.context.canvas.width = width;
            this.state.context.canvas.height = height;

            this.Draw();
          }
        },
        {delay: 100}
      )
    };

    this.Draw = this.Draw.bind(this);
    this.Click = this.Click.bind(this);
    this.Hover = this.Hover.bind(this);
    this.ClearHover = this.ClearHover.bind(this);
  }

  componentWillUnmount() {
    this.state.DisposeDrawReaction();
    this.state.DisposeResizeReaction();
  }

  // X position of mouse over canvas (as percent)
  ClientXToCanvasPosition(clientX) {
    return Fraction(clientX - this.state.context.canvas.offsetLeft).div(this.state.context.canvas.offsetWidth).valueOf();
  }

  // Binary search to find an entry at the given time
  Search(time) {
    const entries = this.props.track.entries;

    let left = 0;
    let right = entries.length - 1;

    while(left <= right) {
      let i = Math.floor((left + right) / 2);
      const entry = entries[i];

      if(entry.startTime > time) {
        right = i - 1;
      } else if(entry.endTime < time) {
        left = i + 1;
      } else {
        // Found a suitable option - There may be multiple, so take the one that started latest
        while(entries.length > i+1 && entries[i+1].startTime < time) {
          i += 1;
        }

        return entries[i];
      }
    }
  }

  ElementAt(clientX) {
    // How much of the duration of the video is currently visible
    const duration = Fraction(this.props.video.scaleMax - this.props.video.scaleMin).div(this.props.video.scale).mul(this.props.video.duration);

    // Where the currently visible segment starts
    const startOffset = Fraction(this.props.video.scaleMin).div(this.props.video.scale).mul(this.props.video.duration);

    // Time corresponding to mouse position
    const timeAt = duration.mul(this.ClientXToCanvasPosition(clientX)).add(startOffset);

    // Search through track to find which element (if any) is at this position
    return this.Search(timeAt.valueOf());
  }

  Click({clientX}) {
    this.props.entry.SetEntry(this.ElementAt(clientX));
  }

  Hover({clientX}) {
    const entry = this.ElementAt(clientX);

    if(entry !== this.props.entry.hoverEntry) {
      this.props.entry.HoverEntry(entry);
    }

    this.hovering = true;
  }

  ClearHover() {
    this.hovering = false;
    this.props.entry.HoverEntry(undefined);
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

    this.props.track.entries.forEach(entry => {
      const startPixel = (Fraction(entry.startTime).sub(startOffset)).mul(widthRatio).floor().valueOf();
      const endPixel = (Fraction(entry.endTime).sub(startOffset)).mul(widthRatio).floor().valueOf();

      if(endPixel.valueOf() < 0 || startPixel.valueOf() > context.canvas.offsetWidth) {
        return;
      }

      context.beginPath();

      if(entry.entryId === this.props.entry.entryId) {
        // Selected item - highlight fill

        context.fillStyle = selectedColor;
        context.strokeStyle = selectedColor;
        context.fillRect(startPixel, startY, endPixel - startPixel, halfHeight);
        context.rect(startPixel, startY, endPixel - startPixel, halfHeight);
      } else if(entry.entryId === this.props.entry.hoverEntryId) {
        // Hover item - fill

        context.fillStyle = color;
        context.strokeStyle = color;
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
    if(!this.hovering || !this.props.entry.hoverEntry) { return null; }

    return (
      <div className="track-entry">
        <div className="track-entry-timestamps">
          {`${this.props.entry.hoverEntry.startTimeSMPTE} - ${this.props.entry.hoverEntry.endTimeSMPTE}`}
        </div>
        <div className="track-entry-content">
          { this.props.entry.hoverEntry.text }
        </div>
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
