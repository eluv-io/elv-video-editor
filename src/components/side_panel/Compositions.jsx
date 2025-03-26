import SidePanelStyles from "@/assets/stylesheets/modules/side-panel.module.scss";

import {observer} from "mobx-react-lite";
import React from "react";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {compositionStore} from "@/stores/index.js";
import {Icon, LoaderImage} from "@/components/common/Common.jsx";

import AISparkleIcon from "@/assets/icons/v2/ai-sparkle1.svg";
import {Tooltip} from "@mantine/core";

const S = CreateModuleClassMatcher(SidePanelStyles);

const Clip = observer(({clip}) => {
  return (
    <button
      draggable
      onDragStart={event => {
        const dragElement = document.querySelector("#drag-dummy") || document.createElement("div");
        document.body.appendChild(dragElement);
        dragElement.style.display = "none";
        dragElement.id = "drag-dummy";
        event.dataTransfer.setDragImage(dragElement, -10000, -10000);
        compositionStore.SetDragging({
          clip,
          showDragShadow: true,
          createNewClip: true
        });
      }}
      onDragEnd={() => compositionStore.EndDrag()}
      onClick={() => compositionStore.SetSelectedClip(clip.clipId)}
      className={S("clip", compositionStore.selectedClipId === clip.clipId ? "clip--active" : "")}
    >
      <LoaderImage
        lazy={false}
        showWithoutSource
        draggable={false}
        key={`image-${compositionStore.sourceVideoStore.thumbnailStore.thumbnailStatus.available}`}
        src={compositionStore.sourceVideoStore.thumbnailStore.ThumbnailImage(
          compositionStore.sourceVideoStore.FrameToTime(Math.floor(clip.clipInFrame + (clip.clipOutFrame - clip.clipInFrame) / 2))
        )}
        loaderAspectRatio={compositionStore.sourceVideoStore.aspectRatio}
        className={S("clip__image")}
      />
      <Tooltip label={clip.name} multiline maw={300}>
        <div className={S("clip__name", "ellipsis")}>
          { clip.name }
        </div>
      </Tooltip>
    </button>
  );
});

export const CompositionClips = observer(() => {
  if(!compositionStore.compositionObject) { return null; }

  return (
    <div className={S("composition-clips")}>
      <div className={S("composition-clips__title")}>
        My Clips
      </div>
      <div className={S("composition-clips__list")}>
        <Clip clip={compositionStore.sourceClip}/>
      </div>
      {
        compositionStore.aiClips.length === 0 ? null :
          <>
            <div className={S("composition-clips__title")}>
              <Icon icon={AISparkleIcon}/>
              Results
            </div>
            <div className={S("composition-clips__list")}>
              {
                compositionStore.aiClips.map(clip =>
                  <Clip clip={clip} key={`clip-${clip.clipId}`} />
                )
              }
            </div>
          </>
      }
    </div>
  );
});
