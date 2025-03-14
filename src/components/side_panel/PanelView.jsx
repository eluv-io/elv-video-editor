import {observer} from "mobx-react-lite";
import React, {useEffect, useRef, useState} from "react";
import {ResizeHandle} from "@/components/common/Common.jsx";
import {rootStore} from "@/stores/index.js";
import ResizeObserver from "resize-observer-polyfill";

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
  initialSidePanelProportion=0.3,
  initialTopPanelProportion=0.5,
  isSubpanel=false
}) => {
  const contentPanelRef = useRef(null);
  const [topPanel, setTopPanel] = useState(undefined);
  const [heights, setHeights] = useState({top: 0, bottom: 0});
  const [widths, setWidths] = useState({sidePanel: 0, contentPanel: 0, container: 0});

  let sidePanelHidden = !sidePanelContent || ["contentPanel", "bottomPanel"].includes(rootStore.expandedPanel);
  let contentPanelHidden = !mainPanelContent || ["sidePanel", "bottomPanel"].includes(rootStore.expandedPanel);
  let bottomPanelHidden = !bottomPanelContent || ["sidePanel", "contentPanel"].includes(rootStore.expandedPanel);

  const ResizePanelWidth = ({deltaX}) => {
    const contentPanel = contentPanelRef?.current;

    if(!contentPanel) { return; }

    const containerWidth = contentPanel.parentElement.getBoundingClientRect().width;

    // Expanded panel or no side panel content
    if(!sidePanelContent || rootStore.expandedPanel === "contentPanel") {
      setWidths({sidePanel: 0, contentPanel: containerWidth, container: containerWidth});
      return;
    } else if(rootStore.expandedPanel === "sidePanel") {
      setWidths({sidePanel: containerWidth, contentPanel: 0, container: containerWidth});
      return;
    } else if(
      !rootStore.expandedPanel &&
      !(sidePanelHidden && !contentPanelHidden) &&
      (widths.contentPanel === 0 || widths.sidePanel === 0)
    ) {
      // Content shown in both places but width is 0 for one of them - re-initialize widths
      const sidePanelWidth = Math.floor(containerWidth * initialSidePanelProportion);
      setWidths({
        sidePanel: sidePanelWidth,
        contentPanel: containerWidth - sidePanelWidth,
        container: containerWidth
      });
      return;
    }

    if(!deltaX && widths.container === containerWidth) {
      return;
    }

    const contentPanelWidth = contentPanel.getBoundingClientRect().width;

    const newContentPanelWidth = Math.min(
      Math.max(
        contentPanelWidth - deltaX,
        containerWidth * 0.3,
        minSizes.mainPanel || 0
      ),
      containerWidth * 0.9,
      containerWidth - (minSizes.sidePanel || 0)
    );
    const newSidePanelWidth = containerWidth - newContentPanelWidth;

    setWidths({
      sidePanel: newSidePanelWidth,
      contentPanel: newContentPanelWidth,
      container: containerWidth
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
    } else if(
      !rootStore.expandedPanel &&
      (!bottomPanelHidden && !(contentPanelHidden && sidePanelHidden)) &&
      (heights.top === 0 || heights.bottom === 0)
    ) {
      // Content shown in both places but height is 0 for one of them - re-initialize heights
      const topPanelHeight =
        Math.min(
          containerHeight - (minSizes.bottomPanel || 0),
          Math.floor(containerHeight * initialTopPanelProportion)
        );

      setHeights({
        top: topPanelHeight,
        bottom: containerHeight - topPanelHeight,
        container: containerHeight
      });
      return;
    }

    if(!deltaY && heights.container === containerHeight) {
      return;
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
      bottom: newBottomHeight,
      container: containerHeight
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
    if(!topPanel) {
      return;
    }

    const HandleResize = () => {
      ResizePanelWidth({deltaX: 0});
      ResizePanelHeight({deltaY: 0});
    };

    const resizeObserver = new ResizeObserver(HandleResize);
    resizeObserver.observe(topPanel.parentElement);

    return () => resizeObserver.disconnect();
  }, [topPanel, contentPanelRef, sidePanelHidden, contentPanelHidden, bottomPanelHidden]);

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
          paddingBottom: isSubpanel || bottomPanelContent ? 0 : "var(--gutter-size-y)"
        }}
        ref={element => {
          if(!element || heights.top) {
            return;
          }

          setTopPanel(element);

          const parentSize = element.parentElement.getBoundingClientRect();

          if(sidePanelContent) {
            setWidths({
              sidePanel: Math.max(
                minSizes.sidePanel || 0,
                parentSize.width * initialSidePanelProportion
              ),
              contentPanel: Math.min(
                parentSize.width - (minSizes.sidePanel || 0),
                parentSize.width - (parentSize.width * initialSidePanelProportion)
              ),
              container: parentSize.width
            });
          } else {
            setWidths({sidePanel: 0, contentPanel: parentSize.width, container: parentSize.width});
          }

          if(bottomPanelContent) {
            setHeights({
              top: Math.min(
                parentSize.height - (minSizes.bottomPanel || 0),
                Math.floor(parentSize.height * initialTopPanelProportion)
              ),
              bottom: Math.max(
                minSizes.bottomPanel || 0,
                parentSize.height - Math.floor(parentSize.height * initialTopPanelProportion)
              ),
              container: parentSize.height
            });
          } else {
            setHeights({top: parentSize.height, bottom: 0, container: parentSize.height});
          }
        }}
      >
        {
          sidePanelHidden ? null :
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
          bottomPanelHidden ? null :
            <ResizeHandle variant="vertical" onMove={ResizePanelHeight}/>
        }
      </div>
      {
        bottomPanelHidden ? null :
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
