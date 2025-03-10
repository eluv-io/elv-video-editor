import {observer} from "mobx-react-lite";
import React from "react";
import {ClipSidePanel, TagSidePanel} from "@/components/side_panel/SidePanel.jsx";
import PanelView from "@/components/side_panel/PanelView.jsx";
import {compositionStore} from "@/stores/index.js";
import CompositionTimeline from "@/components/compositions/CompositionTimeline.jsx";
import CompositionVideoSection from "@/components/compositions/CompositionVideoSection.jsx";

const CompositionsView = observer(({mode}) => {
  return (
    <PanelView
      sidePanelContent={
        mode === "tags" ?
          <TagSidePanel /> :
          <ClipSidePanel />
      }
      mainPanelContent={
        <PanelView
          isSubpanel
          initialSidePanelProportion={0.5}
          sidePanelContent={
            !compositionStore.selectedClip ? null :
              <CompositionVideoSection clip store={compositionStore.selectedClipStore} />
          }
          mainPanelContent={<CompositionVideoSection store={compositionStore.videoStore} />}
        />
      }
      bottomPanelContent={<CompositionTimeline />}
      initialTopPanelProportion={0.6}
      minSizes={{
        mainPanel: 700,
        sidePanel: 350,
        bottomPanel: 260
      }}
    />
  );
});

export default CompositionsView;
