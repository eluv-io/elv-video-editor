import TrackStyles from "@/assets/stylesheets/modules/track.module.scss";

import React, {useState} from "react";
import TrackCanvas from "./TrackCanvas";
import {inject, observer} from "mobx-react";
import Fraction from "fraction.js";
import {reaction, toJS} from "mobx";
import {tracksStore, videoStore, entryStore} from "@/stores/index.js";

import {CreateModuleClassMatcher, StopScroll} from "@/utils/Utils";

const S = CreateModuleClassMatcher(TrackStyles);

class Track2 extends React.Component {
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
    // Update less often when there are many tags to improve performance
    const delayFactor = Math.max(1, Math.log10(this.props.tracksStore.totalEntries));

    // Initialize reactionary re-draw handlers
    this.setState({
      reactions: [
        // Update on entries change
        reaction(
          () => ({
            version: this.props.track.version
          }),
          () => {
            this.state.worker.postMessage({
              operation: "SetEntries",
              trackId: this.props.track.trackId,
              entries: this.props.tracksStore.TrackEntries(this.props.track.trackId)
            });
          },
          {delay: 25 * delayFactor}
        ),
        // Update on scale change
        reaction(
          () => ({
            scale: 100,
            scaleMax: this.props.videoStore.scaleMax,
            scaleMin: this.props.videoStore.scaleMin,
            duration: this.props.videoStore.duration
          }),
          () => {
            this.state.worker.postMessage({
              operation: "SetScale",
              trackId: this.props.track.trackId,
              scale: {
                scale: 100,
                scaleMin: this.props.videoStore.scaleMin,
                scaleMax: this.props.videoStore.scaleMax,
              },
              duration: this.props.videoStore.duration
            });
          },
          {delay: 50 * delayFactor}
        ),
        // Update on filter change
        reaction(
          () => ({
            filter: this.props.entryStore.filter
          }),
          () => {
            if(this.props.track.trackType === "clip") {
              return;
            }

            this.state.worker.postMessage({
              operation: "SetFilter",
              trackId: this.props.track.trackId,
              filter: this.props.entryStore.filter
            });
          },
          {delay: 100 * delayFactor}
        ),
        // Update on selected / hover change
        reaction(
          () => ({
            hoverEntries: this.props.entryStore.hoverEntries,
            selectedEntries: this.props.entryStore.entries,
            selectedEntry: this.props.entryStore.selectedEntry
          }),
          () => {
            const selectedEntryIds = toJS(this.props.entryStore.entries);
            const selectedEntryId = toJS(this.props.entryStore.selectedEntry ? this.props.entryStore.selectedEntry : undefined);
            const hoverEntryIds = toJS(this.props.entryStore.hoverEntries);

            this.state.worker.postMessage({
              operation: "SetSelected",
              trackId: this.props.track.trackId,
              selectedEntryId,
              selectedEntryIds,
              hoverEntryIds
            });
          },
          {delay: 75 * delayFactor}
        ),
        // Update on active entry changed
        reaction(
          () => ({
            frame: this.props.videoStore.frame
          }),
          () => {
            const activeEntryIds = toJS(this.Search(this.props.videoStore.currentTime)).sort();

            if(activeEntryIds.toString() === this.activeEntryIds.toString()) { return; }

            this.activeEntryIds = activeEntryIds;

            this.state.worker.postMessage({
              operation: "SetActive",
              trackId: this.props.track.trackId,
              activeEntryIds
            });
          },
          {delay: 50 * delayFactor}
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
          {delay: 100 * delayFactor}
        )
      ]
    });
  }

  componentWillUnmount() {
    (this.state.reactions || []).forEach(dispose => dispose());

    if(this.state.worker) {
      this.state.worker.postMessage({
        operation: "Destroy",
        trackId: this.props.track.trackId
      });
    }
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

  Search(time) {
    return this.props.tracksStore.TrackEntryIntervalTree(this.props.track.trackId).search(time, time);
  }

  TimeAt(clientX) {
    // How much of the duration of the video is currently visible
    const duration = Fraction(this.props.videoStore.scaleMax - this.props.videoStore.scaleMin).div(100).mul(this.props.videoStore.duration);

    // Where the currently visible segment starts
    const startOffset = Fraction(this.props.videoStore.scaleMin).div(100).mul(this.props.videoStore.duration);

    // Time corresponding to mouse position
    return duration.mul(this.ClientXToCanvasPosition(clientX)).add(startOffset).valueOf();
  }

  Click({clientX}) {
    const time = this.TimeAt(clientX);
    const entries = this.Search(time);

    this.props.tracksStore.SetSelectedTrack(this.props.track.trackId);
    this.props.entryStore.SetEntries(entries, this.props.videoStore.TimeToSMPTE(time));
  }

  Hover({clientX}) {
    const time = this.TimeAt(clientX);
    const entries = this.Search(time);

    this.props.entryStore.SetHoverEntries(entries, this.props.track.trackId, this.props.videoStore.TimeToSMPTE(time));
  }

  ClearHover() {
    this.props.entryStore.ClearHoverEntries([]);
  }

  ToolTipContent() {
    const hovering = this.props.track.trackId === this.props.entryStore.hoverTrack;
    if(!hovering || !this.props.entryStore.hoverEntries || this.props.entryStore.hoverEntries.length === 0) {
      return null;
    }

    const formatString = string => (string || "").toString().toLowerCase();
    const filter = formatString(this.props.entryStore.filter);

    const entries = this.props.entryStore.hoverEntries.map(entryId => {
      const entry = this.props.tracksStore.TrackEntries(this.props.track.trackId)[entryId];

      if(!entry) {
        return null;
      }

      if(filter && !formatString(entry.textList.join(" ")).includes(filter)) {
        return null;
      }

      return (
        <div className="track-entry" key={`entry-${entry.entryId}`}>
          <div className="track-entry-timestamps">
            {`${this.props.entryStore.TimeToSMPTE(entry.startTime)} - ${this.props.entryStore.TimeToSMPTE(entry.endTime)}`}
          </div>
          <div className="track-entry-content">
            { entry.content ? <pre>{JSON.stringify(entry.content, null, 2)}</pre> : entry.textList.join(", ") }
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
            entries: toJS(this.props.tracksStore.TrackEntries(this.props.track.trackId)),
            noActive: this.props.noActive,
            scale: {
              scale: 100,
              scaleMin: this.props.videoStore.scaleMin,
              scaleMax: this.props.videoStore.scaleMax
            },
            duration: this.props.videoStore.duration
          });

          // Paint image from worker
          worker.onmessage = e => {
            if(e.data.trackId !== this.props.track.trackId) {
              return;
            }

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
          ref={StopScroll({})}
          onWheel={({deltaY, clientX}) => this.props.videoStore.ScrollScale(this.ClientXToCanvasPosition(clientX), deltaY)}
          className="track-container"
        >
          { this.Canvas() }
        </div>
      </ToolTip>
    );
  }
}

// X position of mouse over canvas (as percent)
const ClientXToCanvasPosition = ({context, clientX}) => {
  return Fraction(clientX - context.canvas.offsetLeft).div(context.canvas.offsetWidth).valueOf();
};

const Track = observer(({track, entry, video, noActive}) => {
  const [canvasDimensions, setCanvasDimensions] = useState({width: 0, height: 0});
  const [context, setContext] = useState(undefined);
  const [worker, setWorker] = useState(undefined);

  return (
    <div
      ref={StopScroll({})}
      onWheel={({deltaY, clientX}) => videoStore.ScrollScale(ClientXToCanvasPosition({context, clientX}), deltaY)}
      className={S("track-container")}
    >
      <TrackCanvas
        className={S("track")}
        //onClick={this.Click}
        //onMouseMove={this.Hover}
        //onMouseLeave={this.ClearHover}
        HandleResize={setCanvasDimensions}
        SetRef={canvasContext => {
          setContext(canvasContext);

          const trackWorker = new Worker(new URL("@/workers/TrackWorker.js", import.meta.url));

          trackWorker.postMessage({
            operation: "Initialize",
            trackId: track.trackId,
            color: toJS(track.color),
            width: canvasDimensions.width,
            height: canvasDimensions.height,
            entries: toJS(tracksStore.TrackEntries(track.trackId)),
            noActive,
            scale: {
              scale: 100,
              scaleMin: videoStore.scaleMin,
              scaleMax: videoStore.scaleMax
            },
            duration: videoStore.duration
          });

          // Paint image from worker
          trackWorker.onmessage = e => {
            if(e.data.trackId !== track.trackId) {
              return;
            }

            const {data, width, height} = e.data.imageData;

            canvasContext.putImageData(
              new ImageData(data, width, height),
              0, 0,
              0, 0,
              width, height
            );
          };

          setWorker(trackWorker);
        }}
      />
    </div>
  );
});

export default Track;
