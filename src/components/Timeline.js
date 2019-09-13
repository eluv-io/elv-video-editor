import React from "react";
import {inject, observer} from "mobx-react";
import Track from "./tracks/Track";
import AudioTrack from "./tracks/AudioTrack";
import PreviewTrack from "./tracks/PreviewTrack";
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
      indicatorTrackWidth: 0,
      indicatorHeight: 0,
      indicatorOffset: 0,
      show: {
        Audio: false,
        Preview: true,
        Subtitles: true,
        Tags: true,
      }
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
        const trackLanes = entries[0].target.getElementsByClassName("track-lane-content");

        if(trackLanes.length === 0) {
          this.setState({
            indicatorTrackWidth: 0,
            indicatorHeight: 0,
            indicatorOffset: 0
          });

          return;
        }

        this.setState({
          indicatorTrackWidth: trackLanes[0].offsetWidth,
          indicatorHeight: container.contentRect.height,
          indicatorOffset: trackLanes[0].offsetLeft
        });
      });

      this.resizeObserver.observe(element);
    }
  }

  TrackLane({trackId, trackType, label, content, className=""}) {
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
      <div key={`track-lane-${trackId || label}`} className={`track-lane ${className}`}>
        <div
          onClick={selectTrack}
          onKeyPress={onEnterPressed(selectTrack)}
          tabIndex={trackId ? 0 : undefined}
          className={`
              track-label-container
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
    const indicatorPosition = (this.props.video.seek - this.props.video.scaleMin) * (this.state.indicatorTrackWidth / scale) + this.state.indicatorOffset;

    return (
      <div
        style={{height: this.state.indicatorHeight + "px", left: (indicatorPosition - 1) + "px"}}
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
            <AudioTrack track={track} /> :
            <Track track={track} />
        ),
        labelToolTip: <span>{tooltip}</span>
      })
    );
  }

  Tracks() {
    let previewTrack, subtitleTracks, metadataTracks, audioTracks;
    if(this.state.show.Preview && this.props.video.previewSupported) {
      previewTrack = this.TrackLane({
        trackType: "preview",
        label: "Preview",
        className: "track-lane-preview",
        content: (
          <PreviewTrack />
        )
      });
    }

    if(this.state.show.Subtitles) {
      subtitleTracks = this.props.tracks.tracks
        .filter(track => track.trackType === "vtt").slice()
        .sort((a, b) => (a.label > b.label ? 1 : -1))
        .map(track => this.Track(track));
    }

    if(this.state.show.Tags) {
      metadataTracks = this.props.tracks.tracks
        .filter(track => track.trackType !== "vtt").slice()
        .sort((a, b) => (a.label > b.label ? 1 : -1))
        .map(track => this.Track(track));
    }

    if(this.state.show.Audio) {
      audioTracks = this.props.tracks.audioTracks
        .map(track => this.Track(track));
    }

    return (
      <div ref={this.WatchResize} className="tracks-container">
        { this.CurrentTimeIndicator() }
        { previewTrack }
        { subtitleTracks }
        { metadataTracks }
        { audioTracks }
      </div>
    );
  }

  TrackToggleButton(name) {
    const enabled = this.state.show[name];
    return (
      <button
        onClick={() => this.setState({show: {...this.state.show, [name]: !enabled}})}
        className={`${enabled ? "enabled" : ""}`}
      >
        { name }
      </button>
    );
  }

  TrackToggle() {
    const subtitleTracks = this.props.tracks.tracks.filter(track => track.trackType === "vtt");
    const metadataTracks = this.props.tracks.tracks.filter(track => track.trackType === "metadata");
    const audioTracks = this.props.tracks.audioTracks;

    const previewToggle = this.props.video.previewSupported ? this.TrackToggleButton("Preview") : null;
    const subtitleToggle = subtitleTracks.length > 0 ? this.TrackToggleButton("Subtitles") : null;
    const metadataToggle = metadataTracks.length > 0 ? this.TrackToggleButton("Tags") : null;
    const audioToggle = audioTracks.length > 0 ? this.TrackToggleButton("Audio") : null;

    return (
      <div className="timeline-actions toggle-tracks">
        { previewToggle }
        { subtitleToggle }
        { metadataToggle }
        { audioToggle }
      </div>
    );
  }

  AddTrackButton() {
    return (
      <div className="timeline-actions">
        <button onClick={() => this.props.tracks.CreateTrack({label: "New Track", key: "new_track"})}>
          Add Track
        </button>
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
          className: "video-scale-lane"
        })}
        { this.Tracks() }
        { this.AddTrackButton() }
        { this.TrackToggle() }
      </div>
    );
  }
}

export default Timeline;
