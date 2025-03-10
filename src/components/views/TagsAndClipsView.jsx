import {observer} from "mobx-react-lite";
import React from "react";
import {ClipSidePanel, TagSidePanel} from "@/components/side_panel/SidePanel.jsx";
import VideoSection from "@/components/video/VideoSection.jsx";
import {ClipTimeline, TagTimeline} from "@/components/timeline/Timeline.jsx";
import PanelView from "@/components/side_panel/PanelView.jsx";

const TagsAndClipsView = observer(({mode}) => {
  return (
    <PanelView
      sidePanelContent={
      mode === "tags" ?
        <TagSidePanel /> :
        <ClipSidePanel />
      }
      mainPanelContent={
        <VideoSection />
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
