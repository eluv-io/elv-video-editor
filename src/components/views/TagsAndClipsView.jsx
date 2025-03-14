import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import {ClipSidePanel, TagSidePanel} from "@/components/side_panel/SidePanel.jsx";
import VideoSection from "@/components/video/VideoSection.jsx";
import {ClipTimeline, TagTimeline} from "@/components/timeline/Timeline.jsx";
import PanelView from "@/components/side_panel/PanelView.jsx";
import {keyboardControlsStore, rootStore, videoStore} from "@/stores/index.js";

const TagsAndClipsView = observer(({mode}) => {
  useEffect(() => {
    rootStore.SetPage(mode);
    keyboardControlsStore.SetActiveStore(videoStore);
  }, []);

  return (
    <PanelView
      sidePanelContent={
      mode === "tags" ?
        <TagSidePanel /> :
        <ClipSidePanel />
      }
      mainPanelContent={
        <VideoSection showOverlay />
      }
      bottomPanelContent={
        mode === "tags" ?
          <TagTimeline /> :
          <ClipTimeline />
      }
      minSizes={{
        mainPanel: 700,
        sidePanel: 350,
        bottomPanel: 260
      }}
    />
  );
});

export default TagsAndClipsView;
