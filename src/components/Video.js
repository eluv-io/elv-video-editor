import React from "react";
import {inject, observer} from "mobx-react";
import Dash from "dashjs";
import VideoControls from "./VideoControls";

@inject("video")
@observer
class Video extends React.Component {
  constructor(props) {
    super(props);

    /*
    const url = "http://38.142.50.107/qlibs/ilib25dkW5Gp96LMxBcWnLks77tNtbT9/q/iq__3DW6PNhUTrabuBgZwzS3baDyUgrC/rep/dash/en/dash.mpd";
    const dashPlayer = Dash.MediaPlayer().create();
    dashPlayer.initialize(null, url, false);
    dashPlayer.preload();

    this.state = {
      dashPlayer
    };
    */

    this.InitializeVideo = this.InitializeVideo.bind(this);
    this.InitializeTracks = this.InitializeTracks.bind(this);
  }

  InitializeVideo(video) {
    if(!video) { return; }

    //this.state.dashPlayer.attachView(video);
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
        >
          <source src={this.props.video.source} type="video/mp4" />
          {this.props.video.trackInfo.map(track =>
            <track
              key={`track-${track.label}-${this.props.video.source}`}
              default={track.default}
              kind={track.kind}
              label={track.label}
              src={track.source}
              srcLang={track.label}
            />
          )}
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
