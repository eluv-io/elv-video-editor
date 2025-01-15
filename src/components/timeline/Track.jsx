import TrackStyles from "@/assets/stylesheets/modules/track.module.scss";

import React, {useEffect, useState} from "react";
import TrackCanvas from "./TrackCanvas";
import {observer} from "mobx-react";
import Fraction from "fraction.js";
import {reaction, toJS} from "mobx";
import {tracksStore, videoStore, entryStore} from "@/stores/index.js";

import {CreateModuleClassMatcher} from "@/utils/Utils";
import {Tooltip} from "@mantine/core";

const S = CreateModuleClassMatcher(TrackStyles);

// X position of mouse over canvas (as percent)
const ClientXToCanvasPosition = ({canvas, clientX}) => {
  const {left, width} = canvas.getBoundingClientRect();
  return Fraction(clientX - left).div(width).valueOf();
};

const TimeAt = ({canvas, clientX}) => {
  // How much of the duration of the video is currently visible
  const duration = Fraction(videoStore.scaleMax - videoStore.scaleMin).div(100).mul(videoStore.duration);

  // Where the currently visible segment starts
  const startOffset = Fraction(videoStore.scaleMin).div(100).mul(videoStore.duration);

  // Time corresponding to mouse position
  return duration.mul(ClientXToCanvasPosition({canvas, clientX})).add(startOffset).valueOf();
};

const Search = ({trackId, time}) => {
  return tracksStore.TrackEntryIntervalTree(trackId).search(time, time);
};

const Click = ({canvas, clientX, trackId}) => {
  const time = TimeAt({canvas, clientX});
  const entries = Search({trackId, time});

  tracksStore.SetSelectedTrack(trackId);
  entryStore.SetEntries(entries, videoStore.TimeToSMPTE(time));
};

const Hover = ({canvas, clientX, trackId}) => {
  const time = TimeAt({canvas, clientX});
  const entries = Search({trackId, time});

  entryStore.SetHoverEntries(entries, trackId, videoStore.TimeToSMPTE(time));
};

const ClearHover = () => {
  entryStore.ClearHoverEntries([]);
};


const InitializeTrackReactions = ({track, worker}) => {
  // Update less often when there are many tags to improve performance
  //const delayFactor = Math.max(1, Math.log10(tracksStore.totalEntries));
  const delayFactor = 1;

  let reactionDisposals = [];

  // Update when entries change
  reactionDisposals.push(
    reaction(
      () => ({
        version: track.version
      }),
      () => {
        worker.postMessage({
          operation: "SetEntries",
          trackId: track.trackId,
          entries: toJS(tracksStore.TrackEntries(track.trackId))
        });
      },
      {delay: 25 * delayFactor}
    )
  );

  // Update on scale change
  reactionDisposals.push(
    reaction(
      () => ({
        scale: 100,
        scaleMax: videoStore.scaleMax,
        scaleMin: videoStore.scaleMin,
        duration: videoStore.duration
      }),
      () => {
        worker.postMessage({
          operation: "SetScale",
          trackId: track.trackId,
          scale: {
            scale: 100,
            scaleMin: videoStore.scaleMin,
            scaleMax: videoStore.scaleMax,
          },
          duration: videoStore.duration
        });
      },
      {delay: 50 * delayFactor}
    )
  );

  // Update on filter change
  reactionDisposals.push(
    reaction(
      () => ({
        filter: entryStore.filter
      }),
      () => {
        if(track.trackType === "clip") {
          return;
        }

        worker.postMessage({
          operation: "SetFilter",
          trackId: track.trackId,
          filter: entryStore.filter
        });
      },
      {delay: 100 * delayFactor}
    )
  );

  // Update on selected / hover change
  reactionDisposals.push(
    reaction(
      () => ({
        hoverEntries: entryStore.hoverEntries,
        selectedEntries: entryStore.entries,
        selectedEntry: entryStore.selectedEntry
      }),
      () => {
        const selectedEntryIds = toJS(entryStore.entries);
        const selectedEntryId = toJS(entryStore.selectedEntry ? entryStore.selectedEntry : undefined);
        const hoverEntryIds = toJS(entryStore.hoverEntries);

        worker.postMessage({
          operation: "SetSelected",
          trackId: track.trackId,
          selectedEntryId,
          selectedEntryIds,
          hoverEntryIds
        });
      },
      {delay: 75 * delayFactor}
    )
  );

  let activeEntryIds = [];
  // Update on active entry changed
  reactionDisposals.push(
    reaction(
      () => ({
        frame: videoStore.frame
      }),
      () => {
        const currentActiveEntryIds = toJS(
          tracksStore.TrackEntryIntervalTree(track.trackId)
            .search(videoStore.currentTime, videoStore.currentTime)
        ).sort();

        if(currentActiveEntryIds.toString() === activeEntryIds.toString()) {
          return;
        }

        activeEntryIds = currentActiveEntryIds;

        worker.postMessage({
          operation: "SetActive",
          trackId: track.trackId,
          activeEntryIds: currentActiveEntryIds
        });
      },
      {delay: 50 * delayFactor}
    )
  );

  return () => reactionDisposals.forEach(dispose => dispose());
};

const TooltipOverlay = observer(({trackId, ...props}) => {
  let entries = [];
  const hovering = trackId === entryStore.hoverTrack;

  if(hovering && entryStore.hoverEntries?.length > 0) {
    const formatString = string => (string || "").toString().toLowerCase();
    const filter = formatString(entryStore.filter);

    entries = entryStore.hoverEntries.map(entryId => {
      const entry = tracksStore.TrackEntries(trackId)[entryId];

      if(!entry) {
        return null;
      }

      if(filter && !formatString(entry.textList.join(" ")).includes(filter)) {
        return null;
      }

      return (
        <div className={S("tooltip__item")} key={`entry-${entry.entryId}`}>
          <div className={S("tooltip__timestamps")}>
            {`${entryStore.TimeToSMPTE(entry.startTime)} - ${entryStore.TimeToSMPTE(entry.endTime)}`}
          </div>
          <div className={S("tooltip__content")}>
            {entry.content ? <pre>{JSON.stringify(entry.content, null, 2)}</pre> : <p>{entry.textList.join(", ")}</p>}
          </div>
        </div>
      );
    })
      .filter(entry => entry);
  }

  return (
    <Tooltip.Floating
      key={`${entries}`}
      disabled={entries.length === 0}
      position="top"
      offset={20}
      label={
        <div className={S("tooltip")}>
          { entries }
        </div>
      }
    >
      <div
        {...props}
        className={S("tooltip-overlay")}
      />
    </Tooltip.Floating>
  );
});

const Track = observer(({track, noActive}) => {
  const [canvasDimensions, setCanvasDimensions] = useState({width: 0, height: 0});
  const [canvas, setCanvas] = useState(undefined);
  const [worker, setWorker] = useState(undefined);

  useEffect(() => {
    if(!canvas || !worker) { return; }

    // Handle resize
    worker.postMessage({
      operation: "Resize",
      trackId: track.trackId,
      width: canvasDimensions.width,
      height: canvasDimensions.height
    });

    canvas.height = canvasDimensions.height;
    canvas.width = canvasDimensions.width;
  }, [canvasDimensions, canvas, worker]);

  useEffect(() => {
    if(!track || !worker) { return; }

    const Dispose = InitializeTrackReactions({track, worker});

    return () => Dispose();
  }, [worker]);

  return (
    <div className={S("track-container")}>
      <TooltipOverlay
        trackId={track.trackId}
        onClick={({clientX}) => canvas && Click({canvas, clientX, trackId: track.trackId})}
        onMouseMove={({clientX}) => canvas && Hover({canvas, clientX, trackId: track.trackId})}
        onMouseLeave={ClearHover}
      />
      <TrackCanvas
        containerClassName={S("track")}
        className={S("track__canvas")}
        onResize={setCanvasDimensions}
        setCanvas={canvas => {
          setCanvas(canvas);
          const trackWorker = new Worker(
            new URL("../../workers/TrackWorker.js",  import.meta.url),
            { type: "module" }
          );

          trackWorker.postMessage({
            operation: "Initialize",
            trackId: track.trackId,
            trackLabel: track.label,
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

            const context = canvas.getContext("2d");
            context.putImageData(
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
