import {observer} from "mobx-react";
import React, {useEffect, useRef, useState} from "react";
import {ResizeHandle} from "@/components/common/Common.jsx";
import {rootStore} from "@/stores/index.js";

let timeout;
export const PanelView = observer(({
  mainPanelContent,
  sidePanelContent,
  bottomPanelContent,
  minSizes={
    sidePanel: 0,
    mainPanel: 0,
    bottomPanel: 0
  },
  isSubpanel=false
}) => {
  const contentPanelRef = useRef(null);
  const [topPanel, setTopPanel] = useState(undefined);
  const [heights, setHeights] = useState({top: 0, bottom: 0});
  const [widths, setWidths] = useState({sidePanel: 0, contentPanel: 0});

  let sidePanelHidden = ["contentPanel", "bottomPanel"].includes(rootStore.expandedPanel);
  let contentPanelHidden = ["sidePanel", "bottomPanel"].includes(rootStore.expandedPanel);
  let bottomPanelHidden = ["sidePanel", "contentPanel"].includes(rootStore.expandedPanel);

  const ResizePanelWidth = ({deltaX}) => {
    const contentPanel = contentPanelRef?.current;

    if(!contentPanel) { return; }

    const containerWidth = contentPanel.parentElement.getBoundingClientRect().width;

    // Expanded panel or no side panel content
    if(!sidePanelContent || rootStore.expandedPanel === "contentPanel") {
      setWidths({sidePanel: 0, contentPanel: containerWidth});
      return;
    } else if(rootStore.expandedPanel === "sidePanel") {
      setWidths({sidePanel: containerWidth, contentPanel: 0});
      return;
    }

    const contentPanelWidth = contentPanel.getBoundingClientRect().width;

    const newContentPanelWidth = Math.min(
      Math.max(
        contentPanelWidth - deltaX,
        containerWidth * 0.5,
        minSizes.mainPanel || 0
      ),
      containerWidth * 0.8,
      containerWidth - (minSizes.sidePanel || 0)
    );
    const newSidePanelWidth = containerWidth - newContentPanelWidth;

    setWidths({
      sidePanel: newSidePanelWidth,
      contentPanel: newContentPanelWidth
    });

    if(!isSubpanel) {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const sidePanel = document.querySelector(".side-panel");

        if(sidePanel) {
          rootStore.SetSidePanelDimensions(sidePanel?.getBoundingClientRect());
        }
      }, 1000);
    }
  };

  const ResizePanelHeight = ({deltaY}) => {
    if(!topPanel) { return; }

    const containerHeight = topPanel.parentElement.getBoundingClientRect().height;

    if(!bottomPanelContent || bottomPanelHidden) {
      setHeights({top: containerHeight, bottom: 0});
      return;
    } else if(rootStore.expandedPanel === "bottomPanel") {
      setHeights({top: 0, bottom: containerHeight});
    }

    const topHeight = topPanel.getBoundingClientRect().height;

    const newTopHeight = Math.min(
      Math.max(
        topHeight + deltaY,
        containerHeight * 0.25,
      ),
      containerHeight - (minSizes.bottomPanel || 0),
      containerHeight * 0.75
    );
    const newBottomHeight = containerHeight - newTopHeight;

    setHeights({
      top: newTopHeight,
      bottom: newBottomHeight
    });

    if(!isSubpanel) {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const sidePanel = document.querySelector(".side-panel");

        if(sidePanel) {
          rootStore.SetSidePanelDimensions(sidePanel?.getBoundingClientRect());
        }
      }, 1000);
    }
  };

  useEffect(() => {
    const HandleResize = () => {
      ResizePanelWidth({deltaX: 0});
      ResizePanelHeight({deltaY: 0});
    };

    window.addEventListener("resize", HandleResize);

    return () => window.removeEventListener("resize", HandleResize);
  }, [topPanel, contentPanelRef]);

  useEffect(() => {
    ResizePanelWidth({deltaX: -1 * window.innerWidth * 0.65});
    ResizePanelHeight({deltaY: 0});
  }, [rootStore.expandedPanel]);

  return (
    <>
      <div
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

          setTopPanel(element);

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
              className={`side-panel ${sidePanelHidden ? "hidden-panel" : ""}`}
              style={{width: widths.sidePanel, maxWidth: widths.sidePanel}}
            >
              { sidePanelContent }
              {
                contentPanelHidden ? null :
                  <ResizeHandle variant="horizontal" onMove={ResizePanelWidth}/>
              }
            </div>
        }
        <div
          ref={contentPanelRef}
          className={`content-panel ${contentPanelHidden ? "hidden-panel" : ""}`}
          style={!sidePanelContent ? {width: "100%"} : {width: widths.contentPanel, maxWidth: widths.contentPanel}}
        >
          { mainPanelContent }
        </div>
        {
          !bottomPanelContent || bottomPanelHidden ? null :
            <ResizeHandle variant="vertical" onMove={ResizePanelHeight}/>
        }
      </div>
      {
        !bottomPanelContent ? null :
          <div
            className={`bottom  ${bottomPanelHidden ? "hidden-panel" : ""}`}
            style={{height: heights.bottom, maxHeight: heights.bottom}}
          >
            { bottomPanelContent }
          </div>
      }
    </>
  );
});

export default PanelView;
