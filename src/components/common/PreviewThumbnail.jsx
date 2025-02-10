import CommonStyles from "@/assets/stylesheets/modules/common.module.scss";

import {observer} from "mobx-react";
import React, {useEffect, useState} from "react";
import {trackStore, videoStore} from "@/stores/index.js";
import {CreateModuleClassMatcher, JoinClassNames} from "@/utils/Utils.js";

const S = CreateModuleClassMatcher(CommonStyles);

const PreviewThumbnail = observer(({startFrame, endFrame, ...props}) => {
  const [thumbnails, setThumbnails] = useState(null);
  const [thumbnailIndex, setThumbnailIndex] = useState(0);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    let startTime = videoStore.FrameToTime(startFrame);
    const endTime = videoStore.FrameToTime(endFrame);

    let thumbnailMap = {};
    let thumbnailList = [];
    while(startTime < endTime) {
      const thumbnailUrl = trackStore.ThumbnailImage(startTime);

      if(!thumbnailMap[thumbnailUrl]) {
        thumbnailList.push(thumbnailUrl);
        thumbnailMap[thumbnailUrl] = true;
      }

      startTime += 1;
    }

    setThumbnails(thumbnailList);
  }, [trackStore.thumbnailStatus.available]);

  useEffect(() => {
    if(!hover || !thumbnails) {
      setThumbnailIndex(0);
      return;
    }

    let index = thumbnailIndex;
    const interval = setInterval(() => {
      index = (index + 1) % thumbnails.length;
      setThumbnailIndex(index);
    }, 1000);

    return () => clearInterval(interval);
  }, [hover, thumbnails]);

  if(!trackStore.thumbnailStatus.available || !thumbnails) {
    return null;
  }

  const previousIndex = thumbnailIndex === 0 && hover ? thumbnails.length - 1 : thumbnailIndex - 1;
  return (
    <div
      {...props}
      style={{aspectRatio: videoStore.aspectRatio}}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={JoinClassNames(S("preview-thumbnail", hover ? "preview-thumbnail--hover" : ""), props.className)}
    >
      {
        previousIndex < 0 ? null :
          <img
            style={{aspectRatio: videoStore.aspectRatio}}
            key={`thumbnail-${previousIndex}`}
            src={thumbnails[previousIndex]}
            className={S("preview-thumbnail__previous")}
          />
      }
      <img
        style={{aspectRatio: videoStore.aspectRatio}}
        key={`thumbnail-${thumbnailIndex}`}
        src={thumbnails[thumbnailIndex]}
        className={S("preview-thumbnail__current")}
      />
    </div>
  );
});

export default PreviewThumbnail;
