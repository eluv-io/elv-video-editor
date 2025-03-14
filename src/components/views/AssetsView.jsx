import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import PanelView from "@/components/side_panel/PanelView.jsx";
import {AssetSidePanel} from "@/components/side_panel/SidePanel.jsx";
import {useParams} from "wouter";
import SelectedAsset from "@/components/assets/Assets.jsx";
import {rootStore, assetStore} from "@/stores/index.js";

const AssetsView = observer(() => {
  const {assetKey} = useParams();

  useEffect(() => {
    assetStore.ClearSelectedTags();
    rootStore.SetPage("assets");
    rootStore.SetSubpage(assetKey);
  }, [assetKey]);

  return (
    <PanelView
      key={!!assetKey}
      sidePanelContent={<AssetSidePanel />}
      mainPanelContent={<SelectedAsset key={assetKey} assetKey={assetKey}/>}
    />
  );
});

export default AssetsView;
