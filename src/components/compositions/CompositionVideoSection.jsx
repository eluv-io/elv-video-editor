import VideoStyles from "@/assets/stylesheets/modules/video.module.scss";

import React, {useEffect, useRef} from "react";
import {observer} from "mobx-react-lite";
import {compositionStore, keyboardControlsStore} from "@/stores";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {
  AudioControls,
  OfferingControls,
  PlaybackRateControl,
  PlayCurrentClipButton,
  SubtitleControls,
} from "@/components/video/VideoControls";
import Video from "@/components/video/Video";
import MarkedSlider from "@/components/common/MarkedSlider.jsx";
import {IconButton} from "@/components/common/Common.jsx";

import ZoomInIcon from "@/assets/icons/v2/zoom-in.svg";
import ZoomOutIcon from "@/assets/icons/v2/zoom-out.svg";
import ClipIcon from "@/assets/icons/v2/clip-return.svg";
import ClipInIcon from "@/assets/icons/v2/clip-start.svg";
import ClipOutIcon from "@/assets/icons/v2/clip-end.svg";

const S = CreateModuleClassMatcher(VideoStyles);

const ClipControls = observer(() => {
  const store = compositionStore.selectedClipStore;

  if(!store.initialized) {
    return null;
  }

  return (
    <div className={S("toolbar", "clip-toolbar")}>
      <div className={S("toolbar__controls-group")}>
        <IconButton
          label="Zoom Out"
          icon={ZoomOutIcon}
          disabled={store.scaleMin === 0 && store.scaleMax === 100}
          onClick={() => store.SetScale(store.scaleMin - 0.5, store.scaleMax + 0.5)}
        />
        <IconButton
          label="Reset View to Selected Clip"
          icon={ClipIcon}
          onClick={() => {
            let clipInProgress = 100 * (store.clipInFrame || 0) / store.totalFrames;
            let clipOutProgress = 100 * (store.clipOutFrame || (store.totalFrames - 1)) / store.totalFrames;

            store.SetSegment(store.clipInFrame, store.clipOutFrame);
            store.SetScale(
              Math.max(0, clipInProgress - 0.5),
              Math.min(100, clipOutProgress + 0.5),
            );
          }}
        />
        <IconButton
          label="Zoom In"
          icon={ZoomInIcon}
          disabled={store.scaleMagnitude < 0.5}
          onClick={() => store.SetScale(store.scaleMin + 0.5, store.scaleMax - 0.5)}
        />
      </div>
      <div className={S("toolbar__separator")}/>
      <div className={S("toolbar__controls-group")}>
        <IconButton
          label="Set Clip In to Current Frame"
          highlight
          icon={ClipInIcon}
          onClick={() => store.SetClipMark({inFrame: store.frame})}
        />
        <IconButton
          label="Set Clip Out to Current Frame"
          highlight
          icon={ClipOutIcon}
          onClick={() => store.SetClipMark({outFrame: store.frame})}
        />
      </div>
      <div className={S("toolbar__separator")}/>
      <div className={S("toolbar__controls-group")}>
        <PlayCurrentClipButton store={store}/>
      </div>
    </div>
  );
});

const ClipSeekBar = observer(() => {
  const store = compositionStore.selectedClipStore;

  if(!store.initialized) {
    return null;
  }

  let indicators = [];
  if(store.clipInFrame) {
    indicators.push({
      position: 100 * store.clipInFrame / (store.totalFrames || 1),
      style: "start",
      connectStart: true
    });
  }

  if(store.clipOutFrame < store.totalFrames - 1) {
    indicators.push({
      position: 100 * store.clipOutFrame / (store.totalFrames || 1),
      style: "end",
      connectEnd: true
    });
  }

  return (
    <MarkedSlider
      min={store.scaleMin}
      max={store.scaleMax}
      handles={[{ position: store.seek }]}
      indicators={indicators}
      showMarks
      topMarks
      nMarks={store.sliderMarks}
      majorMarksEvery={store.majorMarksEvery}
      RenderText={progress => store.ProgressToSMPTE(progress)}
      RenderHover={
        !store.thumbnailStore.thumbnailStatus.available ? undefined :
          progress => (
            <div className={S("thumbnail-hover")}>
              <img
                src={store.thumbnailStore.ThumbnailImage(store.ProgressToTime(progress))}
                style={{aspectRatio: store.aspectRatio}}
                className={S("thumbnail-hover__image")}
              />
              <div className={S("thumbnail-hover__text")}>{store.ProgressToSMPTE(progress)}</div>
            </div>
          )
      }
      onChange={progress => store.Seek(store.ProgressToFrame(progress), false)}
      className={S("seek-bar")}
    />
  );
});


const CompositionVideoSection = observer(({store, clip=false}) => {
  const sectionRef = useRef(null);

  useEffect(() => {
    keyboardControlsStore.ToggleKeyboardControls(true);

    return () => keyboardControlsStore.ToggleKeyboardControls(false);
  }, []);

  useEffect(() => {
    if(!clip || !store.initialized || !store.videoHandler) { return; }

    // Set initial scale for clip

    let clipInProgress = 100 * (store.clipInFrame || 0) / store.totalFrames;
    let clipOutProgress = 100 * (store.clipOutFrame || (store.totalFrames - 1)) / store.totalFrames;

    store.SetSegment(store.clipInFrame, store.clipOutFrame);
    store.SetScale(
      Math.max(0, clipInProgress - 0.5),
      Math.min(100, clipOutProgress + 0.5),
    );
  }, [store.initialized, !!store.videoHandler]);

  return (
    <div
      ref={sectionRef}
      onScroll={event => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onWheel={event => {
        // Scroll wheel zoom in/out
        if(!event.ctrlKey && !event.shiftKey) { return; }

        event.preventDefault();

        // On shift+scroll, move current scale window along timeline. Movement based on current scale magnitude
        if(event.shiftKey) {
          const movement = Math.min(0.5, store.scaleMagnitude * 0.1) * (event.deltaX < 0 ? -1 : 1);
          store.SetScale(store.scaleMin + movement, store.scaleMax + movement, true);
          return;
        }

        store.ScrollScale(0.5, event.deltaY);
      }}
      className={S("content-block", "video-section")}
    >
      <h1 className={S("video-section__title")}>
        <div className={S("ellipsis")}>
          {store.name}
        </div>
      </h1>
      {
        !sectionRef?.current ? null :
          <Video store={store} fullscreenContainer={sectionRef.current} />
      }
      {
        !clip ? null :
          <>
            <ClipSeekBar />
            <ClipControls />
          </>
      }
      <div className={S("toolbar")}>
        <div className={S("toolbar__spacer")}/>
        <div className={S("toolbar__controls-group")}>
          <PlaybackRateControl store={store}/>
          {
            !clip ? null :
              <>
                <OfferingControls store={store}/>
                <SubtitleControls store={store}/>
                <AudioControls store={store}/>
              </>
          }
        </div>
      </div>
    </div>
  );
});

export default CompositionVideoSection;
