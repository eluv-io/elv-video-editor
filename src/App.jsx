import {observer} from "mobx-react";
import React, {useEffect, useState} from "react";
import {rootStore} from "@/stores";
import {Loader, ResizeHandle} from "@/components/common/Common";
import Browser from "@/components/nav/Browser";
import SidePanel from "@/components/side_panel/SidePanel";
import VideoSection from "@/components/video/VideoSection";
import Timeline from "@/components/timeline/Timeline";
import UrlJoin from "url-join";
import Nav from "@/components/nav/Nav.jsx";

const AppContent = observer(() => {
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [heights, setHeights] = useState({top: 0, bottom: 0});
  const [widths, setWidths] = useState({sidePanel: 0, videoPanel: 0});

  const ResizePanelWidth = ({deltaX}) => {
    const videoPanel = document.querySelector("#video-panel");

    if(!videoPanel) { return; }

    const containerWidth = videoPanel.parentElement.getBoundingClientRect().width;
    const videoPanelWidth = videoPanel.getBoundingClientRect().width;

    const newVideoPanelWidth = Math.min(Math.max(videoPanelWidth - deltaX, containerWidth * 0.5), containerWidth * 0.8);
    const newSidePanelWidth = containerWidth - newVideoPanelWidth;

    setWidths({
      sidePanel: newSidePanelWidth,
      videoPanel: newVideoPanelWidth
    });
  };

  const ResizePanelHeight = ({deltaY}) => {
    const topPanel = document.querySelector("#top");

    if(!topPanel) { return; }

    const containerHeight = topPanel.parentElement.getBoundingClientRect().height;
    const topHeight = topPanel.getBoundingClientRect().height;

    const newTopHeight = Math.min(Math.max(topHeight + deltaY, containerHeight * 0.25), containerHeight * 0.75);
    const newBottomHeight = containerHeight - newTopHeight;

    setHeights({
      top: newTopHeight,
      bottom: newBottomHeight
    });
  };

  useEffect(() => {
    const HandleResize = () => {
      ResizePanelWidth({deltaX: 0});
      ResizePanelHeight({deltaY: 0});
    };

    window.addEventListener("resize", HandleResize);

    return () => window.removeEventListener("resize", HandleResize);
  }, []);

  if(!rootStore.initialized) {
    return <Loader />;
  }

  if(rootStore.view === "source") {
    return <Browser />;
  }

  return (
    <>
      <div
        id="top"
        className="top"
        style={{height: heights.top, maxHeight: heights.top, minHeight: heights.top}}
        ref={element => {
          if(!element || heights.top) { return; }

          const parentSize = element.parentElement.getBoundingClientRect();

          setWidths({sidePanel: parentSize.width * 0.3, videoPanel: parentSize.width - (parentSize.width * 0.3)});
          setHeights({top: parentSize.height * 0.5, bottom: parentSize.height - (parentSize.height * 0.5)});
        }}
      >
        {
          !showSidePanel ? null :
            <div
              className="side-panel"
              style={{width: widths.sidePanel, maxWidth: widths.sidePanel}}
            >
              <SidePanel />
              <ResizeHandle variant="horizontal" onMove={ResizePanelWidth} />
            </div>
        }
        <div
          id="video-panel"
          className="video-panel"
          style={!showSidePanel ? {width: "100%"} : {width: widths.videoPanel, maxWidth: widths.videoPanel}}
        >
          <VideoSection/>
        </div>
        <ResizeHandle variant="vertical" onMove={ResizePanelHeight}/>
      </div>
      <div
        id="bottom"
        className="bottom"
        style={{height: heights.bottom, maxHeight: heights.bottom}}
      >
        <Timeline/>
      </div>
    </>
  );
});

const App = observer(() => {
  if(window.self === window.top) {
    // Not in Core frame - Redirect
    window.location = UrlJoin(EluvioConfiguration.coreUrl, "/", window.location.hash);
    return;
  }

  if(!rootStore.client) {
    return null;
  }

  return (
    <div className="page-container">
      <Nav />
      <div className="content">
        <AppContent />
      </div>
    </div>
  );
});

export default App;
