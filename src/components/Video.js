import React from "react";
import {inject, observer} from "mobx-react";
import HLSPlayer from "hls.js";
import URI from "urijs";
import VideoControls from "./VideoControls";
import LoadingElement from "elv-components-js/src/components/LoadingElement";
import Overlay from "./Overlay";
import ResizeObserver from "resize-observer-polyfill";

@inject("tracks")
@inject("video")
@observer
class Video extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      videoWidth: 0,
      player: undefined
    };

    this.InitializeVideo = this.InitializeVideo.bind(this);
    this.InitializeTracks = this.InitializeTracks.bind(this);
  }

  componentWillUnmount() {
    if(this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
  }

  InitializeVideo(video) {
    if(!video) { return; }

    const player = new HLSPlayer();
    const source = URI(this.props.video.source).addSearch("player_profile", "hls-js").toString();
    player.loadSource(source);
    player.attachMedia(video);
    this.setState({player});

    this.props.video.Initialize(video);

    // Add resize observer for overlay component
    this.resizeObserver = new ResizeObserver((elements) => {
      this.setState({
        videoWidth: elements[0].contentRect.width
      });
    });

    this.resizeObserver.observe(video);
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
        <Overlay videoWidth={this.state.videoWidth} />
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
        />
        { this.Poster() }
      </div>
    );
  }

  render() {
    const videoLoading = this.props.video.loading;
    const controlsLoading = this.props.video.source && !this.props.video.initialized;

    return (
      <div className="video-component">
        <LoadingElement loading={videoLoading}>
          { this.Video() }
        </LoadingElement>
        <LoadingElement loading={controlsLoading} loadingClassname="video-controls-loading">
          <VideoControls />
        </LoadingElement>
      </div>
    );
  }
}

export default Video;
