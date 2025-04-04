import SidePanelStyles from "@/assets/stylesheets/modules/side-panel.module.scss";

import {observer} from "mobx-react-lite";
import {
  Confirm,
  FormNumberInput,
  FormSelect,
  FormTextArea, FormTextInput, Icon,
  IconButton,
  Linkish,
  LoaderImage
} from "@/components/common/Common.jsx";
import UrlJoin from "url-join";
import {assetStore, rootStore, tagStore, videoStore} from "@/stores/index.js";
import React, {useEffect, useState} from "react";
import {useParams} from "wouter";
import InfiniteScroll from "@/components/common/InfiniteScroll.jsx";
import {CreateModuleClassMatcher, FormatConfidence, Round} from "@/utils/Utils.js";
import {FocusTrap, Tooltip} from "@mantine/core";
import {BoxToPolygon, BoxToRectangle} from "@/utils/Geometry.js";
import {FileBrowserButton} from "@/components/common/FileBrowser.jsx";

import CheckmarkIcon from "@/assets/icons/check-circle.svg";
import EditIcon from "@/assets/icons/Edit.svg";
import BackIcon from "@/assets/icons/v2/back.svg";
import XIcon from "@/assets/icons/X.svg";
import TrashIcon from "@/assets/icons/trash.svg";
import PlusIcon from "@/assets/icons/plus-square.svg";

const S = CreateModuleClassMatcher(SidePanelStyles);

const AssetTagActions = observer(({tag, track}) => {
  return (
    <div className={S("tag-details__actions")}>
      <div className={S("tag-details__left-actions")}>
        <IconButton
          label={
            tagStore.editing ?
              "Save changes and return to tag details" :
              "Return to tag list"
          }
          icon={tagStore.editing ? CheckmarkIcon : BackIcon}
          onClick={() =>
            tagStore.editing ?
              tagStore.ClearEditing() :
              assetStore.ClearSelectedTag()
          }
        />
      </div>
      <div className={S("tag-details__track")}>
        <div
          style={{backgroundColor: `rgb(${track.color.r} ${track.color.g} ${track.color.b}`}}
          className={S("tag-details__track-color")}
        />
        <div className={S("tag-details__track-label")}>{track.label}</div>
      </div>
      <div className={S("tag-details__right-actions")}>
        {
          tagStore.editing ?
            <IconButton
              label="Discard Changes"
              icon={XIcon}
              onClick={() => tagStore.ClearEditing(false)}
            /> :
            <>
              <IconButton
                label="Edit Tag"
                icon={EditIcon}
                onClick={() => tagStore.SetEditing({id: tag.tagId, item: tag, type: "assetTag"})}
              />
              <IconButton
                label="Remove Tag"
                icon={TrashIcon}
                onClick={async () => await Confirm({
                  title: "Remove Tag",
                  text: "Are you sure you want to remove this tag?",
                  onConfirm: () => {
                    tagStore.DeleteAssetTag(tag);
                    tagStore.ClearSelectedOverlayTag();
                  }
                })}
              />
            </>
        }
      </div>
    </div>
  );
});


const AssetTagForm = observer(() => {
  const tag = tagStore.editedAssetTag;
  const track = assetStore.AssetTrack(tag.trackKey);

  return (
    <form
      key={`form-${tag.tagId}`}
      onSubmit={event => event.preventDefault()}
      className={S("tag-details", "form")}
    >
      <AssetTagActions tag={tag} track={track} />
      <div className={S("tag-details__content")}>
        <FocusTrap active>
          <div className={S("form__inputs")}>
            {
              !tag.isNew ? null :
                <div className={S("form__input-container")}>
                  <FormSelect
                    label="Category"
                    value={tag.trackKey.toString()}
                    options={
                      assetStore.tracks
                        .map(track => ({
                          label: track.label,
                          value: track.key
                        }))
                    }
                    onChange={trackKey =>
                      tagStore.UpdateEditedAssetTag({
                        ...tag,
                        trackKey
                      })}
                    className={S("form__input")}
                  />
                </div>
            }
            <div className={S("form__input-container")}>
              <FormTextArea
                label="Text"
                value={tag.text}
                placeholder="Text"
                onChange={event => tagStore.UpdateEditedAssetTag({...tag, text: event.target.value})}
              />
            </div>
            <div className={S("form__input-container")}>
              <FormNumberInput
                label="Confidence"
                value={Round((tag.confidence || 1) * 100, 3)}
                onChange={value => tagStore.UpdateEditedAssetTag({...tag, confidence: Round(value / 100, 3)})}
              />
            </div>
            <div className={S("form__input-container")}>
              <FormSelect
                label="Draw Mode"
                disabled={false}
                value={tag.mode || "rectangle"}
                options={[
                  {label: "Rectangle", value: "rectangle"},
                  {label: "Polygon", value: "polygon"},
                ]}
                onChange={mode => {
                  if(mode === "Rectangle") {
                    tagStore.UpdateEditedAssetTag({...tag, mode: "rectangle", box: BoxToRectangle(tag.box)});
                  } else {
                    tagStore.UpdateEditedAssetTag({...tag, mode: "polygon", box: BoxToPolygon(tag.box)});
                  }
                }}
                className={S("form__input")}
              />
            </div>
          </div>
        </FocusTrap>
      </div>
    </form>
  );
});

export const AssetTagDetails = observer(() => {
  const tag = assetStore.selectedTag;
  const track = assetStore.AssetTrack(tag?.trackKey);

  useEffect(() => {
    if(!tag || !track) {
      tagStore.ClearEditing();
      assetStore.ClearSelectedTag();
    }
  }, [tag, track]);

  if(!tag || !track) {
    return null;
  }

  return (
    <>
      <div key={`tag-details-${tag.tagId}-${!!tagStore.editedOverlayTag}`} className={S("tag-details")}>
        <AssetTagActions tag={tag} track={track}/>
        <div className={S("tag-details__content")}>
          <pre className={S("tag-details__text", tag.content ? "tag-details__text--json" : "")}>
            {tag.text}
          </pre>
          <div className={S("tag-details__detail")}>
            <label>Category:</label>
            <span>{track.label || track.trackKey}</span>
          </div>
          <div className={S("tag-details__detail")}>
            <label>Confidence:</label>
            <span>{FormatConfidence(tag.confidence)}</span>
          </div>
        </div>
      </div>
      {
        !tagStore.editedAssetTag ? null :
          <div className={S("side-panel-modal")}>
            <AssetTagForm />
          </div>
      }
    </>
  );
});

const AssetTag = observer(({tag}) => {
  const track = assetStore.AssetTrack(tag.trackKey);

  if(!track) { return null; }

  return (
    <button
      onClick={() => assetStore.SetSelectedTag(tag)}
      className={S("tag")}
    >
      <div
        style={{backgroundColor: `rgb(${track.color?.r} ${track.color?.g} ${track.color?.b}`}}
        className={S("tag__color")}
      />
      <div className={S("tag__left")}>
        <div className={S("tag__text")}>
          <Tooltip
            position="top"
            openDelay={500}
            offset={20}
            label={<div className={S("tag__tooltip")}>{tag.text}</div>}
          >
            <div className={S("tag__content")}>
              { tag.text }
            </div>
          </Tooltip>
          <div className={S("tag__track")}>
            {track.label}
          </div>
          <div className={S("tag__time")}>
            <label>Confidence:</label>
            <span>{FormatConfidence(tag.confidence)}</span>
          </div>
        </div>
      </div>
      <div className={S("tag__actions")}>
        <IconButton
          label="Edit Tag"
          icon={EditIcon}
          onClick={event => {
            event.stopPropagation();
            tagStore.SetTags(track.trackId, tag.tagId, tag.startTime);
            tagStore.SetEditing({id: tag.tagId, type: "assetTag", item: tag});
          }}
          className={S("tag__action")}
        />
      </div>
    </button>
  );
});

export const AssetTagsList = observer(() => {
  const tags = assetStore.selectedTags;

  return (
    <div className={S("selected-list")}>
      <div className={S("selected-list__actions")}>
        <IconButton
          label="Return to all assets"
          icon={BackIcon}
          onClick={() => assetStore.ClearSelectedTags()}
        />
      </div>
      <div className={S("count")}>
        {tags.length} tag{tags.length === 1 ? "" : "s"} selected
      </div>
      <div className={S("tags")}>
        {tags.map(tag => <AssetTag key={`tag-${tag.tagId}`} tag={tag}/>)}
      </div>
    </div>
  );
});

const AssetFormActions = observer(({asset}) => {
  const existingAsset = assetStore.Asset(asset.key);

  let error;
  if(!asset.key) {
    error = "Asset key is required";
  } else if(!asset.file) {
    error = "Asset file is required";
  } else if(existingAsset && existingAsset.assetId !== asset.assetId) {
    error = "An asset with this key already exists";
  }

  return (
    <div className={S("tag-details__actions")}>
      <div className={S("tag-details__left-actions")}>
        <IconButton
          disabled={!!error}
          label={error || "Save changes and return to assets"}
          icon={CheckmarkIcon}
          onClick={() => {
            tagStore.ClearEditing();

            rootStore.Navigate(
              UrlJoin(
                window.location.pathname.split("/assets")[0],
                "assets",
                rootStore.client.utils.B64(asset.key)
              )
            );
            rootStore.SetExpandedPanel();
          }}
        />
      </div>
      <div className={S("tag-details__track")}>
        { asset.key || "<Asset>" }
      </div>
      <div className={S("tag-details__right-actions")}>
        <IconButton
          label="Discard Changes"
          icon={XIcon}
          onClick={() => tagStore.ClearEditing(false)}
        />
        {
          asset.isNew ? null :
            <IconButton
              label="Remove Asset"
              icon={TrashIcon}
              onClick={async () => await Confirm({
                title: "Remove Asset",
                text: "Are you sure you want to remove this asset?",
                onConfirm: () => tagStore.DeleteAsset(asset)
              })}
            />
        }
      </div>
    </div>
  );
});

const AssetForm = observer(() => {
  const asset = tagStore.editedAsset;

  useEffect(() => {
    if(asset.key || !asset.file || !asset.file?.["/"]) { return; }

    tagStore.UpdateEditedAsset({
      ...asset,
      key: asset.file["/"].split("/").slice(-1)[0] || ""
    });
  }, [asset.file]);

  return (
    <form
      key={`form-${asset.assetId}`}
      onSubmit={event => event.preventDefault()}
      className={S("tag-details", "form")}
    >
      <AssetFormActions asset={asset} />
      <div className={S("tag-details__content")}>
        <FocusTrap active>
          <div className={S("form__inputs")}>
            <div className={S("form__input-container")}>
              <FormTextInput
                disabled={!asset.isNew}
                label="Key"
                value={asset.key}
                placeholder="Key"
                onChange={event => tagStore.UpdateEditedAsset({...asset, key: event.target.value})}
              />
            </div>
            <div className={S("form__input-container")}>
              <FormTextInput
                disabled
                label="Asset File"
                value={asset.file?.["/"]?.split("./files")[1] || ""}
              />
            </div>
            <div className={S("form__input-container")}>
              <FileBrowserButton
                fileBrowserProps={{
                  objectId: videoStore.videoObject.objectId,
                  extensions: "image",
                  title: "Select an Asset",
                  Submit: ({fullPath}) => {
                    tagStore.UpdateEditedAsset({
                      ...asset,
                      file: {
                        "/": UrlJoin("./files", fullPath)
                      }
                    });
                  }
                }}
              >
                Select Asset File
              </FileBrowserButton>
            </div>
            <div style={{marginTop: 20}} className={S("form__input-container")}>
              <LoaderImage
                src={assetStore.AssetLink("edited")}
                width={300}
              />
            </div>
          </div>
        </FocusTrap>
      </div>
    </form>
  );
});

const Asset = observer(({asset, selected}) => {
  return (
    <Linkish
      to={UrlJoin("/assets", rootStore.client.utils.B64(asset.key))}
      onClick={() => rootStore.SetExpandedPanel(undefined)}
      className={S("asset", selected ? "asset--selected" : "")}
    >
      <LoaderImage
        lazy={true}
        loaderDelay={0}
        loaderAspectRatio={1}
        showWithoutSource
        src={assetStore.AssetLink(asset.key, {width: 400})}
        className={S("asset__image")}
      />
      <div className={S("asset__name")}>
        { asset.key }
      </div>
    </Linkish>
  );
});

const AssetsList = observer(() => {
  const [assets, setAssets] = useState([]);
  const [limit, setLimit] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);

  const { assetKey } = useParams();

  return (
    <>
      <div className={S("count")}>
        {
          totalAssets === 0 ?
            "No assets found" :
            `Showing 1 - ${limit} of ${totalAssets}`
        }
      </div>
      <InfiniteScroll
        watchList={[
          assetStore.filter,
          assetStore.assets.length,
          tagStore.editedAsset,
          tagStore.editing,
          Object.keys(assetStore.activeTracks).length
        ]}
        batchSize={60}
        className={S("assets")}
        Update={limit => {
          const assets = assetStore.filteredAssetList
            .sort((a, b) => a.key < b.key ? -1 : 1);
          setAssets(assets.slice(0, limit));
          setTotalAssets(assets.length);
          setLimit(Math.min(assets.length, limit));
        }}
      >
        <Tooltip openDelay={500} label="Add New Asset">
          <button onClick={() => tagStore.AddAsset()} className={S("add-asset")}>
            <Icon icon={PlusIcon} className={S("add-asset__icon")} />
          </button>
        </Tooltip>
        {
          assets.map(asset =>
            <Asset
              selected={
                asset.key === assetKey ||
                (assetKey && asset.key === rootStore.client.utils.FromB64(assetKey))
              }
              asset={asset}
              key={asset.key}
            />
          )
        }
      </InfiniteScroll>

      {
        !tagStore.editedAsset ? null :
          <div className={S("side-panel-modal")}>
            <AssetForm />
          </div>
      }
    </>
  );
});

export default AssetsList;
