import React from "react";
import {inject, observer} from "mobx-react";
import Track from "./tracks/Track";
import {onEnterPressed, ToolTip} from "elv-components-js";
import ResizeObserver from "resize-observer-polyfill";
import {Seek, Scale} from "./controls/Controls";

@inject("tracks")
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

  TrackLane({label, content, key, active=false, labelToolTip, onLabelClick, className=""}) {
    return (
      <div key={`track-lane-${key || label}`} className={`track-lane ${className}`}>
        <ToolTip content={labelToolTip}>
          <div
            onClick={onLabelClick}
            onKeyPress={onEnterPressed(onLabelClick)}
            tabIndex={onLabelClick ? 0 : undefined}
            className={`
              track-label
              ${active ? "track-label-active" : ""}
              ${onLabelClick ? "track-label-clickable" : ""}
            `}
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

  Track(track) {
    const toggleable = track.vttTrack;
    const toggle = toggleable ? () => this.props.tracks.ToggleTrack(track.label) : undefined;
    const tooltip = toggleable ? `${track.active ? "Disable" : "Enable"} ${track.label}` : track.label;

    return (
      this.TrackLane({
        label: track.label,
        content: (
          <Track track={track} width={this.state.trackDimensions.width} height={this.state.trackDimensions.height} />
        ),
        active: track.active,
        labelToolTip: <span>{tooltip}</span>,
        onLabelClick: toggle
      })
    );
  }

  Tracks() {
    return (
      <div ref={this.WatchResize} className="tracks-container">
        { this.CurrentTimeIndicator() }
        {
          this.props.tracks.tracks
            .filter(track => track.vttTrack).slice()
            .sort((a, b) => (a.label > b.label ? 1 : -1))
            .map(track => this.Track(track))
        }
        {
          this.props.tracks.tracks
            .filter(track => !track.vttTrack).slice()
            .sort((a, b) => (a.label > b.label ? 1 : -1))
            .map(track => this.Track(track))
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
          content: <Seek />,
          key: "seek"
        })}
        {this.Tracks()}
        {this.TrackLane({
          content: <Scale />,
          key: "scale",
          className: "video-scale-lane"
        })}
      </div>
    );
  }
}

export default Timeline;
