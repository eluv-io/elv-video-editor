import CommonStyles from "@/assets/stylesheets/modules/common.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {CreateModuleClassMatcher, JoinClassNames} from "@/utils/Utils.js";
import {LoaderImage} from "@/components/common/Common.jsx";

const S = CreateModuleClassMatcher(CommonStyles);

const PreviewThumbnail = observer(({store, startFrame, endFrame, useLoaderImage, ...props}) => {
  const [ref, setRef] = useState(null);
  const [thumbnails, setThumbnails] = useState(null);

  const [clientX, setClientX] = useState(-1);
  const [hoverInfo, setHoverInfo] = useState({
    thumbnailIndex: 0,
    previousThumbnailIndex: 0,
    progress: 0
  });

  useEffect(() => {
    let startTime = store.FrameToTime(startFrame);
    const endTime = store.FrameToTime(endFrame);

    // Thumbnail interval based on length of clip
    const interval = Math.min(60, Math.max(1, (endFrame - startFrame) / store.frameRate / 120));

    let thumbnailMap = {};
    let thumbnailList = [];
    while(startTime < endTime) {
      const thumbnailUrl = store.thumbnailStore.ThumbnailImage(startTime);

      if(!thumbnailMap[thumbnailUrl]) {
        thumbnailList.push(thumbnailUrl);
        thumbnailMap[thumbnailUrl] = true;
      }

      startTime += interval;
    }

    setThumbnails(thumbnailList);
  }, [store.thumbnailStore.thumbnailStatus.available]);

  useEffect(() => {
    if(!ref) { return; }

    if(clientX < 0) {
      setHoverInfo({
        thumbnailIndex: 0,
        previousThumbnailIndex: hoverInfo.previousThumbnailIndex,
        progress: 0
      });

      return;
    }

    const {left, width} = ref.getBoundingClientRect();
    const progress = (clientX - left) / width;
    const thumbnailIndex = Math.floor(thumbnails.length * progress);

    setHoverInfo({
      thumbnailIndex,
      previousThumbnailIndex: hoverInfo.thumbnailIndex,
      progress
    });
  }, [ref, clientX]);

  if(!store.thumbnailStore.thumbnailStatus.available || !thumbnails) {
    return !useLoaderImage ? null :
      <LoaderImage
        showWithoutSource
        {...props}
      />;
  }

  return (
    <div
      {...props}
      ref={setRef}
      style={{aspectRatio: store.aspectRatio, ...(props.style || {})}}
      onMouseMove={event => setClientX(event.clientX)}
      onMouseLeave={() => setClientX(-1)}
      className={JoinClassNames(S("preview-thumbnail"), props.className)}
    >
      <img
        alt="Thumbnail"
        style={{aspectRatio: store.aspectRatio}}
        key={`thumbnail-previous-${hoverInfo.previousThumbnailIndex}`}
        src={thumbnails[hoverInfo.previousThumbnailIndex]}
        className={S("preview-thumbnail__image", "preview-thumbnail__image--previous")}
      />
      <img
        alt="Thumbnail"
        style={{aspectRatio: store.aspectRatio}}
        key={`thumbnail-${hoverInfo.thumbnailIndex}`}
        src={thumbnails[hoverInfo.thumbnailIndex]}
        className={S("preview-thumbnail__image", "preview-thumbnail__image--current")}
      />
      {
        hoverInfo <= 0 ? null :
          <div
            style={{width: `${hoverInfo.progress * 100}%`}}
            className={S("preview-thumbnail__progress")}
          />
      }
    </div>
  );
});

export default PreviewThumbnail;
