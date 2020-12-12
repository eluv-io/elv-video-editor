import React from "react";
import {inject, observer} from "mobx-react";
import {ImageIcon} from "elv-components-js";

import ClipIcon from "../../static/icons/film.svg";

@inject("clipStore")
@inject("videoStore")
@observer
class ClipBin extends React.Component {
  Clip() {
    const clip = {
      start: 500,
      end: 3000,
      image: "https://i.imgflip.com/oigoe.jpg"
    };

    return (
      <div className="clip">
        <div className="clip-preview-container">
          <ImageIcon icon={clip.image || ClipIcon} alternateIcon={ClipIcon} className="clip-preview" />
        </div>
        <div className="clip-info">
          <div className="clip-time">
            { this.props.videoStore.FrameToSMPTE(clip.start) }
          </div>
          &nbsp; - &nbsp;
          <div className="clip-time">
            { this.props.videoStore.FrameToSMPTE(clip.end) }
          </div>
        </div>
      </div>
    );
  }

  render() {
    return (
      <div className="clip-bin">
        { this.Clip() }
        { this.Clip() }
        { this.Clip() }
        { this.Clip() }
        { this.Clip() }
        { this.Clip() }
      </div>
    );
  }
}

export default ClipBin;
