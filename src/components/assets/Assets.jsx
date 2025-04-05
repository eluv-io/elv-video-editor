import AssetStyles from "@/assets/stylesheets/modules/assets.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {CreateModuleClassMatcher, DownloadFromUrl, JoinClassNames} from "@/utils/Utils.js";
import {assetStore, editStore, tagStore} from "@/stores/index.js";
import {AsyncButton, Confirm, Icon, IconButton, LoaderImage} from "@/components/common/Common.jsx";
import {Tooltip} from "@mantine/core";
import Overlay from "@/components/video/Overlay.jsx";
import {Panel, PanelGroup, PanelResizeHandle} from "react-resizable-panels";
import {useParams} from "wouter";

import DownloadIcon from "@/assets/icons/download.svg";
import UndoIcon from "@/assets/icons/v2/undo.svg";
import RedoIcon from "@/assets/icons/v2/redo.svg";
import AddTagIcon from "@/assets/icons/v2/add-new-item.svg";
import EditIcon from "@/assets/icons/Edit.svg";
import SaveIcon from "@/assets/icons/Save.svg";

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
                      <button
                        onClick={() =>
                          tag.tagId === assetStore.selectedTag?.tagId ?
                            assetStore.ClearSelectedTags() :
                            assetStore.SetSelectedTags([tag], true)
                        }
                        onMouseEnter={() => setHoverTag(tag)}
                        onMouseLeave={() => setHoverTag(undefined)}
                        className={S("asset-tag", tag.tagId === assetStore.selectedTag?.tagId ? "asset-tag--selected" : "")}
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
                      </button>
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

const SaveAssetButton = observer(({className=""}) =>
  <AsyncButton
    color="gray.5"
    variant="outline"
    autoContrast
    h={28}
    px="xs"
    w={100}
    disabled={!assetStore.hasUnsavedChanges}
    onClick={async () => await Confirm({
      title: "Save Assets",
      text: "Are you sure you want to save changes to these assets?",
      onConfirm: async () => await assetStore.SaveAssets()
    })}
    className={JoinClassNames(S("asset__save"), className)}
  >
    <Icon icon={SaveIcon}/>
    <span style={{marginLeft: 10}}>
      Save
    </span>
  </AsyncButton>
);

const AssetContent = observer(({asset, hoverTag}) => {
  const [imageElement, setImageElement] = useState(undefined);

  return (
    <div className={S("asset")}>
      <h2 className={S("asset__toolbar", "asset__title")}>
        <div>
          {asset.label || asset.key}
        </div>
        <SaveAssetButton />
      </h2>
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
        <IconButton
          icon={UndoIcon}
          label={`Undo ${editStore.nextUndoAction?.label || ""}`}
          disabled={!editStore.nextUndoAction}
          onClick={() => editStore.Undo()}
        />
        <IconButton
          icon={RedoIcon}
          label={`Redo ${editStore.nextRedoAction?.label || ""}`}
          disabled={!editStore.nextRedoAction}
          onClick={() => editStore.Redo()}
        />
        <div className={S("toolbar__separator")}/>
        <IconButton
          icon={AddTagIcon}
          label="Add New Tag"
          onClick={() => tagStore.AddAssetTag({asset})}
        />
        <div className={S("toolbar__spacer")}/>
        <IconButton
          icon={EditIcon}
          label="Edit Asset"
          onClick={() => {
            assetStore.ClearSelectedTags();
            tagStore.SetEditing({type: "asset", id: asset.assetId, item: asset});
          }}
        />
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

const AssetDetails = observer(({asset, summary, setHoverTag}) => {
  return (
    <div className={S("asset-details")}>
      <AssetTags
        asset={asset}
        setHoverTag={setHoverTag}
      />
      {
        !summary || summary.error ? null :
          <div className={S("asset-summary")}>
            <div className={S("asset-summary__header")}>Summary</div>
            {
              !summary.title ? null :
                <div className={S("asset-summary__title")}>
                  {summary.title}
                </div>
            }
            {
              !summary.summary ? null :
                <div className={S("asset-summary__summary")}>
                  {summary.summary}
                </div>
            }
            {
              !summary.hashtags ? null :
                <div className={S("asset-summary__hashtags")}>
                  {summary.hashtags.join(" ")}
                </div>
            }
          </div>
      }
    </div>
  );
});

const SelectedAsset = observer(({assetKey}) => {
  const {objectId} = useParams();
  const [hoverTag, setHoverTag] = useState(undefined);
  const [summary, setSummary] = useState(undefined);

  useEffect(() => {
    setSummary(undefined);

    assetStore.GenerateSummary({objectId, asset})
      .then(setSummary);
  }, [assetKey]);

  const asset = assetStore.Asset(assetKey);

  if(!assetKey || !asset) {
    return (
      <div className={S("empty")}>
        Select an asset from the list to view details
        <SaveAssetButton className={S("empty__save")} />
      </div>
    );
  }

  return (
    <PanelGroup direction="vertical" className="panel-group">
      <Panel id="asset-top" order={1} minSize={30}>
        <AssetContent asset={asset} summary={summary} hoverTag={hoverTag} />
      </Panel>
      <PanelResizeHandle />
      <Panel id="asset-bottom" order={2} minSize={30}>
        <AssetDetails asset={asset} summary={summary} setHoverTag={setHoverTag} />
      </Panel>
    </PanelGroup>
  );
});

export default SelectedAsset;
