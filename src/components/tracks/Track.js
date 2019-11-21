import React from "react";
import PropTypes from "prop-types";
import TrackCanvas from "./TrackCanvas";
import {inject, observer} from "mobx-react";
import Fraction from "fraction.js";
import {ToolTip} from "elv-components-js";
import {reaction, toJS} from "mobx";

import TrackWorker from "../../workers/TrackWorker";

@inject("video")
@inject("entry")
@inject("tracks")
@observer
class Track extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      context: undefined,
      canvasHeight: 0,
      canvasWidth: 0
    };

    this.activeEntryIds = [];

    this.OnCanvasResize = this.OnCanvasResize.bind(this);
    this.Click = this.Click.bind(this);
    this.Hover = this.Hover.bind(this);
    this.ClearHover = this.ClearHover.bind(this);
  }

  componentDidMount() {
    // Initialize reactionary re-draw handlers
    this.setState({
      reactions: [
        // Update on entries change
        reaction(
          () => ({
            version: this.props.track.version,
            entries: this.props.track.entries.length
          }),
          () => {
            this.state.worker.postMessage({
              operation: "SetEntries",
              trackId: this.props.track.trackId,
              entries: toJS(this.props.track.entries)
            });
          },
          {delay: 25}
        ),
        // Update on scale change
        reaction(
          () => ({
            scale: this.props.video.scale,
            scaleMax: this.props.video.scaleMax,
            scaleMin: this.props.video.scaleMin,
            duration: this.props.video.duration
          }),
          () => {
            this.state.worker.postMessage({
              operation: "SetScale",
              trackId: this.props.track.trackId,
              scale: {
                scale: this.props.video.scale,
                scaleMin: this.props.video.scaleMin,
                scaleMax: this.props.video.scaleMax,
              },
              duration: this.props.video.duration
            });
          },
          {delay: 50}
        ),
        // Update on filter change
        reaction(
          () => ({
            filter: this.props.entry.filter
          }),
          () => {
            this.state.worker.postMessage({
              operation: "SetFilter",
              trackId: this.props.track.trackId,
              filter: this.props.entry.filter
            });
          },
          {delay: 100}
        ),
        // Update on selected / hover change
        reaction(
          () => ({
            hoverEntries: this.props.entry.hoverEntries,
            selectedEntries: this.props.entry.entries,
            selectedEntry: this.props.entry.selectedEntry
          }),
          () => {
            const selectedEntryIds = toJS(this.props.entry.entries);
            const selectedEntryId = toJS(this.props.entry.selectedEntry ? this.props.entry.selectedEntry : undefined);
            const hoverEntryIds = toJS(this.props.entry.hoverEntries);

            this.state.worker.postMessage({
              operation: "SetSelected",
              trackId: this.props.track.trackId,
              selectedEntryId,
              selectedEntryIds,
              hoverEntryIds
            });
          },
          {delay: 75}
        ),
        // Update on active entry changed
        reaction(
          () => ({
            frame: this.props.video.frame
          }),
          () => {
            const activeEntryIds = toJS(this.Search(this.props.video.currentTime)).sort();

            if(activeEntryIds.toString() === this.activeEntryIds.toString()) { return; }

            this.activeEntryIds = activeEntryIds;

            this.state.worker.postMessage({
              operation: "SetActive",
              trackId: this.props.track.trackId,
              activeEntryIds
            });
          },
          {delay: 50}
        ),
        // Update on resize
        reaction(
          () => ({
            width: this.state.canvasWidth,
            height: this.state.canvasHeight
          }),
          ({width, height}) => {
            if(this.state.context) {
              this.state.context.canvas.width = width;
              this.state.context.canvas.height = height;

              this.state.worker.postMessage({
                operation: "Resize",
                trackId: this.props.track.trackId,
                width: this.state.canvasWidth,
                height: this.state.canvasHeight
              });
            }
          },
          {delay: 100}
        )
      ]
    });
  }

  componentWillUnmount() {
    this.state.reactions.forEach(dispose => dispose());

    this.state.worker.postMessage({
      operation: "Destroy",
      trackId: this.props.track.trackId
    });
  }

  OnCanvasResize({height, width}) {
    this.setState({
      canvasHeight: height,
      canvasWidth: width
    });
  }

  // X position of mouse over canvas (as percent)
  ClientXToCanvasPosition(clientX) {
    return Fraction(clientX - this.state.context.canvas.offsetLeft).div(this.state.context.canvas.offsetWidth).valueOf();
  }

  // Binary search to find an entry at the given time
  Search(time) {
    return this.props.track.intervalTree.search(time, time);
  }

  TimeAt(clientX) {
    // How much of the duration of the video is currently visible
    const duration = Fraction(this.props.video.scaleMax - this.props.video.scaleMin).div(this.props.video.scale).mul(this.props.video.duration);

    // Where the currently visible segment starts
    const startOffset = Fraction(this.props.video.scaleMin).div(this.props.video.scale).mul(this.props.video.duration);

    // Time corresponding to mouse position
    return duration.mul(this.ClientXToCanvasPosition(clientX)).add(startOffset).valueOf();
  }

  Click({clientX}) {
    const time = this.TimeAt(clientX);
    const entries = this.Search(time);

    this.props.tracks.SetSelectedTrack(this.props.track.trackId);
    this.props.entry.SetEntries(entries, this.props.video.TimeToSMPTE(time));
  }

  Hover({clientX}) {
    const time = this.TimeAt(clientX);
    const entries = this.Search(time);

    this.props.entry.SetHoverEntries(entries, this.props.track.trackId, this.props.video.TimeToSMPTE(time));
  }

  ClearHover() {
    this.props.entry.ClearHoverEntries([]);
  }

  ToolTipContent() {
    const hovering = this.props.track.trackId === this.props.entry.hoverTrack;
    if(!hovering || !this.props.entry.hoverEntries || this.props.entry.hoverEntries.length === 0) {
      return null;
    }

    const formatString = string => (string || "").toString().toLowerCase();
    const filter = formatString(this.props.entry.filter);

    const entries = this.props.entry.hoverEntries.map(entryId => {
      const entry = this.props.track.entries[entryId];

      if(filter && !formatString(entry.text).includes(filter)) {
        return null;
      }

      return (
        <div className="track-entry" key={`entry-${entry.entryId}`}>
          <div className="track-entry-timestamps">
            {`${this.props.entry.TimeToSMPTE(entry.startTime)} - ${this.props.entry.TimeToSMPTE(entry.endTime)}`}
          </div>
          <div className="track-entry-content">
            {entry.text}
          </div>
        </div>
      );
    })
      .filter(entry => entry);

    if(entries.length === 0) {
      return null;
    }

    return (
      <div className="track-entry-container">
        { entries }
      </div>
    );
  }

  Canvas() {
    return (
      <TrackCanvas
        className="track"
        onClick={this.Click}
        onMouseMove={this.Hover}
        onMouseLeave={this.ClearHover}
        HandleResize={this.OnCanvasResize}
        SetRef={context => {
          this.setState({context});

          const worker = new TrackWorker();

          worker.postMessage({
            operation: "Initialize",
            trackId: this.props.track.trackId,
            color: toJS(this.props.track.color),
            width: this.state.canvasWidth,
            height: this.state.canvasHeight,
            entries: toJS(this.props.track.entries),
            scale: {
              scale: this.props.video.scale,
              scaleMin: this.props.video.scaleMin,
              scaleMax: this.props.video.scaleMax
            },
            duration: this.props.video.duration
          });

          // Paint image from worker
          worker.onmessage = e => {
            if(e.data.trackId !== this.props.track.trackId) { return; }

            const {data, width, height} = e.data.imageData;

            this.state.context.putImageData(
              new ImageData(data, width, height),
              0, 0,
              0, 0,
              width, height
            );
          };

          this.setState({worker});
        }}
      />
    );
  }

  render() {
    return (
      <ToolTip content={this.ToolTipContent()}>
        <div
          onWheel={event => {
            event.preventDefault();
            this.props.video.ScrollScale(this.ClientXToCanvasPosition(event.clientX), event.deltaY);
          }}
          className="track-container"
        >
          { this.Canvas() }
        </div>
      </ToolTip>
    );
  }
}

Track.propTypes = {
  track: PropTypes.object.isRequired,
  entry: PropTypes.object,
  video: PropTypes.object
};

export default Track;
