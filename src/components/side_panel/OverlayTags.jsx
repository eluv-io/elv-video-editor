import SidePanelStyles from "@/assets/stylesheets/modules/side-panel.module.scss";

import React, {useEffect, useState} from "react";
import {observer} from "mobx-react-lite";
import {groundTruthStore, rootStore, tagStore, trackStore, videoStore} from "@/stores/index.js";
import {FocusTrap, Tooltip} from "@mantine/core";
import {
  Confirm,
  FormNumberInput,
  FormSelect,
  FormTextArea,
  FormTextInput,
  IconButton,
  Loader,
  StyledButton
} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher, FormatConfidence, Round} from "@/utils/Utils.js";
import {BoxToPolygon, BoxToRectangle} from "@/utils/Geometry.js";

import EditIcon from "@/assets/icons/Edit.svg";
import BackIcon from "@/assets/icons/v2/back.svg";
import XIcon from "@/assets/icons/X.svg";
import TrashIcon from "@/assets/icons/trash.svg";
import CheckmarkIcon from "@/assets/icons/check-circle.svg";
import GroundTruthIcon from "@/assets/icons/v2/ground-truth.svg";
import {EntitySelect} from "@/components/ground_truth/GroundTruthForms.jsx";

const S = CreateModuleClassMatcher(SidePanelStyles);

let lookupTimeout;
export const GroundTruthAssetFromOverlayForm = observer(() => {
  const [image, setImage] = useState(undefined);
  //const [checkLoading, setCheckLoading] = useState(false);
  const [entityLoading, setEntityLoading] = useState(false);
  const asset = tagStore.editedGroundTruthAsset;
  const pool = groundTruthStore.pools[asset.poolId];

  const Update = key => event => tagStore.UpdateEditedGroundTruthAsset({
    ...tagStore.editedGroundTruthAsset,
    [key]: event?.target?.value || event?.value || event
  });

  useEffect(() => {
    groundTruthStore.LoadGroundTruthPools();
  }, []);

  useEffect(() => {
    tagStore.UpdateEditedGroundTruthAsset({
      ...asset,
      entityId: ""
    });

    if(!asset.poolId) {
      return;
    }

    groundTruthStore.LoadGroundTruthPool({poolId: asset.poolId});
  }, [tagStore.editedGroundTruthAsset.poolId]);

  useEffect(() => {
    videoStore.GetFrame({bounds: asset.box, maxWidth: 500, maxHeight: 500})
      .then(async blob =>
        setImage({
          filename: `${videoStore.videoObject.objectId}-${videoStore.smpte.replaceAll(":", "_")}.jpg`,
          blob,
          url: window.URL.createObjectURL(blob)
        })
      );
  }, [asset.box, asset.frame]);

  useEffect(() => {
    if(
      tagStore.editedGroundTruthAsset?.entityId ||
      !tagStore.editedGroundTruthAsset?.poolId ||
      !image?.blob
    ) {
      return;
    }

    clearTimeout(lookupTimeout);

    lookupTimeout = setTimeout(async () => {
      try {
        setEntityLoading(true);

        await groundTruthStore.LookupImage({
          poolId: tagStore.editedGroundTruthAsset.poolId,
          imageBlob: image.blob,
          key: "overlayForm",
          force: true
        });

        const entityId = groundTruthStore.imageEntityCheckStatus["overlayForm"]?.matched_entity?.[0];

        Update("entityId")(tagStore.editedGroundTruthAsset?.entityId || entityId);
      } catch(error) {
        console.error(error);
      }

      setEntityLoading(false);
    }, 1000);
  }, [tagStore.editedGroundTruthAsset.poolId, image?.url]);

  useEffect(() => {
    Update("image")(image);
  }, [image]);

  return (
    <div className={S("tag-details", "form")}>
      <div className={S("tag-details__actions")}>
        <div className={S("tag-details__left-actions")}>
          <IconButton
            label="Discard Changes"
            icon={XIcon}
            onClick={() => tagStore.ClearEditing(false)}
          />
        </div>
        <div className={S("tag-details__track")}>
          <div className={S("tag-details__track-label")}>
            Add New Ground Truth Asset
          </div>
        </div>
        <div className={S("tag-details__right-actions")}>
          <IconButton
            label="Save Ground Truth Asset"
            icon={CheckmarkIcon}
            disabled={!asset.poolId || !asset.entityId || !asset.image}
            highlight
            onClick={() => tagStore.ClearEditing()}
          />
        </div>
      </div>
      <div className={S("tag-details__content")}>
        <div className={S("form__inputs")}>
          {
            !image?.url ? null :
              <img alt="Asset Preview Image" src={image?.url} className={S("form__image")}/>
          }
          <div className={S("form__input-container")}>
            <FormSelect
              label="Ground Truth Pool"
              value={asset.poolId}
              onChange={Update("poolId")}
              options={
                Object.keys(groundTruthStore.pools).map(poolId =>
                  ({label: groundTruthStore.pools[poolId].name, value: poolId})
                )}
            />
          </div>
          {
            !asset.poolId ? null :
              !pool?.metadata ? <Loader className={S("form__loader")} /> :
                <>
                  <EntitySelect
                    loading={entityLoading}
                    key={`entity-select-${asset.poolId}`}
                    poolId={asset.poolId}
                    entityId={asset.entityId}
                    setEntityId={Update("entityId")}
                  />
                  <div className={S("form__input-container")}>
                    <FormTextInput
                      label="Label"
                      value={asset.label}
                      placeholder={image?.filename}
                      onChange={Update("label")}
                    />
                  </div>
                  <div className={S("form__input-container")}>
                    <FormTextArea
                      label="Description"
                      value={asset.description}
                      onChange={Update("description")}
                    />
                  </div>
                </>
          }
        </div>
      </div>
    </div>
  );
});

const OverlayTagActions = observer(({tag, track}) => {
  return (
    <div className={S("tag-details__actions")}>
      <div className={S("tag-details__left-actions")}>
        <IconButton
          label={
            tagStore.editing ?
              "Discard Changes" :
              "Return to tag list"
          }
          icon={tagStore.editing ? XIcon : BackIcon}
          onClick={() =>
            tagStore.editing ?
              tagStore.ClearEditing(false) :
              tagStore.ClearSelectedOverlayTag()
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
              label="Save changes and return to tag details"
              icon={CheckmarkIcon}
              highlight
              onClick={() => tagStore.ClearEditing()}
            /> :
            <>
              <IconButton
                label="Edit Tag"
                icon={EditIcon}
                onClick={() => tagStore.SetEditing({id: tag.tagId, frame: tag.frame, type: "overlay"})}
              />
              <IconButton
                label="Remove Tag"
                icon={TrashIcon}
                onClick={async () => await Confirm({
                  title: "Remove Tag",
                  text: "Are you sure you want to remove this overlay tag?",
                  onConfirm: () => {
                    tagStore.DeleteOverlayTag({trackId: track.trackId, frame: tag.frame, tag});
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

const OverlayTagForm = observer(() => {
  const [image, setImage] = useState(undefined);
  const tag = tagStore.editedOverlayTag;
  const track = trackStore.Track(tag.trackId);

  useEffect(() => {
    setTimeout(() => {
      videoStore.GetFrame({bounds: tag.box, maxWidth: 500, maxHeight: 500})
        .then(blob => setImage({
          filename: `${videoStore.videoObject.objectId}-${videoStore.smpte.replaceAll(":", "_")}.jpg`,
          blob,
          url: window.URL.createObjectURL(blob)
        }));
    }, 1);
  }, [tag.box, tag.frame]);

  return (
    <form
      key={`form-${tag.tagId}`}
      onSubmit={event => event.preventDefault()}
      className={S("tag-details", "form")}
    >
      <OverlayTagActions tag={tag} track={track} />
      <div className={S("tag-details__content")}>
        <FocusTrap active>
          <div className={S("form__inputs")}>
            {
              !image ? null :
                <img alt="Image" src={image?.url} className={S("form__image")}/>
            }
            {
              !tag.isNew ? null :
                <div className={S("form__input-container")}>
                  <FormSelect
                    label="Category"
                    value={tag.trackId.toString()}
                    options={
                      trackStore.viewTracks
                        .filter(track => track.key !== "shot_detection")
                        .map(track => ({
                            label: track.label,
                            value: track.trackId.toString()
                          })
                        )
                    }
                    onChange={trackId =>
                      tagStore.UpdateEditedOverlayTag({
                        ...tag,
                        trackId: parseInt(trackId),
                        trackKey: trackStore.Track(parseInt(trackId))?.key
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
                onChange={event => tagStore.UpdateEditedOverlayTag({...tag, text: event.target.value})}
              />
            </div>
            {
              rootStore.page !== "tags" ? null :
                <div className={S("form__input-container")}>
                  <FormNumberInput
                    label="Confidence"
                    value={Round((tag.confidence || 1) * 100, 0)}
                    onChange={value => tagStore.UpdateEditedOverlayTag({...tag, confidence: Round(value / 100, 4)})}
                  />
                </div>
            }
            <div className={S("form__input-container")}>
              <FormSelect
                label="Draw Mode"
                value={tag.mode || "rectangle"}
                options={[
                  {label: "Rectangle", value: "rectangle"},
                  {label: "Polygon", value: "polygon"},
                ]}
                onChange={mode => {
                  if(mode === "Rectangle") {
                    tagStore.UpdateEditedOverlayTag({...tag, mode: "rectangle", box: BoxToRectangle(tag.box)});
                  } else {
                    tagStore.UpdateEditedOverlayTag({...tag, mode: "polygon", box: BoxToPolygon(tag.box)});
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

export const OverlayTagDetails = observer(() => {
  const tag = tagStore.editedOverlayTag || tagStore.selectedOverlayTag;
  const track = trackStore.Track(tag?.trackId);
  const [image, setImage] = useState({});
  const [showGroundTruthModal, setShowGroundTruthModal] = useState(false);

  useEffect(() => {
    if(!tag || !track) {
      tagStore.ClearEditing();
      tagStore.ClearSelectedOverlayTag();
    }

    if(tagStore.editing || !tag) { return; }

    videoStore.GetFrame({bounds: tag.box, maxWidth: 500, maxHeight: 500})
      .then(blob => setImage({
        filename: `${videoStore.videoObject.objectId}-${videoStore.smpte.replaceAll(":", "_")}.jpg`,
        blob,
        url: window.URL.createObjectURL(blob)
      }));
  }, [tag, track]);

  if(!tag || !track) {
    return null;
  }

  return (
    <>
      <div key={`tag-details-${tag.tagId}-${!!tagStore.editedOverlayTag}`} className={S("tag-details")}>
        <OverlayTagActions tag={tag} track={track}/>
        <div className={S("tag-details__content")}>
          <div className={S("form__inputs")}>
            <img alt="Image" src={image?.url} className={S("form__image")}/>
          </div>
          <pre className={S("tag-details__text", tag.content ? "tag-details__text--json" : "")}>
            {tag.text}
          </pre>
          {
            rootStore.page !== "tags" ? null :
              <div className={S("tag-details__detail")}>
                <label>Confidence:</label>
                <span>{FormatConfidence(tag.confidence)}</span>
              </div>
          }
          <StyledButton
            small
            style={{marginTop: 30}}
            icon={GroundTruthIcon}
            onClick={() => tagStore.AddGroundTruthAsset({label: tag.text, box: tag.box})}
          >
            Add to Ground Truth Pool
          </StyledButton>
        </div>
      </div>
      {
        !tagStore.editing || !tagStore.editedOverlayTag ? null :
          <div className={S("side-panel-modal")}>
            <OverlayTagForm/>
          </div>
      }
      {
        !showGroundTruthModal ? null :
          <div className={S("side-panel-modal")}>
            <GroundTruthAssetFromOverlayForm
              image={image}
              Close={() => setShowGroundTruthModal(false)}
            />
          </div>
      }
    </>
  );
});

const OverlayTag = observer(({track, tag}) => {
  if(!track || !tag) {
    return null;
  }

  const color = track.color;

  return (
    <button
      onClick={() => tagStore.SetSelectedOverlayTag(tag.frame, tag.tagId)}
      className={S("tag")}
    >
      <div
        style={{backgroundColor: `rgb(${color?.r} ${color?.g} ${color?.b}`}}
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
            <div className={S("tag__content", "tag__content--text")}>
              {tag.text}
            </div>
          </Tooltip>
          <div className={S("tag__track")}>
            {track.label}
          </div>
          <div className={S("tag__time")}>
            {
              !tag.confidence ? "100% Confidence" :
                `${FormatConfidence(tag.confidence)} Confidence`
            }
          </div>
        </div>
      </div>
      <div className={S("tag__actions")}>
        <IconButton
          label="Edit Tag"
          icon={EditIcon}
          onClick={event => {
            event.stopPropagation();
            tagStore.SetSelectedOverlayTag(tag.frame, tag.tagId);
            tagStore.SetEditing({id: tag.tagId, frame: tag.frame, type: "overlay"});
          }}
          className={S("tag__action")}
        />
      </div>
    </button>
  );
});

export const OverlayTagsList = observer(() => {
  const tags = tagStore.selectedOverlayTags;

  useEffect(() => {
    if(Math.abs(parseInt(videoStore.frame) - parseInt(tags[0]?.frame)) > 10) {
      tagStore.ClearEditing(false);
      tagStore.ClearSelectedOverlayTag();
      tagStore.ClearSelectedOverlayTags();
      tagStore.ClearTags();
    }
  }, [videoStore.frame]);

  return (
    <div className={S("selected-list")}>
      <div className={S("selected-list__actions")}>
        <IconButton
          label="Return to all tags"
          icon={BackIcon}
          onClick={() => tagStore.ClearSelectedOverlayTags()}
        />
      </div>
      <div className={S("count")}>
        {tags.length} overlay tag{tags.length === 1 ? "" : "s"} selected
      </div>
      <div className={S("tags")}>
        {
          tags.map(tag =>
            <OverlayTag
              key={`tag-${tag.tagId}`}
              track={trackStore.Track(tag.trackId)}
              tag={tag}
            />
          )
        }
      </div>
    </div>
  );
});
