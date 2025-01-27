import TrackStyles from "@/assets/stylesheets/modules/track.module.scss";

import React, {useEffect, useRef, useState} from "react";
import {observer} from "mobx-react";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {videoStore, tracksStore} from "@/stores/index.js";
import {Tooltip} from "@mantine/core";

const S = CreateModuleClassMatcher(TrackStyles);

const ThumbnailTrack = observer(() => {
  const ref = useRef(null);
  const [trackDimensions, setTrackDimensions] = useState({height: 1, width: 1});
  const [hoverThumbnail, setHoverThumbnail] = useState(undefined);

  useEffect(() => {
    if(!ref?.current) { return; }

    const resizeObserver = new ResizeObserver(() =>
      setTrackDimensions(ref.current.getBoundingClientRect())
    );

    resizeObserver.observe(ref.current);

    return () => resizeObserver?.disconnect();
  }, [ref]);

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
           <img src={hoverThumbnail} className={S("thumbnail-tooltip__thumbnail")} />
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

            setHoverThumbnail(tracksStore.ThumbnailImage(progress * videoStore.duration / 100));
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
                  src={tracksStore.ThumbnailImage(startTime)}
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
