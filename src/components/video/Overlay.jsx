import OverlayStyles from "@/assets/stylesheets/modules/overlay.module.scss";

import React, {useEffect, useRef, useState} from "react";
import {observer} from "mobx-react";
import {reaction} from "mobx";
import ResizeObserver from "resize-observer-polyfill";
import {assetStore, overlayStore, tagStore, trackStore, videoStore} from "@/stores/index.js";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {Tooltip} from "@mantine/core";

const frameSpread = 10;

const S = CreateModuleClassMatcher(OverlayStyles);

const selectedColor = {
  r: 25,
  g: 200,
  b: 255,
  a: 150
};

const editingColor = {
  r: 50,
  g: 255,
  b: 0,
  a: 255
};

const ReorderPoints = (points) => {
  // Ensure points are sorted clockwise from top left
  points = [...points].sort((a, b) => a[0] < b[0] ? -1 : 1);

  return [
    points[0].y < points[1].y ? points[0] : points[1],
    points[2].y < points[3].y ? points[2] : points[3],
    points[2].y < points[3].y ? points[3] : points[2],
    points[0].y < points[1].y ? points[1] : points[0]
  ];
};

const BoxToPoints = (box) => {
  let {x1, x2, y1, y2, x3, y3, x4, y4} = box;

  let points;
  if(!x3) {
    points = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
  } else {
    points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
  }

  return ReorderPoints(points);
};

const PointsToBox = (points) => {
  points = ReorderPoints(points);

  const isRectangle =
    points[0][0] === points[3][0] &&
    points[1][0] === points[2][0];

  if(isRectangle) {
    return {
      x1: points[0][0],
      x2: points[2][0],
      y1: points[0][1],
      y2: points[2][1]
    };
  } else {
    return {
      x1: points[0][0], y1: points[0][1],
      x2: points[1][0], y2: points[1][1],
      x3: points[2][0], y3: points[2][1],
      x4: points[3][0], y4: points[3][1],
    };
  }
};

const PointInPolygon = ([x, y], points) => {
  let inside = false;
  let p1 = points[0];
  let p2;
  for (let i=1; i <= points.length; i++) {
      p2 = points[i % points.length];

      if (y > Math.min(p1[1], p2[1])) {
          if (y <= Math.max(p1[1], p2[1])) {
              if (x <= Math.max(p1[0], p2[0])) {
                  const x_intersection = ((y - p1[1]) * (p2[0] - p1[0])) / (p2[1] - p1[1]) + p1[0];

                  if (p1[0] === p2[0] || x <= x_intersection) {
                      inside = !inside;
                  }
              }
          }
      }

      p1 = p2;
  }

  return inside;
};

const PolygonOverlayEdit = observer(({pos, points, setPoints}) => {
  const pointSize = 10;
  const canvasRef = useRef();
  const canvasWidth = overlayStore.overlayCanvasDimensions.width;
  const canvasHeight = overlayStore.overlayCanvasDimensions.height;
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if(!points || !canvasRef?.current) { return; }

    const pxpts = points.map(point => [point[0] * canvasWidth, point[1] * canvasHeight]);

    canvasRef.current.width = canvasWidth;
    canvasRef.current.height = canvasHeight;
    const context = canvasRef.current.getContext("2d");
    context.strokeStyle = "#FFFFFF";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(pxpts[0][0], pxpts[0][1]);
    context.lineTo(pxpts[1][0], pxpts[1][1]);
    context.lineTo(pxpts[2][0], pxpts[2][1]);
    context.lineTo(pxpts[3][0], pxpts[3][1]);
    context.closePath();
    context.stroke();
  }, [points]);

  const StartDragging = (event, type) => {
    setDragging(type);

    event?.stopPropagation();
    event?.preventDefault();
    event.cancelBubble = true;
    event.returnValue = false;

    const StopDragging = () => {
      setDragging(false);
      window.removeEventListener("mouseup", StopDragging);
    };

    window.addEventListener("mouseup", StopDragging);
  };

  return (
    <div
      style={{width: `${overlayStore.overlayCanvasDimensions.width}px`}}
      onMouseMove={event => {
        if(!dragging) { return; }

        let dx = Math.min(
          canvasWidth - pos.maxX,
          Math.max(-1 * pos.minX, event.movementX)
        );
        let dy = Math.min(
          canvasHeight - pos.maxY,
          Math.max(-1 * pos.minY, event.movementY)
        );

        if(dragging !== "whole") {
          dx = Math.max(dx, (pos.minX + 25) - pos.maxX);
          dy = Math.max(dy, (pos.minY + 25) - pos.maxY);
        }

        dx = dx / canvasWidth;
        dy = dy / canvasHeight;

        switch(dragging) {
          case "whole":
            setPoints(points.map(([x, y]) => [x + dx, y + dy]));
            break;
          default:
            const index = parseInt(dragging);
            let newPoints = [...points];
            newPoints[index][0] += dx;
            newPoints[index][1] += dy;
            setPoints(newPoints);
        }
      }}
      onMouseDown={event => {
        const dimensions = event.currentTarget.getBoundingClientRect();
        const posX = (event.clientX - dimensions.left) / dimensions.width;
        const posY = (event.clientY - dimensions.top) / dimensions.height;

        if(PointInPolygon([posX, posY], points)) {
          StartDragging(event, "whole");
        }
      }}
      className={S("overlay", "overlay-edit")}
    >
      <canvas ref={canvasRef} className={S("overlay-edit__canvas")} />
      {
        points?.map(([x, y], index) =>
          <div
            key={`point-${index}`}
            onMouseDown={event => StartDragging(event, index.toString())}
            style={{
              height: `${pointSize}px`,
              width: `${pointSize}px`,
              top: `${y * canvasHeight - (pointSize / 2)}px`,
              left: `${x * canvasWidth - (pointSize / 2)}px`,
            }}
            className={S("overlay-edit__point")}
          />
        )
      }
    </div>
  );
});

const RectangleOverlayEdit = observer(({points, setPoints, pos}) => {
  const [dragging, setDragging] = useState(false);

  const canvasWidth = overlayStore.overlayCanvasDimensions.width;
  const canvasHeight = overlayStore.overlayCanvasDimensions.height;

  const StartDragging = (event, type) => {
    setDragging(type);

    event?.stopPropagation();
    event?.preventDefault();
    event.cancelBubble = true;
    event.returnValue = false;

    const StopDragging = () => {
      setDragging(false);
      window.removeEventListener("mouseup", StopDragging);
    };

    window.addEventListener("mouseup", StopDragging);
  };

  return (
    <div
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
      onMouseMove={event => {
        if(!dragging) { return; }

        let dx = Math.min(
          canvasWidth - pos.maxX,
          Math.max(-1 * pos.minX, event.movementX)
        );
        let dy = Math.min(
          canvasHeight - pos.maxY,
          Math.max(-1 * pos.minY, event.movementY)
        );

        if(dragging !== "whole") {
          dx = Math.max(dx, (pos.minX + 25) - pos.maxX);
          dy = Math.max(dy, (pos.minY + 25) - pos.maxY);
        }

        dx = dx / canvasWidth;
        dy = dy / canvasHeight;

        switch(dragging) {
          case "whole":
            setPoints(
              points.map(([x, y]) => [x + dx, y + dy])
            );
            break;
          case "right":
            setPoints([
              points[0],
              [points[1][0] + dx, points[1][1]],
              [points[2][0] + dx, points[2][1]],
              points[3]
            ]);
            break;
          case "bottom":
            setPoints([
              points[0],
              points[1],
              [points[2][0], points[2][1] + dy],
              [points[3][0], points[3][1] + dy]
            ]);
            break;
          case "corner":
            setPoints([
              points[0],
              [points[1][0] + dx, points[1][1]],
              [points[2][0] + dx, points[2][1] + dy],
              [points[3][0], points[3][1] + dy]
            ]);
        }
      }}
      style={{width: `${overlayStore.overlayCanvasDimensions.width}px`}}
      className={S("overlay", "overlay-edit")}
    >
      <div
        onMouseDown={event => StartDragging(event, "whole")}
        style={{
          width: `${pos.width}px`,
          height: `${pos.height}px`,
          top: `${pos.minY}px`,
          left: `${pos.minX}px`,
          resize: "both"
        }}
        className={S("overlay-edit__box")}
      >
        <div
          onMouseDown={event => StartDragging(event, "right")}
          className={S("overlay-edit__box-resize", dragging === "right" ? "overlay-edit__box-resize--active" : "", "overlay-edit__box-right")}
        />
        <div
          onMouseDown={event => StartDragging(event, "bottom")}
          className={S("overlay-edit__box-resize", dragging === "bottom" ? "overlay-edit__box-resize--active" : "", "overlay-edit__box-bottom")}
        />
        <div
          onMouseDown={event => StartDragging(event, "corner")}
          className={S("overlay-edit__box-resize", dragging === "corner" ? "overlay-edit__box-resize--active" : "", "overlay-edit__box-corner")}
        />
      </div>
    </div>
  );
});

const OverlayEdit = observer(({initalBox, onChange}) => {
  const [points, setPoints] = useState(undefined);
  const [dragging, setDragging] = useState(false);

  const canvasWidth = overlayStore.overlayCanvasDimensions.width;
  const canvasHeight = overlayStore.overlayCanvasDimensions.height;

  useEffect(() => setPoints(BoxToPoints(initalBox)), []);

  useEffect(() => {
    points && onChange?.(PointsToBox(points));
  }, [points]);

  if(!points) { return; }

  const isRectangle = false;
    //points[0][0] === points[3][0] &&
    //points[1][0] === points[2][0];

    let pos = {minY: 10000, minX: 10000, maxY: 0, maxX: 0};
  points
    .map(point => [point[0] * canvasWidth, point[1] * canvasHeight])
    .forEach(([x, y]) => {
      pos.minX = Math.min(x, pos.minX);
      pos.minY = Math.min(y, pos.minY);
      pos.maxX = Math.max(x, pos.maxX);
      pos.maxY = Math.max(y, pos.maxY);
    });

  pos.width = pos.maxX - pos.minX;
  pos.height = pos.maxY - pos.minY;

  console.log(isRectangle);
  return isRectangle ?
    <RectangleOverlayEdit pos={pos} points={points} setPoints={setPoints} /> :
    <PolygonOverlayEdit pos={pos} points={points} setPoints={setPoints} />;
});

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
      color: { r: 0, g: 200, b: 0}
    });
  }

  return tags.filter(tag => !!tag.box);
};

const Tags = () => {
  if(videoStore.frame === 0) { return []; }

  const tags = {};

  let overlayTags;
  for(let i = videoStore.frame; i > Math.max(0, videoStore.frame - frameSpread); i--) {
    overlayTags = overlayStore.overlayTags[i.toString()];

    if(overlayTags) {
      Object.keys(overlayTags).forEach(key => {
        if(!tags[key] && typeof overlayTags[key] === "object" && Object.keys(overlayTags[key]).length > 0) {
          tags[key] = { ...(overlayTags[key] || {}) };
        }
      });
    }
  }

  if(Object.keys(tags).length === 0) { return []; }

  let activeTags = [];
  trackStore.tracks
    .filter(track => ["clips", "metadata"].includes(track.trackType))
    .forEach(track => {
      if(!overlayStore.visibleOverlayTracks[track.key]) { return; }

      if(!tags[track.key] || typeof tags[track.key] !== "object") { return; }

      let boxes = [];
      if(tags[track.key].activeTags) {
        boxes = tags[track.key].activeTags;
      } else {
        if(typeof tags[track.key].tags !== "object") { return; }

        tags[track.key].tags.map(tag => {
          boxes.push({
            ...tag
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

const Draw = ({canvas, tags, hoverTags, elementSize}) => {
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

    let points;
    if(!x3) {
      points = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
    } else {
      points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
    }
    points = points.map(point => [point[0] * width, point[1] * height]);

    const toHex = n => n.toString(16).padStart(2, "0");

    let color = tag.color;
    if(tagStore.editedOverlayTag?.tagId === tag.tagId) {
      color = editingColor;
    } else if(
      hoverTags?.find(hoverTag => hoverTag.tagId === tag.tagId) ||
      tagStore.selectedOverlayTagId === tag.tagId
    ) {
      color = selectedColor;
    }

    context.strokeStyle = `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;

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

  const hoverTags = !hoverPosition.hovering ? [] :
    TagsAt({canvas, asset, clientX: hoverPosition.clientX, clientY: hoverPosition.clientY});

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
        hoverTags,
        elementSize: overlayStore.overlayCanvasDimensions
      });

    const DisposeDrawReaction = reaction(
      () => ({
        enabled: overlayStore.overlayEnabled,
        frame: videoStore.frame,
        elementSize: overlayStore.overlayCanvasDimensions,
        selectedOverlayTagIds: tagStore.selectedOverlayTagIds,
        editingOverlayTagId: tagStore.editedOverlayTag?.tagId,
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
  }, [canvas, highlightTag, hoverTags]);

  if(!asset && !overlayStore.overlayEnabled) { return null; }


  if(tagStore.editedOverlayTag) {
    return (
      <OverlayEdit
        initalBox={tagStore.editedOverlayTag.box}
        onChange={box =>
          tagStore.UpdateEditedOverlayTag({
            ...tagStore.editedOverlayTag,
            box
          })
        }
      />
    );
  }

  return (
    <div className={S("overlay")} style={{width: `${overlayStore.overlayCanvasDimensions.width}px`}}>
      <Tooltip.Floating
        disabled={hoverTags.length === 0}
        position="bottom"
        offset={20}
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
          onClick={event => {
            const tags = TagsAt({canvas, clientX: event.clientX, clientY: event.clientY});

            if(tags.length > 0) {
              tagStore.SetSelectedOverlayTags(tags[0].frame, tags.map(tag => tag.tagId));
            } else {
              tagStore.ClearSelectedOverlayTags();
            }
          }}
          onMouseMove={event => setHoverPosition({hovering: true, clientX: event.clientX, clientY: event.clientY})}
          onMouseLeave={() => setHoverPosition({...hoverPosition, hovering: false})}
          className={S("overlay__canvas")}
        />
      </Tooltip.Floating>
    </div>
  );
});

export default Overlay;
