import CommonStyles from "@/assets/stylesheets/modules/common.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {CreateModuleClassMatcher, JoinClassNames} from "@/utils/Utils.js";
import {LoaderImage} from "@/components/common/Common.jsx";

const S = CreateModuleClassMatcher(CommonStyles);

const PreviewThumbnail = observer(({
  store,
  startFrame,
  endFrame,
  defaultFrame,
  useLoaderImage,
  baseImageUrl,
  showDuration=true,
  score,
  maxThumbnails=20,
  loadingClassName,
  ...props
}) => {
  const [ref, setRef] = useState(null);
  const [thumbnails, setThumbnails] = useState(null);
  const [defaultThumbnail, setDefaultThumbnail] = useState(null);
  const [fallbackThumbnail, setFallbackThumnail] = useState(null);
  const [brokenImages, setBrokenImages] = useState({});

  const [clientX, setClientX] = useState(-1);
  const [hoverInfo, setHoverInfo] = useState({
    hovering: false,
    thumbnailIndex: 0,
    previousThumbnailIndex: 0,
    progress: 0
  });

  startFrame = startFrame || 0;
  endFrame = endFrame || store.totalFrames - 1;

  useEffect(() => {
    const totalFrames = endFrame - startFrame;

    const fallbackThumbnail = store.FrameImageUrl({
      frame: defaultFrame ? defaultFrame : startFrame + totalFrames / 2
    });

    setFallbackThumnail(fallbackThumbnail);

    if(!store || !store?.thumbnailStore.thumbnailStatus.available) {
      setDefaultThumbnail(defaultThumbnail);
      setThumbnails([]);

      return;
    }

    const thumbnails = store.thumbnailStore.ThumbnailImages(
      store.FrameToTime(startFrame),
      store.FrameToTime(endFrame),
      maxThumbnails
    );

    setThumbnails(thumbnails);

    if(defaultFrame) {
      setDefaultThumbnail(
        store.thumbnailStore.ThumbnailImages(
          store.FrameToTime(defaultFrame - totalFrames * 0.1),
          store.FrameToTime(defaultFrame + totalFrames * 0.1),
          1
        )[0]
      );
    } else {
      setDefaultThumbnail(
        (thumbnails && thumbnails[Math.max(0, Math.floor(thumbnails.length / 2) - 1)]) ||
        store.FrameImageUrl({
          frame: startFrame + totalFrames / 2
        })
      );
    }
  }, [store?.thumbnailStore.thumbnailStatus.available]);

  useEffect(() => {
    if(!ref || (thumbnails || []).length < 2) { return; }

    if(clientX < 0) {
      setHoverInfo({
        hovering: false,
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
      hovering: true,
      thumbnailIndex,
      previousThumbnailIndex: hoverInfo.thumbnailIndex,
      progress
    });
  }, [ref, clientX]);

  if(!store?.thumbnailStore.thumbnailStatus.available || !thumbnails) {
    if(baseImageUrl) {
      return (
        <LoaderImage
          {...props}
          src={baseImageUrl}
          className={JoinClassNames(S("preview-thumbnail"), props.className)}
        />
      );
    }

    return !useLoaderImage ? null :
      <LoaderImage
        {...props}
        showWithoutSource
        className={JoinClassNames(S("preview-thumbnail"), props.className, loadingClassName)}
      />;
  }

  const imageUrl = hoverInfo.hovering && thumbnails[hoverInfo.thumbnailIndex] ?
    thumbnails[hoverInfo.thumbnailIndex] :
    defaultThumbnail || fallbackThumbnail;

  const isFrameUrl = !thumbnails[hoverInfo.thumbnailIndex];

  return (
    <div
      {...props}
      ref={setRef}
      style={{aspectRatio: store.aspectRatio, ...(props.style || {})}}
      onMouseMove={event => setClientX(event.clientX)}
      onMouseLeave={() => setClientX(-1)}
      className={JoinClassNames(S("preview-thumbnail"), props.className)}
    >
      {
        !imageUrl || brokenImages[imageUrl] ?
          <div
            className={
              S(
                "preview-thumbnail__image",
                "preview-thumbnail__image--current",
                "preview-thumbnail__image--broken"
              )
            }
          /> :
          isFrameUrl ?
            <LoaderImage
              alt="Thumbnail"
              style={{aspectRatio: store.aspectRatio}}
              loaderAspectRatio={store.aspectRatio}
              key={`thumbnail-${hoverInfo.thumbnailIndex}`}
              src={imageUrl}
              loading="lazy"
              onError={() => setBrokenImages({...brokenImages, [imageUrl]: true})}
              className={S("preview-thumbnail__image", "preview-thumbnail__image--current")}
            /> :
            <img
              alt="Thumbnail"
              style={{aspectRatio: store.aspectRatio}}
              key={`thumbnail-${hoverInfo.thumbnailIndex}`}
              src={imageUrl}
              loading="lazy"
              onError={() => setBrokenImages({...brokenImages, [imageUrl]: true})}
              className={S("preview-thumbnail__image", "preview-thumbnail__image--current")}
            />
      }
      {
        hoverInfo <= 0 ? null :
          <div
            style={{width: `${hoverInfo.progress * 100}%`}}
            className={S("preview-thumbnail__progress")}
          />
      }
      {
        !score ? null :
          <div className={S("preview-thumbnail__score")}>
            {score}
          </div>
      }
      {
        !showDuration ? null :
          <div className={S("preview-thumbnail__duration")}>
            {store.FrameToString({frame: endFrame - startFrame})}
          </div>
      }
    </div>
  );
});

export default PreviewThumbnail;
