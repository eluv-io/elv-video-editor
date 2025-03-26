import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import {ClipSidePanel, TagSidePanel} from "@/components/side_panel/SidePanel.jsx";
import VideoSection from "@/components/video/VideoSection.jsx";
import {ClipTimeline, TagTimeline} from "@/components/timeline/Timeline.jsx";
import {keyboardControlsStore, rootStore, videoStore} from "@/stores/index.js";
import {Panel, PanelGroup, PanelResizeHandle} from "react-resizable-panels";

const TagsAndClipsView = observer(({mode}) => {
  useEffect(() => {
    rootStore.SetPage(mode);
    keyboardControlsStore.SetActiveStore(videoStore);
  }, []);

  return (
    <PanelGroup direction="vertical" className="panel-group">
      <Panel defaultSize={50} minSize={30}>
        <PanelGroup direction="horizontal" className="panel-group">
          <Panel defaultSize={30} minSize={20}>
            {
              mode === "tags" ?
                <TagSidePanel /> :
                <ClipSidePanel />
            }
          </Panel>
          <PanelResizeHandle />
          <Panel>
            <VideoSection showOverlay />
          </Panel>
        </PanelGroup>
      </Panel>
      <PanelResizeHandle />
      <Panel>
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
