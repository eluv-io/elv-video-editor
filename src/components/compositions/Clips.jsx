import CompositionStyles from "@/assets/stylesheets/modules/compositions.module.scss";

import React, {useEffect} from "react";
import {observer} from "mobx-react-lite";
import {compositionStore} from "@/stores/index.js";
import {CreateModuleClassMatcher, DragHandler} from "@/utils/Utils.js";
import ThumbnailTrack from "@/components/timeline/ThumbnailTrack.jsx";

import InvertedTriangleIcon from "@/assets/icons/v2/inverted-triangle.svg";
import {Icon} from "@/components/common/Common.jsx";

const S = CreateModuleClassMatcher(CompositionStyles);

const CalculateClipPosition = ({clip, containerDimensions}) => {
  if(!clip) { return { clipWidth: 0, clipLeft: 0 }; }

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
    >
      <Icon icon={InvertedTriangleIcon} />
    </div>
  );
});

export const DraggedClip = observer(() => {
  const visible = !(
    !compositionStore.showDragShadow ||
    !compositionStore.draggingClip ||
    compositionStore.mousePositionX === 0
  );

  useEffect(() => {
    if(!visible) { return; }

    const EndDrag = () => compositionStore.EndDrag();

    document.body.addEventListener("mouseup", EndDrag);
    document.body.addEventListener("mousedown", EndDrag);

    return () => {
      document.body.removeEventListener("mouseup", EndDrag);
      document.body.removeEventListener("mousedown", EndDrag);
    };
  }, [visible]);

  if(!visible) {
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
        width: Math.max(Math.min(clipWidth, window.innerWidth / 2), 200),
        left: compositionStore.mousePositionX + 10,
        top: compositionStore.mousePositionY + 10
      }}
      className={S("dragged-clip")}
    >
      <div className={S("dragged-clip__thumbnail-container")}>
        <ThumbnailTrack
          noHover
          store={compositionStore.ClipStore({...clip})}
          startFrame={clip.clipInFrame}
          endFrame={clip.clipOutFrame}
          className={S("dragged-clip__thumbnails")}
        />
      </div>
    </div>
  );
});

export const TimelineClip = observer(({clip, containerDimensions}) => {
  const {clipLeft, clipWidth} = CalculateClipPosition({clip, containerDimensions});

  return (
    <div
      draggable
      onDragStart={DragHandler(() => compositionStore.SetDragging({
        source: "timeline",
        clip,
        showDragShadow: true,
        createNewClip: false
      }))}
      onDragEnd={() => compositionStore.EndDrag()}
      onClick={() => compositionStore.SetSelectedClip({clipId: clip.clipId, source: "timeline"})}
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
          thumbnailFrom="start"
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
