import React from "react";
import {inject, observer} from "mobx-react";
import Track from "./tracks/Track";
import {Range, Slider} from "./Slider";
import Fraction from "fraction.js/fraction";

@inject("video")
@observer
class Tracks extends React.Component {
  constructor(props) {
    super(props);
  }

  TrackLane(label, content) {
    return (
      <div className="track-lane">
        <div className="track-label">{label}</div>
        { content }
      </div>
    );
  }

  Seek() {
    const scale = this.props.video.scale;

    return (
      <Slider
        key="video-progress"
        min={this.props.video.scaleMin}
        max={this.props.video.scaleMax}
        value={this.props.video.seek}
        tipFormatter={value => this.props.video.ProgressToSMPTE(value)}
        onChange={(value) => this.props.video.Seek(Fraction(value).div(scale))}
        className="video-seek"
      />
    );
  }

  Scale() {
    return (
      <div
        key="video-scale"
        onWheel={({deltaY}) => this.props.video.ScrollScale(deltaY)}
      >
        <Range
          key="video-scale"
          min={0}
          max={this.props.video.scale}
          value={[this.props.video.scaleMin, this.props.video.seek, this.props.video.scaleMax]}
          allowCross={false}
          tipFormatter={value => this.props.video.ProgressToSMPTE(value)}
          onChange={([scaleMin, seek, scaleMax]) => this.props.video.SetScale(scaleMin, seek, scaleMax)}
          className="video-scale"
        />
      </div>
    );
  }

  Tracks() {
    return (
      <div
        onWheel={({deltaY}) => this.props.video.ScrollScale(deltaY)}
        className="tracks-container"
      >
        {this.props.video.tracks.map(track =>
          this.TrackLane(
            track.label,
            <Track
              key={`track-${track.label}`}
              track={track}
              video={this.props.video}
            />
          )
        )}
      </div>
    );
  }

  render() {
    if(!this.props.video.initialized) { return null; }

    return (
      <div className="timeline">
        {this.TrackLane("", this.Seek())}
        {this.Tracks()}
        {this.TrackLane("", this.Scale())}
      </div>
    );
  }
}

export default Tracks;
