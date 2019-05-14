import React from "react";
import {inject, observer} from "mobx-react";
import Track from "./tracks/Track";
import {Slider, Range} from "elv-components-js";
import Fraction from "fraction.js/fraction";
import {ToolTip} from "elv-components-js";
import ResizeObserver from "resize-observer-polyfill";

@inject("video")
@observer
class Timeline extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      trackDimensions: new DOMRect(),
      trackContainerDimensions: new DOMRect()
    };

    this.WatchResize = this.WatchResize.bind(this);
  }

  componentWillUnmount() {
    if(this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
  }

  // Keep track of track container height and track content width to properly render the time indicator
  WatchResize(element) {
    if(element) {
      this.resizeObserver = new ResizeObserver((entries) => {
        const container = entries[0];
        const track = document.getElementsByClassName("track-lane-content")[0];

        this.setState({
          trackDimensions: track ? track.getBoundingClientRect() : new DOMRect(),
          trackContainerDimensions: container.contentRect
        });
      });

      this.resizeObserver.observe(element);
    }
  }

  TrackLane({label, content, key, active=false, toolTip, onLabelClick, className=""}) {
    return (
      <div key={`track-lane-${key || label}`} className={`track-lane ${className}`}>
        <ToolTip content={toolTip}>
          <div
            onClick={onLabelClick}
            className={`track-label ${active ? "track-label-active" : ""} ${onLabelClick ? "track-label-clickable" : ""}`}
          >
            {label}
          </div>
        </ToolTip>
        <div className="track-lane-content">
          { content }
        </div>
      </div>
    );
  }

  Seek() {
    return (
      <Slider
        key="video-progress"
        min={this.props.video.scaleMin}
        max={this.props.video.scaleMax}
        value={this.props.video.seek}
        showMarks={true}
        renderToolTip={value => <span>{this.props.video.ProgressToSMPTE(value)}</span>}
        onChange={(value) => this.props.video.Seek(Fraction(value).div(this.props.video.scale))}
        className="video-seek"
      />
    );
  }

  Scale() {
    return (
      <Range
        key="video-scale"
        min={0}
        max={this.props.video.scale}
        handles={[
          {
            position: this.props.video.scaleMin,
          },
          {
            position: this.props.video.seek,
            disabled: true,
            className: "video-seek-handle"
          },
          {
            position: this.props.video.scaleMax
          }
        ]}
        showMarks={true}
        renderToolTip={value => <span>{this.props.video.ProgressToSMPTE(value)}</span>}
        onChange={([scaleMin, seek, scaleMax]) => this.props.video.SetScale(scaleMin, seek, scaleMax)}
        className="video-scale"
      />
    );
  }

  CurrentTimeIndicator() {
    const scale = this.props.video.scaleMax - this.props.video.scaleMin;
    const indicatorPosition = (this.props.video.seek - this.props.video.scaleMin) * (this.state.trackDimensions.width / scale) + this.state.trackDimensions.left;

    return (
      <div
        style={{height: (this.state.trackContainerDimensions.height - 1) + "px", left: (indicatorPosition - 1) + "px"}}
        className="track-time-indicator"
      />
    );
  }

  Tracks() {
    return (
      <div ref={this.WatchResize} className="tracks-container">
        { this.CurrentTimeIndicator() }
        {
          this.props.video.tracks.slice()
            .sort((a, b) => a.label > b.label ? 1 : -1)
            .map(track => {
              const toggle = () => this.props.video.ToggleTrack(track.label);

              return (
                this.TrackLane({
                  label: track.label,
                  content: (
                    <Track track={track} width={this.state.trackDimensions.width} height={this.state.trackDimensions.height} />
                  ),
                  active: track.active,
                  toolTip: <span>{`${track.active ? "Disable" : "Enable"} ${track.label}`}</span>,
                  onLabelClick: toggle
                })
              );
            })
        }
      </div>
    );
  }

  render() {
    if(!this.props.video.initialized) { return null; }

    return (
      <div className="timeline">
        {this.TrackLane({
          label: <span className="mono">{`${this.props.video.frame} :: ${this.props.video.smpte}`}</span>,
          content: this.Seek(),
          widthDetection: true,
          key: "seek"
        })}
        {this.Tracks()}
        {this.TrackLane({content: this.Scale(), key: "scale", className: "video-scale-lane"})}
      </div>
    );
  }
}

export default Timeline;
