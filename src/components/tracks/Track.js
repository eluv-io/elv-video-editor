import React from "react";
import PropTypes from "prop-types";
import TrackCanvas from "./TrackCanvas";
import {inject, observer} from "mobx-react";
import Fraction from "fraction.js";
import ToolTip from "../Tooltip";

@inject("video")
@observer
class Track extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      trackData: undefined,
      context: undefined,
      ref: React.createRef(),
      draw: undefined,
      hoverEntry: undefined
    };

    this.Hover = this.Hover.bind(this);
  }

  componentDidUpdate(prevProps, prevState) {
    // Don't redraw on hover updates
    if(this.state.hoverEntry === prevState.hoverEntry) {
      this.Draw();
    }
  }

  // Binary search to find an entry at the given time
  Search(time) {
    const entries = this.props.track.entries;

    let left = 0;
    let right = entries.length - 1;

    while(left <= right) {
      const i = Math.floor((left + right) / 2);
      const entry = entries[i];

      if(entry.startTime > time) {
        right = i - 1;
      } else if(entry.endTime < time) {
        left = i + 1;
      } else {
        return entry;
      }
    }
  }

  Hover(event) {
    // X position of mouse (as percent)
    const position = Fraction(event.clientX - this.state.context.canvas.offsetLeft).div(this.state.context.canvas.offsetWidth);

    // How much of the duration of the video is currently visible
    const duration = Fraction(this.props.video.scaleMax - this.props.video.scaleMin).div(this.props.video.scale).mul(this.props.video.duration);

    // Where the currently visible segment starts
    const startOffset = Fraction(this.props.video.scaleMin).div(this.props.video.scale).mul(this.props.video.duration);

    // Time corresponding to mouse position
    const timeAt = duration.mul(position).add(startOffset);

    // Search through track to find which element (if any) applies
    const entry = this.Search(timeAt.valueOf());

    if(entry !== this.state.hoverEntry) {
      this.setState({
        hoverEntry: entry
      });
    }
  }

  ToolTipContent() {
    if(!this.state.hoverEntry) { return null; }

    return (
      <div className="track-entry">
        <div className="track-entry-timestamps">
          {`${this.props.video.TimeToSMPTE(this.state.hoverEntry.startTime)} - ${this.props.video.TimeToSMPTE(this.state.hoverEntry.endTime)}`}
        </div>
        <div className="track-entry-content">
          { this.state.hoverEntry.text }
        </div>
      </div>
    );
  }

  Draw() {
    if(!this.state.context || !this.state.context.canvas) {
      return;
    }

    const context = this.state.context;

    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.beginPath();
    context.fillStyle = "#222";
    context.strokeStyle = "#f0f0f0";

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

      //context.fillRect(startPixel, startY, endPixel - startPixel, halfHeight);
      context.rect(startPixel, startY, endPixel - startPixel, halfHeight);
      context.stroke();
    });
  }

  Canvas() {
    if(!this.state.ref.current) { return null; }

    return (
      <TrackCanvas
        className="track"
        onMouseMove={this.Hover}
        SetRef={context => {
          context.canvas.width = this.state.ref.current.offsetWidth;
          this.setState({context});
        }}
      />
    );
  }

  render() {
    return (
      <ToolTip content={this.ToolTipContent()}>
        <div className="track-container" ref={this.state.ref}>
          <div hidden={true}>{this.props.track.mode + this.props.video.scaleMin + this.props.video.scaleMax + this.props.video.scale + this.props.video.duration || 0}</div>
          { this.Canvas() }
        </div>
      </ToolTip>
    );
  }
}

Track.propTypes = {
  track: PropTypes.object.isRequired,
  video: PropTypes.object
};

export default Track;
