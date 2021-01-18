import React from "react";
import {inject, observer} from "mobx-react";
import {Range, ToolTip} from "elv-components-js";
import PreviewReel from "../PreviewReel";
import ResizeObserver from "resize-observer-polyfill";

@inject("clipStore")
@inject("clipVideoStore")
@inject("videoStore")
@observer
class ClipTimeline extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      height: 0,
      width: 0,
      left: 0,
      indicatorPosition: -1,
      dragComponent: undefined,
      dropPosition: -1
    };

    this.WatchResize = this.WatchResize.bind(this);
    this.HandleDrop = this.HandleDrop.bind(this);
    this.DragMove = this.DragMove.bind(this);
  }

  componentWillUnmount() {
    if(this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
  }

  WatchResize(element) {
    if(!element) { return; }

    this.resizeObserver = new ResizeObserver(entries => {
      const { width, height, left } = entries[0].target.getBoundingClientRect();
      this.setState({width, height, left});
    });

    this.resizeObserver.observe(element);
  }

  HandleDrop() {
    if(!this.props.clipStore.heldClip) { return; }

    this.props.clipStore.PlaceClip({
      clip: this.props.clipStore.heldClip,
      startPosition: this.state.dropPosition
    });

    this.setState({indicatorPosition: -1});
  }

  DragMove(clientX) {
    if(!this.props.clipStore.heldClip) { return; }

    const position = clientX - this.state.left;
    const frame = this.PositionToFrame(position);

    const dragComponent = this.state.dragComponent;

    let startFrame = frame;
    let endFrame = frame;
    let dropPosition = frame;
    let indicatorPosition = position;

    if(dragComponent) {
      startFrame = frame - dragComponent.offsetFrames;
      endFrame = startFrame + dragComponent.widthFrames;
      dropPosition = frame - dragComponent.offsetFrames;
    }

    const existingClip = this.props.clipStore.timeline.find(clip =>
      clip.id !== this.props.clipStore.heldClip.id && clip.startPosition <= endFrame && clip.endPosition >= startFrame
    );

    if(existingClip) {
      const midpoint = existingClip.startPosition + (existingClip.endPosition - existingClip.startPosition) / 2;

      if(frame > midpoint) {
        indicatorPosition = this.FrameToPosition(existingClip.endPosition + 1);
        dropPosition = existingClip.endPosition;
      } else {
        indicatorPosition = this.FrameToPosition(existingClip.startPosition - 1);
        dropPosition = existingClip.startPosition - (this.props.clipStore.heldClip.end - this.props.clipStore.heldClip.start) - 1;
      }
    }

    this.setState({
      indicatorPosition: Math.max(0, indicatorPosition),
      dropPosition: Math.max(0, dropPosition)
    });
  }

  DropIndicator() {
    if(!this.props.clipStore.heldClip || this.state.indicatorPosition < 0 || this.state.indicatorPosition > this.state.width) {
      return;
    }

    return (
      <div
        style={{
          position: "absolute",
          left: this.state.indicatorPosition
        }}
        className="drop-indicator"
      />
    );
  }

  PlayheadIndicator() {
    return (
      <div
        style={{
          position: "absolute",
          left: this.FrameToPosition(this.props.clipVideoStore.frame)
        }}
        className="playhead-indicator"
      />
    );
  }

  PositionToFrame(position) {
    const fraction = ((this.state.width - position) / this.state.width);
    const totalFrames = this.props.clipStore.scaleEndFrame - this.props.clipStore.scaleStartFrame;

    return this.props.clipStore.scaleStartFrame + Math.floor(totalFrames * (1 - fraction));
  }

  FrameToPosition(frame) {
    const pixelsPerFrame = this.state.width / (this.props.clipStore.scaleEndFrame - this.props.clipStore.scaleStartFrame);

    return pixelsPerFrame * (frame - this.props.clipStore.scaleStartFrame);
  }

  Clip(clip) {
    const width = this.FrameToPosition(clip.endPosition) - this.FrameToPosition(clip.startPosition);

    return (
      <ToolTip
        key={`timeline-clip-${clip.id}`}
        content={`${this.props.videoStore.FrameToSMPTE(clip.startPosition)} - ${this.props.videoStore.FrameToSMPTE(clip.endPosition)}`}
      >
        <div
          draggable
          style={{
            left: this.FrameToPosition(clip.startPosition),
            width
          }}
          onClick={event => {
            event.stopPropagation();
            if(this.props.clipStore.selectedClipId === clip.id) {
              this.props.clipStore.ClearSelectedClip();
            } else {
              this.props.clipStore.SelectClip(clip.id);
            }
          }}
          onDragStart={event => {
            const rect = event.target.getBoundingClientRect();
            const pixelsPerFrame = this.state.width / (this.props.clipStore.scaleEndFrame - this.props.clipStore.scaleStartFrame);
            this.setState({
              dragComponent: {
                offsetFrames: Math.floor((event.clientX - rect.left) / pixelsPerFrame),
                widthFrames: Math.floor(rect.width / pixelsPerFrame)
              }
            });
            this.props.clipStore.HoldClip(clip);
          }}
          onDragEnd={() => {
            setTimeout(this.props.clipStore.ReleaseClip, 100);
            this.setState({dragComponent: undefined, indicatorPosition: -1});
          }}
          className={`clip-timeline-clip ${this.props.clipStore.selectedClipId === clip.id ? "selected" : ""}`}
        >
          <div className={`clip-info ${width < 25 ? "clip-info-hidden" : ""}`}>
            <div className="clip-label">
              { clip.label }
            </div>
          </div>
          <PreviewReel
            minFrame={clip.start}
            maxFrame={clip.end}
            RetrievePreview={() => "https://i.imgflip.com/oigoe.jpg"}
          />
        </div>
      </ToolTip>
    );
  }

  render() {
    return (
      <div
        onClick={() => this.props.clipStore.ClearSelectedClip()}
        onDragOver={event => {
          const clientX = event.clientX;
          event.stopPropagation();
          event.preventDefault();
          this.props.videoStore.DebounceControl({
            name: "clip-timeline-drag",
            delay: 50,
            Action: () => this.DragMove(clientX)
          });
        }}
        onDrop={this.HandleDrop}
        className="clip-timeline-container"
      >
        <Range
          marks={this.props.clipVideoStore.sliderMarks}
          markTextEvery={this.props.clipVideoStore.majorMarksEvery}
          showMarks
          topMarks
          handles={[]}
          min={this.props.clipStore.scaleMin}
          max={this.props.clipStore.scaleMax}
          renderToolTip={value => <span>{this.props.clipStore.ProgressToSMPTE(value)}</span>}
          className="clip-timeline-seek"
        />
        <div className="clip-timeline" ref={this.WatchResize}>
          { this.props.clipStore.timeline.length === 0 ? <div className="drop-hint">Drag Clips Here</div> : null }
          { this.PlayheadIndicator() }
          { this.DropIndicator() }
          { this.props.clipStore.timeline.map(clip => this.Clip(clip))}
        </div>
        <Range
          marks={this.props.clipVideoStore.sliderMarks}
          markTextEvery={this.props.clipVideoStore.majorMarksEvery}
          showMarks
          handleControlOnly
          handles={[
            {
              position: this.props.clipStore.scaleMin,
              style: "circle"
            },
            {
              position: this.props.clipStore.scaleMax,
              style: "circle"
            }
          ]}
          min={0}
          max={100}
          renderToolTip={value => <span>{this.props.clipStore.ProgressToSMPTE(value)}</span>}
          onChange={([scaleMin, scaleMax]) =>
            this.props.videoStore.DebounceControl({
              name: "clip-timeline-scale",
              delay: 100,
              Action: () => this.props.clipStore.SetScale(scaleMin, scaleMax)
            })
          }
          className="clip-timeline-scale"
        />
      </div>
    );
  }
}

export default ClipTimeline;
