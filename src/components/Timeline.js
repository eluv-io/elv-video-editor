import React from "react";
import {inject, observer} from "mobx-react";
import Track from "./tracks/Track";
import AudioTrack from "./tracks/AudioTrack";
import PreviewTrack from "./tracks/PreviewTrack";
import {IconButton, onEnterPressed, ToolTip} from "elv-components-js";
import ResizeObserver from "resize-observer-polyfill";
import {Scale, Seek} from "./controls/Controls";
import {Checkbox} from "./Components";
import LayerIcon from "../static/icons/Layers.svg";

@inject("tracks")
@inject("video")
@inject("overlay")
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
        this.props.video.SetMarks();

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
    const clickable = trackId > 0 && trackType !== "audio";
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
    let toggleButton;
    if(track.hasOverlay) {
      const overlayEnabled = this.props.overlay.overlayEnabled;
      const trackEnabled = this.props.overlay.enabledOverlayTracks[track.key];
      toggleButton = (
        <ToolTip content={overlayEnabled ? <span>{`${trackEnabled ? "Disable Overlay" : "Enable Overlay"}`}</span> : null}>
          <IconButton
            icon={LayerIcon}
            label={`${trackEnabled ? "Disable Overlay" : "Enable Overlay"}`}
            onClick={event => {
              event.stopPropagation();

              if(!overlayEnabled) { return; }

              this.props.overlay.ToggleOverlayTrack(track.key, !trackEnabled);
            }}
            className={`overlay-toggle ${trackEnabled && overlayEnabled ? "overlay-toggle-enabled" : "overlay-toggle-disabled"}`}
          />
        </ToolTip>
      );
    }

    if(track.trackType === "vtt") {
      toggleButton = (
        <Checkbox
          value={track.active}
          onChange={() => this.props.tracks.ToggleTrack(track.label)}
          toolTip={<span>{track.active ? "Disable" : "Enable"} {track.label}</span>}
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
    if(!track) { return; }

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
            <Track track={track} noActive={track.trackType === "clip"} />
        ),
        labelToolTip: <span>{tooltip}</span>
      })
    );
  }

  Tracks() {
    let previewTrack, subtitleTracks, metadataTracks, audioTracks, clipTrack;
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
        .filter(track => track.trackType !== "vtt" && track.trackType !== "clip").slice()
        .sort((a, b) => (a.label > b.label ? 1 : -1))
        .map(track => this.Track(track));
    }

    if(this.state.show.Audio) {
      audioTracks = this.props.tracks.audioTracks
        .map(track => this.Track(track));
    }

    clipTrack = this.Track(this.props.tracks.tracks.find(track => track.trackType === "clip"));

    return (
      <div ref={this.WatchResize} className="tracks-container">
        { this.CurrentTimeIndicator() }
        { clipTrack }
        { previewTrack }
        { subtitleTracks }
        { metadataTracks }
        { audioTracks }
      </div>
    );
  }

  TrackToggleButton(name, overlay=false, click) {
    const enabled = overlay ? this.props.overlay.overlayEnabled : this.state.show[name];

    const onClick = () => {
      if(click) { click(); }

      if(overlay) {
        this.props.overlay.ToggleOverlay(!this.props.overlay.overlayEnabled);
      } else {
        this.setState({show: {...this.state.show, [name]: !enabled}});
      }
    };

    return (
      <button
        onClick={onClick}
        className={`${enabled ? "enabled" : ""}`}
      >
        { name }
      </button>
    );
  }

  TrackToggle() {
    const subtitleTracks = this.props.tracks.tracks.filter(track => track.trackType === "vtt");
    const metadataTracks = this.props.tracks.tracks.filter(track => track.trackType === "metadata");
    const overlayTrack = this.props.overlay.overlayTrack;

    const previewToggle = this.props.video.previewSupported ? this.TrackToggleButton("Preview") : null;
    const subtitleToggle = subtitleTracks.length > 0 ? this.TrackToggleButton("Subtitles") : null;
    const metadataToggle = metadataTracks.length > 0 ? this.TrackToggleButton("Tags") : null;
    const overlayToggle = overlayTrack ? this.TrackToggleButton("Overlay", true) : null;
    const audioToggle = this.TrackToggleButton("Audio", false, this.props.tracks.AddAudioTracks);

    return (
      <div className="timeline-actions toggle-tracks">
        { overlayToggle }
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
          trackId: -1,
          label: <span className="mono">{`${this.props.video.scaleMinSMPTE} - ${this.props.video.scaleMaxSMPTE}`}</span>,
          content: <Scale />,
          className: "video-scale-lane"
        })}
        {this.TrackLane({
          trackId: -2,
          label: <span className="mono">{`${this.props.video.frame} :: ${this.props.video.smpte}`}</span>,
          content: <Seek />,
          className: "video-seek-lane"
        })}
        { this.Tracks() }
        { this.AddTrackButton() }
        { this.TrackToggle() }
      </div>
    );
  }
}

export default Timeline;
