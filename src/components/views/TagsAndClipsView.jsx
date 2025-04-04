import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {ClipSidePanel, TagSidePanel} from "@/components/side_panel/SidePanel.jsx";
import VideoSection from "@/components/video/VideoSection.jsx";
import {ClipTimeline, TagTimeline} from "@/components/timeline/Timeline.jsx";
import {keyboardControlsStore, rootStore, trackStore, videoStore} from "@/stores/index.js";
import {Panel, PanelGroup, PanelResizeHandle} from "react-resizable-panels";

const TagsAndClipsView = observer(({mode}) => {
  const [sidePanel, setSidePanel] = useState(undefined);
  const [sidePanelDimensions, setSidePanelDimensions] = useState(undefined);

  useEffect(() => {
    rootStore.SetPage(mode);
    keyboardControlsStore.SetActiveStore(videoStore);
  }, []);

  useEffect(() => {
    if(!sidePanel) { return; }

    const resizeObserver = new ResizeObserver(() =>
      setSidePanelDimensions(sidePanel.getBoundingClientRect())
    );

    resizeObserver.observe(sidePanel);

    return () => resizeObserver?.disconnect();
  }, [sidePanel]);

  const trackCount = mode === "tags" ?
    trackStore.metadataTracks.length :
    trackStore.clipTracks.length;

  return (
    <PanelGroup direction="vertical" className="panel-group">
      <Panel id="top" defaultSize={trackCount > 2 ? 45 : 60} minSize={30}>
        <PanelGroup direction="horizontal" className="panel-group">
          <Panel id="side-panel" style={{"--panel-width": `${sidePanelDimensions?.width}px`}} defaultSize={30} minSize={20}>
            {
              mode === "tags" ?
                <TagSidePanel setElement={setSidePanel} /> :
                <ClipSidePanel setElement={setSidePanel} />
            }
          </Panel>
          <PanelResizeHandle />
          <Panel id="content">
            <VideoSection showOverlay />
          </Panel>
        </PanelGroup>
      </Panel>
      <PanelResizeHandle />
      <Panel id="bottom">
        {
          mode === "tags" ?
            <TagTimeline /> :
            <ClipTimeline />
        }
      </Panel>
    </PanelGroup>
  );
});

export default TagsAndClipsView;
