import React from "react";
import {inject, observer} from "mobx-react";
import Track from "./tracks/Track";
import AudioTrack from "./tracks/AudioTrack";
import {onEnterPressed} from "elv-components-js";
import ResizeObserver from "resize-observer-polyfill";
import {Scale} from "./controls/Controls";
import {Checkbox} from "./Components";

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

  TrackLane({trackId, trackType, label, content, key, className=""}) {
    const clickable = trackId && trackType !== "audio";
    const selected = trackId && this.props.tracks.selectedTrack === trackId;
    const selectTrack = () => {
      if(!clickable) { return; }

      if(selected) {
        this.props.tracks.ClearSelectedTrack();
      } else {
        this.props.tracks.SetSelectedTrack(trackId);
      }
    };

    return (
      <div key={`track-lane-${key || label}`} className={`track-lane ${className}`}>
        <div
          onClick={selectTrack}
          onKeyPress={onEnterPressed(selectTrack)}
          tabIndex={trackId ? 0 : undefined}
          className={`
              track-label
              ${selected ? "track-label-selected" : ""}
              ${clickable? "track-label-clickable" : ""}
            `}
        >
          {label}
        </div>
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

  TrackLabel(track) {
    const toggleable = track.trackType === "vtt";
    const Toggle = toggleable ? () => this.props.tracks.ToggleTrack(track.label) : undefined;

    let toggleButton;
    if(toggleable) {
      const tooltip = <span>{track.active ? "Disable" : "Enable"} {track.label}</span>;

      toggleButton = (
        <Checkbox
          value={track.active}
          onChange={Toggle}
          toolTip={tooltip}
          className="track-toggle"
        />
      );
    }

    return (
      <div className="track-label">
        { track.label }
        { toggleButton }
      </div>
    );
  }

  Track(track) {
    const toggleable = track.trackType === "vtt";
    const tooltip = toggleable ? `${track.active ? "Disable" : "Enable"} ${track.label}` : track.label;

    return (
      this.TrackLane({
        trackId: track.trackId,
        trackType: track.trackType,
        label: this.TrackLabel(track),
        className: track.trackType === "audio" ? "track-lane-audio" : "",
        content: (
          track.trackType === "audio" ?
            <AudioTrack track={track} width={this.state.trackDimensions.width} height={this.state.trackDimensions.height} /> :
            <Track track={track} width={this.state.trackDimensions.width} height={this.state.trackDimensions.height} />
        ),
        labelToolTip: <span>{tooltip}</span>
      })
    );
  }

  Tracks() {
    return (
      <div ref={this.WatchResize} className="tracks-container">
        { this.CurrentTimeIndicator() }
        {
          this.props.tracks.tracks
            .filter(track => track.trackType === "vtt").slice()
            .sort((a, b) => (a.label > b.label ? 1 : -1))
            .map(track => this.Track(track))
        }
        {
          this.props.tracks.tracks
            .filter(track => track.trackType !== "vtt").slice()
            .sort((a, b) => (a.label > b.label ? 1 : -1))
            .map(track => this.Track(track))
        }
        {
          this.props.tracks.audioTracks
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
          content: <Scale />,
          key: "scale",
          className: "video-scale-lane"
        })}
        {this.Tracks()}
      </div>
    );
  }
}

export default Timeline;
