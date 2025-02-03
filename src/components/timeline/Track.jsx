import TrackStyles from "@/assets/stylesheets/modules/track.module.scss";

import React, {useEffect, useState} from "react";
import TrackCanvas from "./TrackCanvas";
import {observer} from "mobx-react";
import Fraction from "fraction.js";
import {reaction, toJS} from "mobx";
import {trackStore, videoStore, tagStore} from "@/stores/index.js";

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
  return trackStore.TrackTagIntervalTree(trackId).search(time, time);
};

const Click = ({canvas, clientX, trackId}) => {
  const time = TimeAt({canvas, clientX});
  const tags = Search({trackId, time});

  tagStore.SetTags(trackId, tags, videoStore.TimeToSMPTE(time));
};

const Hover = ({canvas, clientX, trackId}) => {
  // All tags within 1 pixel of current position
  const tags = [-1, 0, 1]
    .map(offset => Search({trackId, time: TimeAt({canvas, clientX: clientX + offset})}))
    .flat()
    .filter((v, i, s) => s.indexOf(v) === i);

  tagStore.SetHoverTags(tags, trackId, videoStore.TimeToSMPTE(TimeAt({canvas, clientX})));
};

const ClearHover = () => {
  tagStore.ClearHoverTags([]);
};


const InitializeTrackReactions = ({track, worker}) => {
  // Update less often when there are many tags to improve performance
  //const delayFactor = Math.max(1, Math.log10(trackStore.totalTags));
  const delayFactor = 1;

  let reactionDisposals = [];

  // Update when tags change
  reactionDisposals.push(
    reaction(
      () => ({
        version: track.version
      }),
      () => {
        worker.postMessage({
          operation: "SetTags",
          trackId: track.trackId,
          tags: toJS(trackStore.TrackTags(track.trackId))
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
        duration: videoStore.duration,
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
        filter: tagStore.filter
      }),
      () => {
        if(track.trackType === "clip") {
          return;
        }

        worker.postMessage({
          operation: "SetFilter",
          trackId: track.trackId,
          filter: tagStore.filter
        });
      },
      {delay: 100 * delayFactor}
    )
  );

  // Update on selected / hover change
  reactionDisposals.push(
    reaction(
      () => ({
        hoverTags: tagStore.hoverTags,
        selectedTagIds: tagStore.selectedTagIds,
        selectedTag: tagStore.selectedTagId
      }),
      () => {
        const selectedTagIds = toJS(tagStore.selectedTagIds);
        const selectedTagId = toJS(tagStore.selectedTagId ? tagStore.selectedTagId : undefined);
        const hoverTagIds = toJS(tagStore.hoverTags);

        worker.postMessage({
          operation: "SetSelected",
          trackId: track.trackId,
          selectedTagId,
          selectedTagIds,
          hoverTagIds
        });
      },
      {delay: 75 * delayFactor}
    )
  );

  let activeTagIds = [];
  // Update on active tag changed
  reactionDisposals.push(
    reaction(
      () => ({
        frame: videoStore.frame
      }),
      () => {
        const currentActiveTagIds = toJS(
          trackStore.TrackTagIntervalTree(track.trackId)
            .search(videoStore.currentTime, videoStore.currentTime)
        ).sort();

        if(currentActiveTagIds.toString() === activeTagIds.toString()) {
          return;
        }

        activeTagIds = currentActiveTagIds;

        worker.postMessage({
          operation: "SetActive",
          trackId: track.trackId,
          activeTagIds: currentActiveTagIds
        });
      },
      {delay: 50 * delayFactor}
    )
  );

  return () => reactionDisposals.forEach(dispose => dispose());
};

const TooltipOverlay = observer(({trackId, ...props}) => {
  let tags = [];
  const hovering = trackId === tagStore.hoverTrack;

  if(hovering && tagStore.hoverTags?.length > 0) {
    const formatString = string => (string || "").toString().toLowerCase();
    const filter = formatString(tagStore.filter);

    tags = tagStore.hoverTags.map(tagId => {
      const tag = trackStore.TrackTags(trackId)[tagId];

      if(!tag) {
        return null;
      }

      if(filter && !formatString(tag.textList.join(" ")).includes(filter)) {
        return null;
      }

      return (
        <div className={S("tooltip__item")} key={`tag-${tag.tagId}`}>
          <div className={S("tooltip__timestamps")}>
            {`${tagStore.TimeToSMPTE(tag.startTime)} - ${tagStore.TimeToSMPTE(tag.endTime)}`}
          </div>
          <div className={S("tooltip__content")}>
            {tag.content ? <pre>{JSON.stringify(tag.content, null, 2)}</pre> : <p>{tag.textList.join(", ")}</p>}
          </div>
        </div>
      );
    })
      .filter(tag => tag);
  }

  return (
    <Tooltip.Floating
      key={`${tags}`}
      disabled={tags.length === 0}
      position="top"
      offset={20}
      label={
        <div className={S("tooltip")}>
          { tags }
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
    if(!canvas) { return; }

    const trackWorker = new Worker(
      new URL(
        track.trackType === "audio" ?
          "../../workers/AudioTrackWorker.js" :
        "../../workers/TrackWorker.js",
        import.meta.url
      ),
      { type: "module" }
    );

    trackWorker.postMessage({
      operation: "Initialize",
      trackId: track.trackId,
      trackLabel: track.label,
      color: toJS(track.color),
      width: canvasDimensions.width,
      height: canvasDimensions.height,
      tags: toJS(trackStore.TrackTags(track.trackId)),
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

    trackWorker.postMessage({
      operation: "Redraw",
      trackId: track.trackId
    });

    const Dispose = InitializeTrackReactions({track, worker: trackWorker});

    setWorker(trackWorker);

    return () => {
      Dispose();
      trackWorker.terminate();
    };
  }, [canvas]);

  return (
    <div className={S("track-container")}>
      {
        track.trackType === "audio" ? null :
          <TooltipOverlay
            trackId={track.trackId}
            onClick={({clientX}) => canvas && Click({canvas, clientX, trackId: track.trackId})}
            onMouseMove={({clientX}) => canvas && Hover({canvas, clientX, trackId: track.trackId})}
            onMouseLeave={ClearHover}
          />
      }
      <TrackCanvas
        containerClassName={S("track")}
        className={S("track__canvas")}
        onResize={setCanvasDimensions}
        setCanvas={setCanvas}
      />
    </div>
  );
});

export default Track;
