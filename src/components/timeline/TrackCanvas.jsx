import React, {useEffect, useRef} from "react";
import ResizeObserver from "resize-observer-polyfill";
import {observer} from "mobx-react";

const TrackCanvas = observer(({onResize, setCanvas, containerClassName="", className="", ...props}) => {
  const ref = useRef();
  const canvasRef = useRef();

  useEffect(() => {
    if(!ref?.current) { return; }

    const resizeObserver = new ResizeObserver(entries => {
      const node = entries[0].target.parentNode;

      onResize && onResize({width: node.offsetWidth, height: node.offsetHeight});
    });

    resizeObserver.observe(ref.current);

    return () => {
      resizeObserver && resizeObserver.disconnect();
    };
  }, [ref?.current]);

  useEffect(() => {
    if(!canvasRef?.current) { return; }

    setCanvas && setCanvas(canvasRef.current);
  }, [canvasRef?.current]);

  return (
    <div ref={ref} className={containerClassName}>
      <canvas
        {...props}
        width="50"
        height="50"
        className={className}
        ref={canvasRef}
      />
    </div>
  );
});

export default TrackCanvas;
