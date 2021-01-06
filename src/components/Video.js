import React from "react";
import {inject, observer} from "mobx-react";
import HLSPlayer from "hls.js";
import VideoControls from "./VideoControls";
import LoadingElement from "elv-components-js/src/components/LoadingElement";
import Overlay from "./Overlay";
import {StopScroll} from "../utils/Utils";
import {ClipSeek, Scale} from "./controls/Controls";
import PreviewReel from "./PreviewReel";

@inject("tracksStore")
@inject("videoStore")
@inject("clipVideoStore")
@inject("clipStore")
@observer
class Video extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      videoWidth: 0,
      videoHeight: 0,
      player: undefined
    };

    this.InitializeVideo = this.InitializeVideo.bind(this);
  }

  componentWillUnmount() {
    if(this.state.player) {
      this.state.player.destroy();
    }
  }

  Store() {
    return this.props.clip ? this.props.clipVideoStore : this.props.videoStore;
  }

  InitializeVideo(video) {
    if(!video) { return; }

    // Add scroll handler for volume to video element
    StopScroll()(video);

    const config = {
      nudgeOffset: 0.2,
      nudgeMaxRetry: 30
    };

    const player = new HLSPlayer(config);

    this.setState({
      player,
      video
    });

    player.loadSource(this.Store().source);
    player.attachMedia(video);

    this.Store().Initialize(video, player);
  }

  Overlay() {
    if(!this.state.video || !this.props.overlay) { return; }

    return <Overlay element={this.state.video} />;
  }

  Video() {
    if(!this.Store().source) { return null; }

    return (
      <div className="video-container">
        { this.Overlay() }
        <video
          draggable={this.props.clippable}
          onDragStart={this.props.clippable ?
            () => this.props.clipStore.HoldClip({start: this.Store().clipInFrame, end: this.Store().clipOutFrame}) :
            undefined
          }
          onDragEnd={() => setTimeout(this.props.clipStore.ReleaseClip, 100)}
          crossOrigin="anonymous"
          ref={this.InitializeVideo}
          muted={true}
          autoPlay={false}
          controls={false}
          preload="auto"
          onWheel={({deltaY}) => this.Store().ScrollVolume(deltaY)}
        />
      </div>
    );
  }

  PreviewReel() {
    if(!this.props.previewReel) { return null; }

    return (
      <PreviewReel
        className="video-preview-reel"
        minFrame={this.Store().scaleMinFrame}
        maxFrame={this.Store().scaleMaxFrame}
        RetrievePreview={() => "https://i.imgflip.com/oigoe.jpg"}
      />
    );
  }

  render() {
    const videoLoading = this.Store().loading;
    const controlsLoading = videoLoading || (this.Store().source && !this.Store().initialized);

    if(!this.Store().isVideo) {
      return (
        <div tabIndex={0} className="video-component" />
      );
    }

    return (
      <div tabIndex={0} className="video-component">
        <LoadingElement loading={videoLoading} loadingClassname="video-controls-loading">
          { this.Video() }
        </LoadingElement>
        <LoadingElement loading={controlsLoading} loadingClassname="video-controls-loading">
          { this.PreviewReel() }
          { this.props.seekBar && !this.Store().fullScreen ? <ClipSeek clip={this.props.clip} sliderMarks={this.props.sliderMarks} /> : null }
          { this.props.seekBar && !this.Store().fullScreen ? <Scale clip={this.props.clip} sliderMarks={this.props.sliderMarks} /> : null }
          <VideoControls clip={this.props.clip} clippable={this.props.clippable} />
        </LoadingElement>
      </div>
    );
  }
}

export default Video;
