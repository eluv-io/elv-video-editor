import React from "react";
import {inject, observer} from "mobx-react";
import ResizeObserver from "resize-observer-polyfill";
import {StopScroll} from "../../utils/Utils";

@inject("videoStore")
@inject("tracksStore")
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
    if(!element) { return; }

    StopScroll()(element);

    this.resizeObserver = new ResizeObserver(entries => {
      const track = entries[0].target.parentNode;

      // Set number of previews on the timeline based on width
      this.setState({previews: Math.ceil(track.offsetWidth / 125)});
    });

    this.resizeObserver.observe(element);
  }

  Previews() {
    const previews = this.state.previews;
    const interval = (this.props.videoStore.scaleMaxTime - this.props.videoStore.scaleMinTime) / previews;
    const startTime = this.props.videoStore.scaleMinTime + interval * 0.5;

    return [...(Array(previews).keys())].map(i => {
      const time = startTime + interval * i;
      const frame = this.props.videoStore.TimeToFrame(time);

      return (
        <div className="preview-frame" key={`preview-frame-${frame}`}>
          <img
            src={this.props.videoStore.VideoFrame(frame)}
          />
        </div>
      );
    });
  }

  render() {
    return (
      <div
        ref={this.WatchResize}
        onWheel={({deltaY, clientX, shiftKey}) => shiftKey && this.props.videoStore.ScrollScale(this.ClientXToCanvasPosition(clientX), deltaY)}
        className="track-container preview-track-container"
      >
        { this.Previews() }
      </div>
    );
  }
}

export default PreviewTrack;
