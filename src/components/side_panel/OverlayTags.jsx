import SidePanelStyles from "@/assets/stylesheets/modules/side-panel.module.scss";

import React, {useEffect} from "react";
import {observer} from "mobx-react-lite";
import {tagStore, trackStore, videoStore} from "@/stores/index.js";
import {FocusTrap, Text, Tooltip} from "@mantine/core";
import {
  FormNumberInput,
  FormSelect,
  FormTextArea,
  IconButton,
} from "@/components/common/Common.jsx";
import {Capitalize, CreateModuleClassMatcher, FormatConfidence, Round} from "@/utils/Utils.js";
import {modals} from "@mantine/modals";

import EditIcon from "@/assets/icons/Edit.svg";
import BackIcon from "@/assets/icons/v2/back.svg";
import XIcon from "@/assets/icons/X.svg";
import TrashIcon from "@/assets/icons/trash.svg";
import {BoxToPolygon, BoxToRectangle} from "@/utils/Geometry.js";

const S = CreateModuleClassMatcher(SidePanelStyles);

const OverlayTagActions = observer(({tag, track}) => {
  return (
    <div className={S("tag-details__actions")}>
      <div className={S("tag-details__left-actions")}>
        <IconButton
          label={
            tagStore.editing ?
              "Save changes and return to tag details" :
              "Return to tag list"
          }
          icon={BackIcon}
          onClick={() =>
            tagStore.editing ?
              tagStore.ClearEditing() :
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
              label="Discard Changes"
              icon={XIcon}
              onClick={() => tagStore.ClearEditing(false)}
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
                onClick={() =>
                  modals.openConfirmModal({
                    title: "Remove Tag",
                    centered: true,
                    children: <Text fz="sm">Are you sure you want to remove this overlay tag?</Text>,
                    labels: { confirm: "Remove", cancel: "Cancel" },
                    onConfirm: () => {
                      tagStore.DeleteOverlayTag({trackId: track.trackId, frame: tag.frame, tag});
                      tagStore.ClearSelectedOverlayTag();
                    }
                  })
                }
              />
            </>
        }
      </div>
    </div>
  );
});

const OverlayTagForm = observer(() => {
  const tag = tagStore.editedOverlayTag;
  const track = trackStore.Track(tag.trackId);

  return (
    <form
      key={`form-${tag.tagId}`}
      onSubmit={event => event.preventDefault()}
      className={S("tag-details", "form")}
    >
      <OverlayTagActions tag={tag} track={track} />
      <FocusTrap active>
        <div className={S("form__inputs")}>
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
          <div className={S("form__input-container")}>
            <FormNumberInput
              label="Confidence"
              value={Round((tag.confidence || 1) * 100, 0)}
              onChange={value => tagStore.UpdateEditedOverlayTag({...tag, confidence: Round(value / 100, 4)})}
            />
          </div>
          <div className={S("form__input-container")}>
            <FormSelect
              label="Draw Mode"
              value={Capitalize(tag.mode || "rectangle")}
              options={["Rectangle", "Polygon"]}
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
    </form>
  );
});

export const OverlayTagDetails = observer(() => {
  const tag = tagStore.editedOverlayTag || tagStore.selectedOverlayTag;
  const track = trackStore.Track(tag?.trackId);

  useEffect(() => {
    if(!tag || !track) {
      tagStore.ClearEditing();
      tagStore.ClearSelectedOverlayTag();
    }
  }, [tag, track]);

  if(!tag || !track) {
    return null;
  }

  return (
    <>
      <div key={`tag-details-${tag.tagId}-${!!tagStore.editedOverlayTag}`} className={S("tag-details")}>
        <OverlayTagActions tag={tag} track={track}/>
        <pre className={S("tag-details__content", tag.content ? "tag-details__content--json" : "")}>
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
      {
        !tagStore.editing ? null :
          <div className={S("side-panel-modal")}>
            <OverlayTagForm/>
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
