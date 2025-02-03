import AssetStyles from "@/assets/stylesheets/modules/assets.module.scss";

import {observer} from "mobx-react";
import React, {useEffect, useRef, useState} from "react";
import PanelView from "@/components/side_panel/PanelView.jsx";
import {AssetSidePanel} from "@/components/side_panel/SidePanel.jsx";
import {useParams} from "wouter";
import {CreateModuleClassMatcher, DownloadFromUrl} from "@/utils/Utils.js";
import {assetStore} from "@/stores/index.js";
import {Icon, LoaderImage} from "@/components/common/Common.jsx";

import DownloadIcon from "@/assets/icons/download.svg";
import Overlay from "@/components/video/Overlay.jsx";

const S = CreateModuleClassMatcher(AssetStyles);

const SelectedAsset = observer(() => {
  const { assetKey } = useParams();
  const [imageElement, setImageElement] = useState(undefined);

  if(!assetKey) {
    return (
      <div className={S("empty")}>
        Select an asset from the list to view details
      </div>
    );
  }

  const asset = assetStore.Asset(assetKey);

  return (
    <div className={S("asset-page")}>
      <div className={S("asset")}>
        <h2 className={S("asset__toolbar", "asset__title")}>{asset.label || assetKey }</h2>
        <div className={S("asset__image-container")}>
          <LoaderImage
            setRef={setImageElement}
            loaderDelay={0}
            loaderAspectRatio={1}
            src={assetStore.AssetLink(asset.key)}
            className={S("asset__image")}
          />
          {
            !imageElement ? null :
              <Overlay
                element={imageElement}
                asset={asset}
              />
          }
        </div>
        <div className={S("asset__toolbar")}>
          <button
            onClick={() => DownloadFromUrl(assetStore.AssetLink(assetKey), assetKey, {target: "_blank"})}
            className={S("asset__download")}
          >
            <Icon icon={DownloadIcon} />
            <div>
              Download Asset
            </div>
          </button>
        </div>
      </div>
      <div className={S("asset-details")}>
        Details
      </div>
    </div>
  );
});

const Assets = observer(() => {
  const { assetKey } = useParams();

  return (
    <PanelView
      sidePanelContent={<AssetSidePanel />}
      mainPanelContent={<SelectedAsset key={assetKey} />}
    />
  );
});

export default Assets;
