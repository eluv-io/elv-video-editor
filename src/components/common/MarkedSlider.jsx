import CommonStyles from "@/assets/stylesheets/modules/common.module.scss";

import React, {useCallback, useEffect, useRef, useState} from "react";
import {CreateModuleClassMatcher, JoinClassNames} from "@/utils/Utils.js";
import {observer} from "mobx-react";
import {Tooltip} from "@mantine/core";
import {videoStore} from "@/stores/index.js";

const S = CreateModuleClassMatcher(CommonStyles);


const Handle = observer(({
  handle,
  index,
  dragging,
  min,
  max,
  PositionToPixels,
  StartDrag,
  EndDrag,
  HandleChange,
}) => {
  if(handle.position < min || handle.position > max) { return null; }

  let styleClassName = "slider__handle--line";
  if(handle.style === "circle") {
    styleClassName = "slider__handle--circle";
  } else if(handle.style === "arrow") {
    styleClassName = "slider__handle--arrow";
  }

  return (
    <Tooltip label={handle.tooltip} disabled={!handle.tooltip}>
      <div
        style={{left: `${PositionToPixels(handle.position)}px`}}
        className={
          JoinClassNames(
            S(
              "slider__handle",
              styleClassName, handle.disabled ? "slider__handle--disabled" : "",
              dragging ? "slider-handle__active" : ""
            ),
            handle.className || ""
          )
        }
        onMouseDown={handle.disabled ? undefined : event => StartDrag(event, index)}
        onMouseUp={handle.disabled ? undefined :EndDrag}
        onClick={handle.disabled ? undefined : HandleChange}
        {...(handle.additionalProps || {})}
      >
        { handle.style === "arrow" ? "▼" : null }
      </div>
    </Tooltip>
  );
});

const Marks = observer(({
  max,
  min,
  width,
  nMarks=10,
  majorMarksEvery=1,
  handles,
  RenderText,
  showNotches=true,
  showText=true
}) => {
    const scaleInterval = (max - min) / nMarks;
    const scaleOffset = scaleInterval / 2;
    const widthInterval = width / nMarks;
    const widthOffset = widthInterval / 2;

    let marks = [];
    for(let i = 0; i < nMarks; i++) {
      const scalePosition = min + (scaleInterval * i + scaleOffset);
      const passed = (handles[0] || {}).position > scalePosition;
      const majorMark = (Math.ceil(i + majorMarksEvery / 2)) % majorMarksEvery === 0;

      marks.push(
        <div
          style={{left: widthInterval * i + widthOffset }} key={`-elv-slider-mark-${i}`}
          className={S("slider__mark", passed ? "slider__mark--passed" : "")}
        >
          {
            !showNotches ? null :
              <div className={S("slider__mark-notch", majorMark ? "slider__mark-notch--major" : "")} />
          }
          {
            !showText || !majorMark ? null :
              <div className={S("slider__mark-text")}>
                { RenderText(scalePosition) }
              </div>
          }
        </div>
      );
    }

    return (
      <div className={S("slider__marks-container")}>
        { marks }
      </div>
    );
  });

let tooltipTimeout, dragTimeout, draggingHandleIndex;
const MarkedSlider = observer(({
  min,
  max,
  nMarks,
  majorMarksEvery,
  handles=[],
  onChange,
  onSlide,
  RenderText,
  showTopMarks=true,
  handleControlOnly=false,
  className=""
}) => {
  const sliderRef = useRef();
  const [hoverPosition, setHoverPosition] = useState(0);
  const [widths, setWidths] = useState({slider: 0, container: 0});
  const scale = max - min;

  useEffect(() => {
    if(!sliderRef?.current) { return; }

    const resizeObserver = new ResizeObserver(() => {
      setWidths({
        slider: sliderRef.current.getBoundingClientRect().width,
        container: sliderRef.current.parentElement.getBoundingClientRect().width,
        parent: sliderRef.current.parentElement.parentElement.getBoundingClientRect().width,
      });
    });

    resizeObserver.observe(sliderRef.current);

    return () => resizeObserver.disconnect();
  }, [sliderRef]);

  const ClientXToPosition = useCallback((clientX) => {
    if(!sliderRef?.current) { return 0; }

    const { left, width } = sliderRef.current.getBoundingClientRect();
    const position = (scale * ((clientX - left) / width)) + min;

    return Math.min(Math.max(min, position), max);
  }, [min, max, widths, sliderRef]);

  const PositionToPixels = useCallback((position) => {
    const pixels = (position - min) * (widths.slider / scale);

    const result = Math.min(Math.max(0, pixels), widths.slider);

    return isNaN(result) ? 0 : result;
  }, [min, max, widths]);

  const ClosestHandleIndex = useCallback((event) => {
    const position = ClientXToPosition(event.clientX);
    let handleIndex = 0;
    let closestHandle = max * 2;

    handles.forEach((handle, i) => {
      const distance = Math.abs(handle.position - position);
      if(distance < closestHandle && !handle.disabled && !handle.handleControlOnly) {
        closestHandle = distance;
        handleIndex = i;
      }
    });

    return handleIndex;
  }, [min, max, handles]);

  const HandleChange = useCallback((event, handleIndex) => {
    if(!onChange) { return; }

    handleIndex = typeof handleIndex !== "undefined" ? handleIndex : draggingHandleIndex;

    let value = ClientXToPosition(event.clientX);
    if(handles.length === 1) {
      // Slider - only one handle
      onChange(value);
    } else if(event.metaKey) {
      // Dragging whole range
      if(!onSlide || event.type !== "mousemove") { return; }

      onSlide(100 * event.movementX / widths.slider);
    } else {
      if(typeof handleIndex === "undefined") { return; }
      // Range - multiple handles
      // Drag handles
      let values = handles.map(handle => handle.position);

      values[handleIndex] = value;

      onChange(values);
    }
  }, [draggingHandleIndex, handles, min, max]);

  const MouseoverMove = useCallback(event => {
    clearTimeout(tooltipTimeout);

    tooltipTimeout = setTimeout(() => setHoverPosition(ClientXToPosition(event.clientX)), 10);
  }, [widths, min, max]);

  const StartMouseover = useCallback(() => {
    window.addEventListener("mousemove", MouseoverMove);
  }, [MouseoverMove]);

  const EndMouseover = useCallback(() => {
    window.removeEventListener("mousemove", MouseoverMove);
  }, [MouseoverMove]);

  const Drag = useCallback((event) => {
    clearTimeout(dragTimeout);

    dragTimeout = setTimeout(() => HandleChange(event), 10);
  }, [draggingHandleIndex, HandleChange]);

  const EndDrag = useCallback(() => {
    //setDraggingHandleIndex(undefined);
    draggingHandleIndex = undefined;

    window.removeEventListener("mousemove", Drag);
    window.removeEventListener("mouseup", EndDrag);
  }, [Drag]);

  const StartDrag = useCallback((event, handleIndex) => {
    event.stopPropagation();

    if(!event.shiftKey) {
      event = {...event};

      draggingHandleIndex = (typeof handleIndex === "undefined" ? ClosestHandleIndex(event) : handleIndex);
      setTimeout(() => HandleChange(event, draggingHandleIndex), 10);

      window.addEventListener("mousemove", Drag);
      window.addEventListener("mouseup", EndDrag);
    }
  }, [HandleChange]);

  const positions = handles.map(handle => handle.position);
  const minActive = positions.length === 1 ? min : positions[0];
  const maxActive = positions[Math.max(0, positions.length - 1)];

  return (
    <div
      className={
        JoinClassNames(
          S("slider-container"),
          className
        )
      }
    >
      <div
        onMouseEnter={StartMouseover}
        onMouseLeave={EndMouseover}
        ref={sliderRef}
        className={S("slider")}
      >
        {
          !showTopMarks ? null :
            <Marks
              min={min}
              max={max}
              handles={handles}
              width={widths.slider}
              nMarks={nMarks}
              majorMarksEvery={majorMarksEvery}
              RenderText={RenderText}
              showText
              showNotches={false}
            />
        }
        <Tooltip.Floating label={RenderText(hoverPosition)} position="top" offset={20} /*openDelay={500}*/ >
          <div
            onMouseDown={handleControlOnly ? undefined : StartDrag}
            onMouseUp={handleControlOnly ? null : EndDrag}
            onClick={handleControlOnly ? null : HandleChange}
            role="slider"
            className={S("slider__overlay")}
          >
            <div
              style={{
                left: PositionToPixels(minActive),
                right: Math.ceil(widths.slider - PositionToPixels(maxActive))
              }}
              data-slider-active={true}
              className={S("slider__active-indicator")}
            />
            {
              handles.map((handle, index) =>
                <Handle
                  key={`handle-${index}`}
                  handle={handle}
                  index={index}
                  min={min}
                  max={max}
                  dragging={index === draggingHandleIndex}
                  PositionToPixels={PositionToPixels}
                  StartDrag={StartDrag}
                  EndDrag={EndDrag}
                  HandleChange={HandleChange}
                />
              )
            }
          </div>
        </Tooltip.Floating>
        <Marks
          min={min}
          max={max}
          handles={handles}
          width={widths.slider}
          nMarks={nMarks}
          majorMarksEvery={majorMarksEvery}
          RenderText={RenderText}
          showText={!showTopMarks}
          showNotches
        />
      </div>
    </div>
  );
});

export default MarkedSlider;
