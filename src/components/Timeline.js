import React from "react";
import {inject, observer} from "mobx-react";
import Track from "./tracks/Track";
import AudioTrack from "./tracks/AudioTrack";
import PreviewTrack from "./tracks/PreviewTrack";
import {IconButton, onEnterPressed, ToolTip} from "elv-components-js";
import ResizeObserver from "resize-observer-polyfill";
import {ClipSeek, Scale} from "./controls/Controls";
import {Checkbox} from "./Components";
import LayerIcon from "../static/icons/Layers.svg";

@inject("tracksStore")
@inject("videoStore")
@inject("overlayStore")
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
        Segments: false,
        Subtitles: false,
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
    const clickable = trackId > 0 && trackType !== "audio";
    const selected = trackId && this.props.tracksStore.selectedTrack === trackId;
    const selectTrack = () => {
      if(!clickable) { return; }

      if(selected) {
        this.props.tracksStore.ClearSelectedTrack();
      } else {
        this.props.tracksStore.SetSelectedTrack(trackId);
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
    const scale = this.props.videoStore.scaleMax - this.props.videoStore.scaleMin;
    const indicatorPosition = (this.props.videoStore.seek - this.props.videoStore.scaleMin) * (this.state.indicatorTrackWidth / scale) + this.state.indicatorOffset;

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
      const overlayEnabled = this.props.overlayStore.overlayEnabled;
      const trackEnabled = this.props.overlayStore.enabledOverlayTracks[track.key];
      toggleButton = (
        <ToolTip content={overlayEnabled ? <span>{`${trackEnabled ? "Disable Overlay" : "Enable Overlay"}`}</span> : null}>
          <IconButton
            icon={LayerIcon}
            label={`${trackEnabled ? "Disable Overlay" : "Enable Overlay"}`}
            onClick={event => {
              event.stopPropagation();

              if(!overlayEnabled) { return; }

              this.props.overlayStore.ToggleOverlayTrack(track.key, !trackEnabled);
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
          onChange={() => this.props.tracksStore.ToggleTrack(track.label)}
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
    let previewTrack, subtitleTracks, metadataTracks, segmentTracks, audioTracks, clipTrack;
    if(this.state.show.Preview && this.props.videoStore.previewSupported) {
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
      subtitleTracks = this.props.tracksStore.tracks
        .filter(track => track.trackType === "vtt").slice()
        .sort((a, b) => (a.label > b.label ? 1 : -1))
        .map(track => this.Track(track));
    }

    if(this.state.show.Segments) {
      segmentTracks = this.props.tracksStore.tracks
        .filter(track => track.trackType === "segments").slice()
        .sort((a, b) => (a.label > b.label ? 1 : -1))
        .map(track => this.Track(track));
    }

    if(this.state.show.Tags) {
      metadataTracks = this.props.tracksStore.tracks
        .filter(track => track.trackType !== "vtt" && track.trackType !== "clip" && track.trackType !== "segments").slice()
        .sort((a, b) => (a.label > b.label ? 1 : -1))
        .map(track => this.Track(track));
    }

    if(this.state.show.Audio) {
      audioTracks = this.props.tracksStore.audioTracks
        .map(track => this.Track(track));
    }

    clipTrack = this.Track(this.props.tracksStore.tracks.find(track => track.trackType === "clip"));

    return (
      <div ref={this.WatchResize} className="tracks-container">
        { this.CurrentTimeIndicator() }
        { clipTrack }
        { previewTrack }
        { subtitleTracks }
        { metadataTracks }
        { segmentTracks }
        { audioTracks }
      </div>
    );
  }

  TrackToggleButton(name, overlay=false, click) {
    const enabled = overlay ? this.props.overlayStore.overlayEnabled : this.state.show[name];

    const onClick = () => {
      if(click) { click(); }

      if(overlay) {
        this.props.overlayStore.ToggleOverlay(!this.props.overlayStore.overlayEnabled);
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
    const subtitleTracks = this.props.tracksStore.tracks.filter(track => track.trackType === "vtt");
    const metadataTracks = this.props.tracksStore.tracks.filter(track => track.trackType === "metadata");
    const overlayTrack = this.props.overlayStore.overlayTrack;

    const previewToggle = this.props.videoStore.previewSupported ? this.TrackToggleButton("Preview") : null;
    const subtitleToggle = subtitleTracks.length > 0 ? this.TrackToggleButton("Subtitles") : null;
    const metadataToggle = metadataTracks.length > 0 ? this.TrackToggleButton("Tags") : null;
    const overlayToggle = overlayTrack ? this.TrackToggleButton("Overlay", true) : null;
    const segmentsToggle = this.props.videoStore.isVideo ? this.TrackToggleButton("Segments") : null;
    const audioToggle = this.props.videoStore.isVideo ? this.TrackToggleButton("Audio", false, this.props.tracksStore.AddAudioTracks) : null;

    return (
      <div className="timeline-actions toggle-tracks">
        { overlayToggle }
        { previewToggle }
        { subtitleToggle }
        { metadataToggle }
        { segmentsToggle }
        { audioToggle }
      </div>
    );
  }

  AddTrackButton() {
    return (
      <div className="timeline-actions">
        <button onClick={() => this.props.tracksStore.CreateTrack({label: "New Track", key: "new_track"})}>
          Add Track
        </button>
      </div>
    );
  }

  render() {
    if(!this.props.videoStore.initialized) { return null; }

    return (
      <>
        {this.TrackLane({
          trackId: -2,
          label: <span className="mono">{`${this.props.videoStore.frame} :: ${this.props.videoStore.smpte}`}</span>,
          content: <Scale />,
          className: "video-seek-lane"
        })}
        {this.TrackLane({
          trackId: -1,
          label: <span className="mono">{`${this.props.videoStore.scaleMinSMPTE} - ${this.props.videoStore.scaleMaxSMPTE}`}</span>,
          content: <ClipSeek />,
          className: "video-scale-lane"
        })}
        <div className="timeline">
          { this.Tracks() }
          { this.AddTrackButton() }
          { this.TrackToggle() }
        </div>
      </>
    );
  }
}

export default Timeline;
