import React from "react";
import Video from "../Video";
import {inject, observer} from "mobx-react";
import ClipBin from "./ClipBin";
import {LoadingElement} from "elv-components-js";
import ClipTimeline from "./ClipTimeline";

@inject("videoStore")
@observer
class ClipView extends React.Component {
  render() {
    return (
      <div className="clip-view-container">
        <div className="video-level">
          <div className="clip-video-container">
            <Video seekBar clippable previewReel sliderMarks={Math.floor(this.props.videoStore.sliderMarks / 2)}/>
          </div>
          <div className="clip-video-container">
            <Video seekBar previewReel clip sliderMarks={Math.floor(this.props.videoStore.sliderMarks / 2)}/>
          </div>
        </div>
        <div className="lower-level">
          <LoadingElement loading={this.props.videoStore.loading || (this.props.videoStore.source && !this.props.videoStore.initialized)}>
            <ClipBin />
            <ClipTimeline />
          </LoadingElement>
        </div>
      </div>
    );
  }
}

export default ClipView;
