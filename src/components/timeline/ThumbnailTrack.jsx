import TrackStyles from "@/assets/stylesheets/modules/track.module.scss";

import React, {useEffect, useRef, useState} from "react";
import {observer} from "mobx-react-lite";
import {CreateModuleClassMatcher, JoinClassNames} from "@/utils/Utils.js";
import {Button, Tooltip, Text, Progress} from "@mantine/core";
import {modals} from "@mantine/modals";
import {AsyncButton} from "@/components/common/Common.jsx";

const S = CreateModuleClassMatcher(TrackStyles);

const ThumbnailCreationTrack = observer(({store}) => {
  let content;
  switch(store.thumbnailStore.thumbnailStatus?.status?.state) {
    case "started":
    case "running":
      content = (
        <div className={S("thumbnail-creation-track__status")}>
          <div>Generating Thumbnails...</div>
          <Progress w={200} value={store.thumbnailStore.thumbnailStatus?.status?.progress || 0} max={100}/>
        </div>
      );
      break;

    case "failed":
      content = <div>Thumbnail Generation Failed</div>;
      break;

    case "finished":
      content = (
        <div className={S("thumbnail-creation-track__status")}>
          <div>Thumbnail Generation Complete</div>
          <AsyncButton
            size="xs"
            color="gray.9"
            h={25}
            onClick={async () => {
              if(!await new Promise(resolve =>
                modals.openConfirmModal({
                  title: "Finalize Thumbnails",
                  centered: true,
                  children: <Text fz="sm">Warning: Finalizing the thumbnails for this content will cause the page to reload. If you have any changes, they will be lost.</Text>,
                  labels: { confirm: "Finalize Thumbnails", cancel: "Cancel" },
                  onConfirm: () => resolve(true),
                  onCancel: () => resolve(false)
                })
              )) { return; }

              await store.thumbnailStore.ThumbnailGenerationStatus({finalize: true});
              await new Promise(resolve => setTimeout(resolve, 2000));
              window.location.reload();

              await new Promise(resolve => setTimeout(resolve, 20000));
            }}
          >
            Reload
          </AsyncButton>
        </div>
      );
      break;

    default:
      content = (
        <Button
          size="xs"
          color="gray.9"
          onClick={() =>
            modals.openConfirmModal({
              title: "Generate Thumbnails",
              centered: true,
              children: <Text fz="sm">Are you sure you want to generate thumbnails for this content? It should take about 30 seconds to several minutes, depending on the content</Text>,
              labels: { confirm: "Generate Thumbnails", cancel: "Cancel" },
              onConfirm: () => store.thumbnailStore.GenerateVideoThumbnails()
            })
          }
        >
          Generate Thumbnails
        </Button>
      );
  }

  useEffect(() => {
    if(
      store.thumbnailStore.thumbnailStatus?.status &&
      !["running", "started"].includes(store.thumbnailStore.thumbnailStatus?.status?.state)
    ) {
      return;
    }

    const statusInterval = setInterval(() => {
      store.thumbnailStore.ThumbnailGenerationStatus();
    }, 3000);

    return () => clearInterval(statusInterval);
  }, [store.thumbnailStore.thumbnailStatus?.status?.state]);

  return (
    <div className={S("track-container", "thumbnail-creation-track")}>
      { content }
    </div>
  );
});

const ThumbnailTrack = observer(({
  store,
  allowCreation,
  startFrame,
  endFrame,
  onClick,
  noHover,
  hoverOffset=30,
  RenderTooltip,
  className=""
}) => {
  const ref = useRef(null);
  const [trackDimensions, setTrackDimensions] = useState({height: 1, width: 1});
  const [hoverThumbnail, setHoverThumbnail] = useState(undefined);

  startFrame = typeof startFrame === "undefined" ? store.scaleMinFrame : startFrame;
  endFrame = typeof endFrame === "undefined" ? store.scaleMaxFrame : endFrame;

  useEffect(() => {
    if(!ref?.current) {
      return;
    }

    const resizeObserver = new ResizeObserver(() =>
      setTrackDimensions(ref.current.getBoundingClientRect())
    );

    resizeObserver.observe(ref.current);

    return () => resizeObserver?.disconnect();
  }, [ref?.current]);

  const scale = (endFrame - startFrame) / store.totalFrames;
  const startProgress = startFrame / store.totalFrames;

  const thumbnailWidth = trackDimensions.height * store.aspectRatio || 1;
  const visibleThumbnails = Math.ceil(trackDimensions.width / thumbnailWidth);
  const fractionalThumbnail = (trackDimensions.width / thumbnailWidth) % 1;
  const thumbnailScale = (thumbnailWidth / trackDimensions.width) * scale;

  const CalculateProgress = event => {
    const dimensions = event.currentTarget.getBoundingClientRect();
    return startProgress + ((event.clientX - dimensions.left) / dimensions.width) * scale;
  };

  if(allowCreation && !store.thumbnailStore.thumbnailStatus.available) {
    return <ThumbnailCreationTrack store={store} />;
  }

  const content = (
    <div
      ref={ref}
      key={`thumbnail-${store?.thumbnailStore?.thumbnailStatus?.available}`}
      onMouseMove={event => setHoverThumbnail(
        store.thumbnailStore.ThumbnailImage(CalculateProgress(event) * store.duration)
      )}
      onMouseLeave={() => setHoverThumbnail(undefined)}
      onClick={
        !onClick ? undefined :
          event => onClick(CalculateProgress(event))
      }
      className={JoinClassNames(S("thumbnail-track"), className)}
    >
      <div className={S("thumbnail-track__cover")}/>
      {
        [...new Array(visibleThumbnails)].map((_, index) => {
          // Last image is probably fractional, determine halfway point based on how much of the image will be shown
          let visibleFraction =
            index === visibleThumbnails - 1 ? fractionalThumbnail : 1;

          const progress = startProgress + (thumbnailScale * index * visibleFraction + thumbnailScale * 0.5);
          let startTime = store.duration * progress;

          return (
            <img
              src={store.thumbnailStore.ThumbnailImage(startTime)}
              alt="Thumbnail"
              key={`thumbnail-${index}`}
              style={{
                width: thumbnailWidth,
                height: trackDimensions.height
              }}
              className={S("thumbnail-track__thumbnail")}
            />
          );
        })
      }
    </div>
  );

  if(noHover) {
    return content;
  }

  return (
    <Tooltip.Floating
      position="top"
      offset={hoverOffset}
      disabled={!hoverThumbnail}
      label={
        !hoverThumbnail ? null :
          RenderTooltip ?
            RenderTooltip(hoverThumbnail) :
            <img src={hoverThumbnail} className={S("thumbnail-tooltip__thumbnail")}/>
      }
      classNames={
        RenderTooltip ? null :
          {tooltip: S("thumbnail-tooltip")}
      }
    >
      { content }
    </Tooltip.Floating>
  );
});

export default ThumbnailTrack;
