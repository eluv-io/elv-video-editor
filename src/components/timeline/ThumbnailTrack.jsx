import TrackStyles from "@/assets/stylesheets/modules/track.module.scss";

import React, {useEffect, useState} from "react";
import {observer} from "mobx-react-lite";
import {CreateModuleClassMatcher, JoinClassNames} from "@/utils/Utils.js";
import {Button, Tooltip, Progress} from "@mantine/core";
import {AsyncButton, Confirm, LoaderImage} from "@/components/common/Common.jsx";

const S = CreateModuleClassMatcher(TrackStyles);

const ThumbnailCreationTrack = observer(({store}) => {
  const [finalizing, setFinalizing] = useState(false);

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
          {
            finalizing ? null :
              <div>Thumbnail Generation Complete</div>
          }
          <AsyncButton
            size="xs"
            color="gray.9"
            h={25}
            onClick={async () => await Confirm({
              title: "Finalize Thumbnails",
              text: "Warning: Finalizing the thumbnails for this content will cause the page to reload. If you have any changes, they will be lost.",
              onConfirm: async () => {
                setFinalizing(true);
                await store.thumbnailStore.ThumbnailGenerationStatus({finalize: true});
                localStorage.removeItem(`regenerate-thumbnails-${store.videoObject.objectId}`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                window.location.reload();
                await new Promise(resolve => setTimeout(resolve, 20000));
              }
            })}
          >
            Finalize
          </AsyncButton>
        </div>
      );
      break;

    default:
      if(store.thumbnailStore.thumbnailStatus.loaded) {
        content = (
          <Button
            size="xs"
            color="gray.9"
            onClick={async () => await Confirm({
              title: "Generate Thumbnails",
              text: "Are you sure you want to generate thumbnails for this content?",
              onConfirm: () => store.thumbnailStore.GenerateVideoThumbnails()
            })}
          >
            Generate Thumbnails
          </Button>
        );
      }
  }

  useEffect(() => {
    if(
      !store.thumbnailStore.thumbnailStatus?.status?.state ||
      !["running", "started"].includes(store.thumbnailStore.thumbnailStatus?.status?.state)
    ) {
      return;
    }

    store.thumbnailStore.ThumbnailGenerationStatus();

    const statusInterval = setInterval(() => {
      store.thumbnailStore.ThumbnailGenerationStatus();
    }, 10000);

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
  thumbnailFrom="middle",
  className=""
}) => {
  const [ref, setRef] = useState(null);
  const [trackDimensions, setTrackDimensions] = useState({height: 1, width: 1});
  const [hoverThumbnail, setHoverThumbnail] = useState(undefined);
  const [hovering, setHovering] = useState(false);

  const thumbnailRatio = thumbnailFrom === "middle" ? 0.5 : 0;

  startFrame = typeof startFrame === "undefined" ? store.scaleMinFrame : startFrame;
  endFrame = typeof endFrame === "undefined" ? store.scaleMaxFrame : endFrame;

  useEffect(() => {
    if(!ref) {
      return;
    }

    const resizeObserver = new ResizeObserver(() =>
      setTrackDimensions(ref.getBoundingClientRect())
    );

    resizeObserver.observe(ref);

    return () => resizeObserver?.disconnect();
  }, [ref]);

  if(!store) {
    return null;
  }

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
      ref={setRef}
      key={`thumbnail-${store?.thumbnailStore?.thumbnailStatus?.available}`}
      onMouseMove={event => {
        setHoverThumbnail(
          store.thumbnailStore.ThumbnailImages(CalculateProgress(event) * store.duration)[0]
        );
        setHovering(true);
      }}
      onMouseLeave={() => {
        setHoverThumbnail(undefined);
        setHovering(false);
      }}
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

          const progress = startProgress + (thumbnailScale * index  + thumbnailScale * thumbnailRatio * visibleFraction);
          let startTime = store.duration * progress;

          return (
            <LoaderImage
              showWithoutSource
              noAnimation
              src={store.thumbnailStore.ThumbnailImages(startTime)[0]}
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
      disabled={!hovering}
      label={
        RenderTooltip ?
          RenderTooltip(hoverThumbnail) :
          !hoverThumbnail ? null :
            <LoaderImage
              src={hoverThumbnail}
              noAnimation
              className={S("thumbnail-tooltip__thumbnail")}
            />
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
