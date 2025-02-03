import AssetStyles from "@/assets/stylesheets/modules/assets.module.scss";

import {observer} from "mobx-react";
import React, {useState} from "react";
import PanelView from "@/components/side_panel/PanelView.jsx";
import {AssetSidePanel} from "@/components/side_panel/SidePanel.jsx";
import {useParams} from "wouter";
import {CreateModuleClassMatcher, DownloadFromUrl} from "@/utils/Utils.js";
import {assetStore} from "@/stores/index.js";
import {Icon, LoaderImage} from "@/components/common/Common.jsx";

import DownloadIcon from "@/assets/icons/download.svg";
import Overlay from "@/components/video/Overlay.jsx";
import {Tooltip} from "@mantine/core";

const S = CreateModuleClassMatcher(AssetStyles);

const AssetTags = observer(({asset, setHoverTag}) => {
  if(!asset) {
    return null;
  }

  if(!asset.image_tags || Object.keys(asset.image_tags).length === 0) {
    return (
      <div className={S("asset-tags")}>
        No Tags
      </div>
    );
  }

  return (
    <div className={S("asset-tags")}>
      {
        Object.keys(asset.image_tags).map(trackKey => {
          const track = assetStore.AssetTrack(trackKey);
          const tags = asset.image_tags[trackKey].tags || [];

          if(!track || tags.length === 0) {
            return null;
          }

          return (
            <div key={`track-${trackKey}`} className={S("asset-tags__track")}>
              <div className={S("asset-tags__track-title")}>
                { track.label }
              </div>
              <div className={S("asset-tags__tags")}>
                {
                  (asset.image_tags[trackKey].tags || []).map((tag, index) =>
                    <Tooltip.Floating
                      position="top"
                      offset={30}
                      label={
                        <div className={S("tooltip")}>
                          <div className={S("tooltip__item")}>
                            <div className={S("tooltip__label")}>
                              {track.label}
                            </div>
                            <div className={S("tooltip__content")}>
                              {
                                (Array.isArray(tag.text) ? tag.text : [tag.text])
                                  .map((text, ti) => <p key={`tag-${index}-${ti}`}>{text}</p>)
                              }
                            </div>
                          </div>
                        </div>
                      }
                      key={index}
                    >
                      <div
                        onMouseEnter={() => setHoverTag(tag)}
                        onMouseLeave={() => setHoverTag(undefined)}
                        className={S("asset-tag")}
                      >
                        <div
                          style={{backgroundColor: `rgb(${track.color.r} ${track.color.g} ${track.color.b}`}}
                          className={S("asset-tag__background")}
                        />
                        <div
                          style={{backgroundColor: `rgb(${track.color.r} ${track.color.g} ${track.color.b}`}}
                          className={S("asset-tag__color")}
                        />
                        <div className={S("asset-tag__label")}>
                          {tag.text}
                        </div>
                      </div>
                    </Tooltip.Floating>
                  )
                }
              </div>
            </div>
          );
        })
      }
    </div>
  );
});

const AssetContent = observer(({asset, hoverTag}) => {
  const [imageElement, setImageElement] = useState(undefined);

  return (
    <div className={S("asset")}>
      <h2 className={S("asset__toolbar", "asset__title")}>{asset.label || asset.key}</h2>
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
              highlightTag={hoverTag}
            />
        }
      </div>
      <div className={S("asset__toolbar")}>
        <button
          onClick={() => DownloadFromUrl(assetStore.AssetLink(asset.key), asset.key, {target: "_blank"})}
          className={S("asset__download")}
        >
          <Icon icon={DownloadIcon}/>
          <div>
            Download Asset
          </div>
        </button>
      </div>
    </div>
  );
});

const AssetDetails = observer(({asset, setHoverTag}) => {
  return (
    <div className={S("asset-details")}>
      <AssetTags asset={asset} setHoverTag={setHoverTag}/>
    </div>
  );
});

const SelectedAsset = observer(() => {
  const {assetKey} = useParams();
  const [hoverTag, setHoverTag] = useState(undefined);

  const asset = assetStore.Asset(assetKey);

  if(!assetKey || !asset) {
    return (
      <div className={S("empty")}>
        Select an asset from the list to view details
      </div>
    );
  }

  return (
    <div className="subcontent">
      <PanelView
        isSubpanel
        mainPanelContent={
          <AssetContent asset={asset} hoverTag={hoverTag} />
        }
        bottomPanelContent={
          <AssetDetails asset={asset} setHoverTag={setHoverTag} />
        }
      />
    </div>
  );
});

const Assets = observer(() => {
  const {assetKey} = useParams();

  return (
    <PanelView
      sidePanelContent={<AssetSidePanel/>}
      mainPanelContent={<SelectedAsset key={assetKey}/>}
    />
  );
});

export default Assets;
