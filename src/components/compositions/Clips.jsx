import CompositionStyles from "@/assets/stylesheets/modules/compositions.module.scss";

import React from "react";
import {observer} from "mobx-react-lite";
import {compositionStore} from "@/stores/index.js";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import ThumbnailTrack from "@/components/timeline/ThumbnailTrack.jsx";

const S = CreateModuleClassMatcher(CompositionStyles);

const CalculateClipPosition = ({clip, containerDimensions}) => {
  const totalFrames = compositionStore.compositionDurationFrames;
  const visibleStartFrame = (compositionStore.videoStore.scaleMin / 100) * totalFrames;
  const visibleFrames = (compositionStore.videoStore.scaleMagnitude / 100) * totalFrames;

  const clipWidth = containerDimensions.width * (clip.clipOutFrame - clip.clipInFrame) / visibleFrames;
  const clipLeft = ((clip.startFrame - visibleStartFrame) / visibleFrames) * containerDimensions.width;

  return { clipWidth, clipLeft };
};

export const DropIndicator = observer(({containerDimensions}) => {
  if(typeof compositionStore.dropIndicatorIndex === "undefined") {
    return null;
  }

  let left = 0;
  if(compositionStore.dropIndicatorIndex > 0) {
    const previousClip = compositionStore.clipList[compositionStore.dropIndicatorIndex - 1];
    const { clipLeft, clipWidth } = CalculateClipPosition({clip: previousClip, containerDimensions});
    left = clipLeft + clipWidth - 1;
  }

  return (
    <div
      draggable={false}
      style={{left}}
      key={`indicator-${compositionStore.dropIndicatorIndex}`}
      className={S("composition-track__drop-indicator")}
    />
  );
});

export const DraggedClip = observer(() => {
  if(
    !compositionStore.showDragShadow ||
    !compositionStore.draggingClip ||
    compositionStore.mousePositionX === 0
  ) {
    return null;
  }

  const clip = compositionStore.draggingClip;

  const {clipWidth} = CalculateClipPosition({
    clip,
    containerDimensions: {width: window.innerWidth}
  });

  return (
    <div
      style={{
        width: Math.min(clipWidth, window.innerWidth / 2),
        left: compositionStore.mousePositionX,
        top: compositionStore.mousePositionY
      }}
      className={S("dragged-clip")}
    >
      <div className={S("dragged-clip__thumbnail-container")}>
        <ThumbnailTrack
          noHover
          store={compositionStore.ClipStore(clip)}
          startFrame={clip.clipInFrame}
          endFrame={clip.clipOutFrame}
          className={S("dragged-clip__thumbnails")}
        />
      </div>
    </div>
  );
});

export const Clip = observer(({clip, containerDimensions}) => {
  const {clipLeft, clipWidth} = CalculateClipPosition({clip, containerDimensions});

  return (
    <div
      draggable
      onDragStart={() => compositionStore.SetDragging({clip})}
      onDragEnd={() => compositionStore.EndDrag()}
      onClick={() => compositionStore.SetSelectedClip(clip.clipId)}
      style={{
        left: clipLeft,
        width: clipWidth,
      }}
      className={S("clip", compositionStore.selectedClip?.clipId === clip.clipId ? "clip--selected" : "")}
    >
      <div className={S("clip__thumbnail-container")}>
        <ThumbnailTrack
          store={compositionStore.ClipStore({...clip})}
          startFrame={clip.clipInFrame}
          endFrame={clip.clipOutFrame}
          hoverOffset={50}
          RenderTooltip={thumbnailUrl =>
            <div className={S("thumbnail-hover")}>
              <img
                src={thumbnailUrl}
                style={{aspectRatio: compositionStore.ClipStore({...clip}).aspectRatio}}
                className={S("thumbnail-hover__image")}
              />
              <div className={S("thumbnail-hover__text")}>{clip.name}</div>
            </div>
          }
          className={S("clip__thumbnails")}
        />
      </div>
    </div>
  );
});
