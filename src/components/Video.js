import React from "react";
import {inject, observer} from "mobx-react";
import DashPlayer from "dashjs";
import VideoControls from "./VideoControls";

@inject("tracks")
@inject("video")
@observer
class Video extends React.Component {
  constructor(props) {
    super(props);

    this.InitializeVideo = this.InitializeVideo.bind(this);
    this.InitializeTracks = this.InitializeTracks.bind(this);
  }

  InitializeVideo(video) {
    if(!video) { return; }

    const dashPlayer = DashPlayer.MediaPlayer().create();

    dashPlayer.initialize(video, this.props.video.source, false);
    dashPlayer.preload();

    this.setState({dashPlayer});

    this.props.video.Initialize(video);
  }

  InitializeTracks(trackContainer) {
    this.props.video.InitializeTracks(trackContainer);
  }

  Poster() {
    if(this.props.video.frame > 0 || !this.props.video.poster) { return null; }

    return (
      <img onClick={this.props.video.PlayPause} src={this.props.video.poster} className="video-poster" />
    );
  }

  Tracks() {
    if(!this.props.video.initialized) { return null; }

    return (
      this.props.tracks.subtitleTracks.map(track =>
        <track
          key={`track-${track.label}`}
          default={track.default}
          kind={track.kind}
          label={track.label}
          src={track.source}
          srcLang={track.label}
        />
      )
    );
  }

  Video() {
    if(!this.props.video.source) { return null; }

    return (
      <div className="video-container">
        <video
          key={`video-${this.props.video.source}`}
          crossOrigin="anonymous"
          ref={this.InitializeVideo}
          muted={true}
          autoPlay={false}
          controls={false}
          preload="auto"
          onWheel={({deltaY}) => this.props.video.ScrollVolume(deltaY)}
          data-dashjs-player
        >
          { this.Tracks() }
        </video>
        { this.Poster() }
      </div>
    );
  }

  render() {
    const controls = this.props.video.initialized ? <VideoControls /> : null;

    return (
      <div className="video">
        { this.Video() }
        { controls }
      </div>
    );
  }
}

export default Video;
