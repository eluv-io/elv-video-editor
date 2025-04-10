import TrackStyles from "@/assets/stylesheets/modules/track.module.scss";

import React, {useEffect, useState} from "react";
import TrackCanvas from "./TrackCanvas";
import {observer} from "mobx-react-lite";
import Fraction from "fraction.js";
import {reaction} from "mobx";
import {trackStore, videoStore, tagStore} from "@/stores/index.js";

import {CreateModuleClassMatcher, Unproxy} from "@/utils/Utils";
import {Tooltip} from "@mantine/core";

import TrackWorker from "../../workers/TrackWorker.js?worker";
import AudioTrackWorker from "../../workers/AudioTrackWorker.js?worker";

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
  const time = TimeAt({canvas, clientX});

  let tags = [];
  // No isolated tag or within isolated tag time range
  if(!tagStore.isolatedTag || (time > tagStore.isolatedTag.startTime && time < tagStore.isolatedTag.endTime)) {
    tags = Search({trackId, time})
      .filter((v, i, s) => s.indexOf(v) === i);

    // When editing tags, remove tag being edited and check if edited tag should be displayed
    if(tagStore.editedTag && tagStore.editedTag.trackId === trackId) {
      tags = tags.filter(tagId => tagId !== tagStore.editedTag?.tagId);

      if(time >= tagStore.editedTag.startTime && time <= tagStore.editedTag.endTime) {
        tags.push("edited");
      }
    }
  }

  tagStore.SetHoverTags(tags, trackId, videoStore.TimeToSMPTE(TimeAt({canvas, clientX})));
};

const ClearHover = () => {
  tagStore.ClearHoverTags([]);
};

const InitializeTrackReactions = ({track, worker}) => {
  // React to changes in scale, playback position, filter and hover state with debounced/delayed update

  let reactionDisposals = [];

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
      {delay: 50 * trackStore.uiUpdateDelayFactor}
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
      {delay: 100 * trackStore.uiUpdateDelayFactor}
    )
  );


  // Update on isolated tag change
  reactionDisposals.push(
    reaction(
      () => ({
        worker,
        isolatedTag: tagStore.isolatedTag
      }),
      () => {
        if(track.trackType === "clip") {
          return;
        }

        worker.postMessage({
          operation: "SetIsolatedTag",
          trackId: track.trackId,
          isolatedTag: !tagStore.isolatedTag ? undefined :
            {
              startTime: tagStore.isolatedTag.startTime,
              endTime: tagStore.isolatedTag.endTime,
              tagId: tagStore.isolatedTag.tagId
            }
        });
      },
      {delay: 100 * trackStore.uiUpdateDelayFactor}
    )
  );

  // Update on edited track change
  reactionDisposals.push(
    reaction(
      () => ({
        filter: tagStore.editedTrack
      }),
      () => {
        if(tagStore.editedTrack?.trackId !== track.trackId){
          return;
        }

        worker.postMessage({
          operation: "SetColor",
          trackId: track.trackId,
          color: Unproxy(tagStore.editedTrack.color)
        });
      },
      {delay: 100 * trackStore.uiUpdateDelayFactor}
    )
  );

  // Update on edited tag change
  reactionDisposals.push(
    reaction(
      () => ({
        filter: tagStore.editedTag
      }),
      () => {
        if(tagStore.editedTag?.trackId === track.trackId) {
          worker.postMessage({
            operation: "SetEditedTag",
            trackId: track.trackId,
            editedTag: JSON.parse(JSON.stringify(tagStore.editedTag))
          });
        } else {
          worker.postMessage({
            operation: "ClearEditedTag",
            trackId: track.trackId
          });
        }
      },
      {delay: 100 * trackStore.uiUpdateDelayFactor}
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
        const selectedTagIds = Unproxy(tagStore.selectedTagIds);
        const selectedTagId = Unproxy(tagStore.selectedTagId ? tagStore.selectedTagId : undefined);
        const hoverTagIds = Unproxy(tagStore.hoverTags);

        worker.postMessage({
          operation: "SetSelected",
          trackId: track.trackId,
          selectedTagId,
          selectedTagIds,
          hoverTagIds
        });
      },
      {delay: 10 * trackStore.uiUpdateDelayFactor}
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
        const currentActiveTagIds = Unproxy(
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
      {delay: 50 * trackStore.uiUpdateDelayFactor}
    )
  );

  return () => reactionDisposals.forEach(dispose => dispose());
};

const TooltipOverlay = observer(({trackId, ...props}) => {
  const [tags, setTags] = useState([]);
  const hovering = trackId === tagStore.hoverTrack;

  useEffect(() => {
    if(!hovering || tagStore.hoverTags?.length === 0) {
      setTags([]);
      return;
    }

    const formatString = string => (string || "").toString().toLowerCase();
    const filter = formatString(tagStore.filter);

    const newHoverTags = tagStore.hoverTags.map(tagId => {
      const tag = tagId === "edited" ?
        tagStore.editedTag :
        trackStore.TrackTags(trackId)[tagId];

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

    setTags(newHoverTags);
  }, [hovering, tagStore.hoverTags]);

  return (
    <Tooltip.Floating
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
    // Update track color
    worker?.postMessage({
      operation: "SetColor",
      trackId: track.trackId,
      color: Unproxy(track.color)
    });
  }, [worker, track.color]);

  useEffect(() => {
    // Update track tags
    worker?.postMessage({
      operation: "SetTags",
      trackId: track.trackId,
      tags: Unproxy(trackStore.TrackTags(track.trackId))
    });
  }, [worker, track.version]);

  useEffect(() => {
    if(!canvas) { return; }

    let trackWorker;
    if(track.trackType === "audio") {
      trackWorker = new AudioTrackWorker();
    } else {
      trackWorker = new TrackWorker();
    }

    trackWorker.postMessage({
      operation: "Initialize",
      trackId: track.trackId,
      trackLabel: track.label,
      color: Unproxy(track.color),
      width: canvasDimensions.width,
      height: canvasDimensions.height,
      tags: {},
      noActive,
      scale: {
        scale: 100,
        scaleMin: videoStore.scaleMin,
        scaleMax: videoStore.scaleMax
      },
      duration: videoStore.duration,
      isolatedTag: !tagStore.isolatedTag ? undefined :
        {
          startTime: tagStore.isolatedTag.startTime,
          endTime: tagStore.isolatedTag.endTime,
          tagId: tagStore.isolatedTag.tagId
        }
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
