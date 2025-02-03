import {observer} from "mobx-react";
import React from "react";
import {TagSidePanel} from "@/components/side_panel/SidePanel.jsx";
import VideoSection from "@/components/video/VideoSection.jsx";
import Timeline from "@/components/timeline/Timeline.jsx";
import PanelView from "@/components/side_panel/PanelView.jsx";

const Tags = observer(() => {
  return (
    <PanelView
      sidePanelContent={<TagSidePanel />}
      mainPanelContent={<VideoSection />}
      bottomPanelContent={<Timeline />}
    />
  );
});

export default Tags;
