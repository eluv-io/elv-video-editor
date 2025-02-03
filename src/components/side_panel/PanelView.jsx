import {observer} from "mobx-react";
import React, {useEffect, useState} from "react";
import {ResizeHandle} from "@/components/common/Common.jsx";
import {rootStore} from "@/stores/index.js";

export const PanelView = observer(({mainPanelContent, sidePanelContent, bottomPanelContent}) => {
  const [heights, setHeights] = useState({top: 0, bottom: 0});
  const [widths, setWidths] = useState({sidePanel: 0, contentPanel: 0});

  const ResizePanelWidth = ({deltaX}) => {
    const contentPanel = document.querySelector("#content-panel");

    if(!contentPanel) { return; }

    const containerWidth = contentPanel.parentElement.getBoundingClientRect().width;

    if(!sidePanelContent) {
      setWidths({sidePanel: 0, contentPanel: containerWidth});
      return;
    }

    const contentPanelWidth = contentPanel.getBoundingClientRect().width;

    const newcontentPanelWidth = Math.min(Math.max(contentPanelWidth - deltaX, containerWidth * 0.5), containerWidth * 0.8);
    const newSidePanelWidth = containerWidth - newcontentPanelWidth;

    setWidths({
      sidePanel: newSidePanelWidth,
      contentPanel: newcontentPanelWidth
    });
  };

  const ResizePanelHeight = ({deltaY}) => {
    const topPanel = document.querySelector("#top");

    if(!topPanel) { return; }

    const containerHeight = topPanel.parentElement.getBoundingClientRect().height;

    if(!bottomPanelContent) {
      setHeights({top: containerHeight, bottom: 0});
      return;
    }

    const topHeight = topPanel.getBoundingClientRect().height;

    const newTopHeight = Math.min(Math.max(topHeight + deltaY, containerHeight * 0.25), containerHeight * 0.75);
    const newBottomHeight = containerHeight - newTopHeight;

    setHeights({
      top: newTopHeight,
      bottom: newBottomHeight
    });

    setTimeout(() => {
      const sidePanel = document.querySelector(".side-panel");

      if(sidePanel) {
        rootStore.SetSidePanelDimensions(sidePanel?.getBoundingClientRect());
      }
    }, 1000);
  };

  useEffect(() => {
    const HandleResize = () => {
      ResizePanelWidth({deltaX: 0});
      ResizePanelHeight({deltaY: 0});
    };

    window.addEventListener("resize", HandleResize);

    return () => window.removeEventListener("resize", HandleResize);
  }, []);

  return (
    <>
      <div
        id="top"
        className="top"
        style={{
          height: heights.top,
          maxHeight: heights.top,
          minHeight: heights.top,
          "--panel-height": `${heights.top}px`,
          "--panel-width": `${widths.sidePanel}px`,
          paddingBottom: bottomPanelContent ? 0 : "var(--gutter-size-y)"
        }}
        ref={element => {
          if(!element || heights.top) {
            return;
          }

          const parentSize = element.parentElement.getBoundingClientRect();

          if(sidePanelContent) {
            setWidths({
              sidePanel: parentSize.width * 0.3,
              contentPanel: parentSize.width - (parentSize.width * 0.3)
            });
          } else {
            setWidths({sidePanel: 0, contentPanel: parentSize.width});
          }

          if(bottomPanelContent) {
            setHeights({
              top: parentSize.height * 0.5,
              bottom: parentSize.height - (parentSize.height * 0.5)
            });
          } else {
            setHeights({top: parentSize.height, bottom: 0});
          }
        }}
      >
        {
          !sidePanelContent ? null :
            <div
              className="side-panel"
              style={{width: widths.sidePanel, maxWidth: widths.sidePanel}}
            >
              { sidePanelContent }
              <ResizeHandle variant="horizontal" onMove={ResizePanelWidth}/>
            </div>
        }
        <div
          id="content-panel"
          className="content-panel"
          style={!sidePanelContent ? {width: "100%"} : {width: widths.contentPanel, maxWidth: widths.contentPanel}}
        >
          { mainPanelContent }
        </div>
        {
          !bottomPanelContent ? null :
            <ResizeHandle variant="vertical" onMove={ResizePanelHeight}/>
        }
      </div>
      {
        !bottomPanelContent ? null :
          <div
            id="bottom"
            className="bottom"
            style={{height: heights.bottom, maxHeight: heights.bottom}}
          >
            { bottomPanelContent }
          </div>
      }
      </>
  );
});

export default PanelView;
