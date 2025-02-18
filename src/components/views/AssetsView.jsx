import {observer} from "mobx-react";
import React from "react";
import PanelView from "@/components/side_panel/PanelView.jsx";
import {AssetSidePanel} from "@/components/side_panel/SidePanel.jsx";
import {useParams} from "wouter";
import SelectedAsset from "@/components/assets/Assets.jsx";

const AssetsView = observer(() => {
  const {assetKey} = useParams();

  return (
    <PanelView
      sidePanelContent={<AssetSidePanel />}
      mainPanelContent={<SelectedAsset key={assetKey}/>}
    />
  );
});

export default AssetsView;
