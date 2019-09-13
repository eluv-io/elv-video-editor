import React from "react";
import {inject, observer} from "mobx-react";
import ResizeObserver from "resize-observer-polyfill";

@inject("video")
@inject("tracks")
@observer
class PreviewTrack extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      previews: 10
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
      this.resizeObserver = new ResizeObserver(entries => {
        const track = entries[0];

        // Set number of previews on the timeline based on width
        this.setState({previews: Math.ceil(track.contentRect.width / 125)});
      });

      this.resizeObserver.observe(element);
    }
  }

  Previews() {
    const previews = this.state.previews;
    const interval = (this.props.video.ScaleMaxTime() - this.props.video.ScaleMinTime()) / previews;
    const startTime = this.props.video.ScaleMinTime() + interval * 0.5;

    return [...(Array(previews).keys())].map(i => {
      const time = startTime + interval * i;
      const frame = this.props.video.TimeToFrame(time);

      return (
        <div className="preview-frame" key={`preview-frame-${frame}`}>
          <img
            src={this.props.video.VideoFrame(frame)}
          />
        </div>
      );
    });
  }

  render() {
    return (
      <div
        ref={this.WatchResize}
        onWheel={({deltaY, clientX}) => this.props.video.ScrollScale(this.ClientXToCanvasPosition(clientX), deltaY)}
        className="track-container preview-track-container"
      >
        { this.Previews() }
      </div>
    );
  }
}

export default PreviewTrack;
