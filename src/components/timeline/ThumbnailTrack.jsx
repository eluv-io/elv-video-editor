import TrackStyles from "@/assets/stylesheets/modules/track.module.scss";

import React, {useEffect, useRef, useState} from "react";
import {observer} from "mobx-react";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {videoStore, trackStore} from "@/stores/index.js";
import {Button, Tooltip, Text, Progress} from "@mantine/core";
import {modals} from "@mantine/modals";
import {AsyncButton} from "@/components/common/Common.jsx";

const S = CreateModuleClassMatcher(TrackStyles);

const ThumbnailCreationTrack = observer(() => {
  let content;
  switch(trackStore.thumbnailStatus?.status?.state) {
    case "started":
    case "running":
      content = (
        <div className={S("thumbnail-creation-track__status")}>
          <div>Generating Thumbnails...</div>
          <Progress w={200} value={trackStore.thumbnailStatus?.status?.progress || 0} max={100}/>
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
                  labels: { confirm: "Generate Thumbnails", cancel: "Cancel" },
                  onConfirm: () => resolve(true),
                  onCancel: () => resolve(false)
                })
              )) { return; }

              await trackStore.ThumbnailGenerationStatus({finalize: true});
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
              onConfirm: () => trackStore.GenerateVideoThumbnails()
            })
          }
        >
          Generate Thumbnails
        </Button>
      );
  }

  useEffect(() => {
    if(!["running", "started"].includes(trackStore.thumbnailStatus?.status?.state)) {
      return;
    }

    const statusInterval = setInterval(() => {
      trackStore.ThumbnailGenerationStatus();
    }, 3000);

    return () => clearInterval(statusInterval);
  }, [trackStore.thumbnailStatus?.status?.state]);

  return (
    <div className={S("track-container", "thumbnail-creation-track")}>
      { content }
    </div>
  );
});

const ThumbnailTrack = observer(() => {
  const ref = useRef(null);
  const [trackDimensions, setTrackDimensions] = useState({height: 1, width: 1});
  const [hoverThumbnail, setHoverThumbnail] = useState(undefined);

  useEffect(() => {
    if(!ref?.current) {
      return;
    }

    const resizeObserver = new ResizeObserver(() =>
      setTrackDimensions(ref.current.getBoundingClientRect())
    );

    resizeObserver.observe(ref.current);

    return () => resizeObserver?.disconnect();
  }, [ref]);

  if(!trackStore.thumbnailStatus.available) {
    return <ThumbnailCreationTrack />;
  }

  const thumbnailWidth = trackDimensions.height * videoStore.aspectRatio;
  const visibleThumbnails = Math.ceil(trackDimensions.width / thumbnailWidth);
  const thumbnailScale = (thumbnailWidth / trackDimensions.width) * videoStore.scaleMagnitude / 100;

  return (
    <Tooltip.Floating
      position="top"
      offset={30}
      openDelay={250}
      disabled={!hoverThumbnail}
      keepMounted
      label={
        !hoverThumbnail ? null :
          <img src={hoverThumbnail} className={S("thumbnail-tooltip__thumbnail")}/>
      }
      classNames={{
        tooltip: S("thumbnail-tooltip")
      }}
    >
      <div
        ref={ref}
        onMouseMove={event => {
          const dimensions = event.currentTarget.getBoundingClientRect();
          const progress = videoStore.scaleMin + ((event.clientX - dimensions.left) / dimensions.width) * videoStore.scaleMagnitude;

          setHoverThumbnail(trackStore.ThumbnailImage(progress * videoStore.duration / 100));
        }}
        onMouseLeave={() => setHoverThumbnail(undefined)}
        onClick={event => {
          const dimensions = event.currentTarget.getBoundingClientRect();
          const progress = videoStore.scaleMin + ((event.clientX - dimensions.left) / dimensions.width) * videoStore.scaleMagnitude;

            videoStore.SeekPercentage(progress / 100);
          }}
          className={S("track-container", "thumbnail-track")}
        >
          <div className={S("thumbnail-track__cover")} />
          {
            [...new Array(visibleThumbnails)].map((_, index) => {
              const startProgress = videoStore.scaleMin + (thumbnailScale * index + thumbnailScale * 0.5) * 100;
              let startTime = videoStore.duration * startProgress / 100;

              if(startTime >= videoStore.duration) {
                startTime = startTime - thumbnailScale * videoStore.duration / 2;
              }

              return (
                <img
                  src={trackStore.ThumbnailImage(startTime)}
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
     </Tooltip.Floating>
  );
});

export default ThumbnailTrack;
