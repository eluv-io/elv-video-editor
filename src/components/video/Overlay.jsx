import OverlayStyles from "@/assets/stylesheets/modules/overlay.module.scss";

import React, {useEffect, useState} from "react";
import {observer} from "mobx-react";
import {reaction} from "mobx";
import ResizeObserver from "resize-observer-polyfill";
import {assetStore, overlayStore, trackStore, videoStore} from "@/stores/index.js";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {Tooltip} from "@mantine/core";

const frameSpread = 10;

const S = CreateModuleClassMatcher(OverlayStyles);


const AssetTags = ({asset, highlightTag}) => {
  let tags = [];
  Object.keys(asset.image_tags || {})
    .sort((a, b) => {
      if(a.toLowerCase().includes("llava")) {
        return 1;
      } else if(b.toLowerCase().includes("llava")) {
        return -1;
      }

      return a < b ? -1 : 1;
    })
    .forEach(category => {
      if(!asset.image_tags[category].tags) { return; }

      const trackInfo = assetStore.AssetTrack(category);
      tags = tags.concat(
        asset.image_tags[category].tags.map(tags =>
          ({
            ...tags,
            label: trackInfo.label,
            color: trackInfo.color
          })
        )
      );
    });

  if(highlightTag) {
    tags.push({
      ...highlightTag,
      color: { r: 255, g: 255, b: 255}
    });
  }

  return tags.filter(tag => !!tag.box);
};

const Tags = () => {
  if(videoStore.frame === 0) { return []; }

  const tags = {};

  let frame;
  for(let i = videoStore.frame; i > Math.max(0, videoStore.frame - frameSpread); i--) {
    frame = overlayStore.overlayTrack[i.toString()];

    if(frame) {
      Object.keys(frame).forEach(key => {
        if(!tags[key] && typeof frame[key] === "object" && Object.keys(frame[key]).length > 0) {
          tags[key] = frame[key];
        }
      });
    }
  }

  if(Object.keys(tags).length === 0) { return []; }

  let activeTags = [];
  trackStore.tracks
    .filter(track => track.trackType === "metadata")
    .forEach(track => {
      if(!overlayStore.visibleOverlayTracks[track.key]) { return; }

      if(!tags[track.key] || typeof tags[track.key] !== "object") { return; }

      let boxes = [];
      if(tags[track.key].activeTags) {
        boxes = tags[track.key].activeTags;
      } else {
        Object.keys(tags[track.key]).map(text => {
          if(typeof tags[track.key][text] !== "object") { return; }

          tags[track.key][text].map(tag => {
            boxes.push({
              ...tag,
              text
            });
          });
        });
      }

      activeTags = activeTags.concat(
        boxes.map(tag => ({
          ...tag,
          label: track.label,
          color: track.color
        }))
      );
    });

  return activeTags.filter(tag => !!tag.box);
};

const TagsAt = ({canvas, asset, clientX, clientY}) => {
  // Convert clientX and clientY into percentages to match box values
  const {top, left, height, width} = canvas.getBoundingClientRect();
  clientX = (clientX - left) / width;
  clientY = (clientY - top) / height;

  return (
    asset ?
      AssetTags({asset}) :
      Tags()
  )
    .filter(tag => {
      const {x1, x2, y1, y2, x3, y3, x4, y4} = tag.box;
      const minX = Math.min(x1, x2, x3 || x1, x4 || x2);
      const maxX = Math.max(x1, x2, x3 || x1, x4 || x2);
      const minY = Math.min(y1, y2, y3 || y1, y4 || y2);
      const maxY = Math.max(y1, y2, y3 || y1, y4 || y2);

      return (minX <= clientX && maxX >= clientX && minY <= clientY && maxY >= clientY);
    });
};

const Draw = ({canvas, tags, elementSize}) => {
  if(!canvas) { return; }

  canvas.width = elementSize.width;
  canvas.height = elementSize.height;

  // Draw
  const context = canvas.getContext("2d");
  const width = context.canvas.width;
  const height = context.canvas.height;

  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.globalAlpha = 0.8;
  context.lineWidth = 2;

  if(tags.length === 0) { return; }

  tags.forEach(tag => {
    if(!tag.box) { return; }

    let {x1, x2, y1, y2, x3, y3, x4, y4} = tag.box;

    let points = [];
    if(!x3) {
      points = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
    } else {
      points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
    }
    points = points.map(point => [point[0] * width, point[1] * height]);

    const toHex = n => n.toString(16).padStart(2, "0");

    context.strokeStyle = `#${toHex(tag.color.r)}${toHex(tag.color.g)}${toHex(tag.color.b)}`;

    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    context.lineTo(points[1][0], points[1][1]);
    context.lineTo(points[2][0], points[2][1]);
    context.lineTo(points[3][0], points[3][1]);
    context.lineTo(points[0][0], points[0][1]);
    context.stroke();
  });
};

const Overlay = observer(({element, asset, highlightTag}) => {
  const [canvas, setCanvas] = useState(undefined);
  const [hoverPosition, setHoverPosition] = useState({hovering: false, clientX: 0, clientY: 0});

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      let {height, width} = element.getBoundingClientRect();

      if(element.videoWidth) {
        const videoAspectRatio = element.videoWidth / element.videoHeight;
        const elementAspectRatio = width / height;

        // Since the video element is pegged to 100% height, when the AR of the
        // video element becomes taller than the video content, they no longer match.
        // Calculate the actual video height using the reported aspect ratio of the content.
        if(elementAspectRatio < videoAspectRatio) {
          height = width / videoAspectRatio;
        }
      }

      overlayStore.SetOverlayCanvasDimensions({height, width});
    });

    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [element]);

  useEffect(() => {
    if(!canvas) { return; }

    const Redraw = () =>
      Draw({
        canvas,
        tags: asset ?
          AssetTags({asset, highlightTag}) :
          Tags(),
        elementSize: overlayStore.overlayCanvasDimensions
      });

    const DisposeDrawReaction = reaction(
      () => ({
        enabled: overlayStore.overlayEnabled,
        frame: videoStore.frame,
        elementSize: overlayStore.overlayCanvasDimensions,
        enabledTracks: JSON.stringify(overlayStore.visibleOverlayTracks),
      }),
      Redraw,
      {
        delay: 25,
        equals: (from, to) => JSON.stringify(from) === JSON.stringify(to)
      }
   );

    Redraw();

    return () => DisposeDrawReaction && DisposeDrawReaction();
  }, [canvas, highlightTag]);

  if(!asset && !overlayStore.overlayEnabled) { return null; }

  const hoverTags = !hoverPosition.hovering ? [] :
    TagsAt({canvas, asset, clientX: hoverPosition.clientX, clientY: hoverPosition.clientY});

  return (
    <div className={S("overlay")} style={{width: `${overlayStore.overlayCanvasDimensions.width}px`}}>
      <Tooltip.Floating
        disabled={hoverTags.length === 0}
        position="bottom"
        offset={20}
        withinPortal={!!asset}
        label={
          <div className={S("tooltip")}>
            {hoverTags.map((tag, index) =>
              <div className={S("tooltip__item")} key={`tag-${index}`}>
                <div className={S("tooltip__label")}>
                  { tag.label }
                </div>
                <div className={S("tooltip__content")}>
                  {
                    (Array.isArray(tag.text) ? tag.text : [tag.text])
                      .map((text, ti) => <p key={`tag-${ti}`}>{text}</p>)
                  }
                </div>
              </div>
            )}
          </div>
        }
      >
        <canvas
          ref={setCanvas}
          onMouseMove={event => setHoverPosition({hovering: true, clientX: event.clientX, clientY: event.clientY})}
          onMouseLeave={() => setHoverPosition({...hoverPosition, hovering: false})}
          className={S("overlay__canvas")}
        />
      </Tooltip.Floating>
    </div>
  );
});

export default Overlay;
