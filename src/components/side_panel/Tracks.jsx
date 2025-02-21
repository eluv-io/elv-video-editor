import SidePanelStyles from "@/assets/stylesheets/modules/side-panel.module.scss";

import React, {useEffect} from "react";
import {observer} from "mobx-react";
import {tagStore, trackStore} from "@/stores/index.js";
import {FormColorInput, FormTextArea, FormTextInput, IconButton} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";

import EditIcon from "@/assets/icons/Edit.svg";
import BackIcon from "@/assets/icons/v2/back.svg";
import XIcon from "@/assets/icons/X.svg";
import {FocusTrap, Text} from "@mantine/core";
import TrashIcon from "@/assets/icons/trash.svg";
import {modals} from "@mantine/modals";

const S = CreateModuleClassMatcher(SidePanelStyles);

const TrackActions = observer(({track}) => {
  return (
    <div key={`track-actions--${tagStore.editing}`} className={S("tag-details__actions")}>
      <div className={S("tag-details__left-actions")}>
        <IconButton
          label={
            tagStore.editing ?
              "Save changes and return to category details" :
              "Return to tag list"
          }
          icon={BackIcon}
          onClick={() =>
            tagStore.editing ?
              tagStore.ClearEditing() :
              tagStore.ClearSelectedTrack()
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

                track.trackType === "primary-content" ? null :
                  <>
                    <IconButton
                      label="Edit Category"
                      icon={EditIcon}
                      onClick={() => tagStore.SetEditing(track.trackId, "track")}
                    />
                    <IconButton
                      label="Remove Category"
                      icon={TrashIcon}
                      onClick={() =>
                        modals.openConfirmModal({
                          title: "Remove Category",
                          centered: true,
                          children: <Text fz="sm">Are you sure you want to remove this category?</Text>,
                          labels: { confirm: "Remove", cancel: "Cancel" },
                          onConfirm: () => {
                            tagStore.DeleteTrack({trackId: track.trackId});
                            tagStore.ClearSelectedTrack();
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

const TrackForm = observer(() => {
  const track = tagStore.editedItem;

  return (
    <form
      key={`form-${track.tagId}`}
      onSubmit={event => event.preventDefault()}
      className={S("tag-details", "form")}
    >
      <TrackActions track={track}/>

      <FocusTrap active>
      <div className={S("form__inputs")}>
          <div className={S("form__input-container")}>
            <FormTextInput
              label="Label"
              data-autofocus
              value={track.label || ""}
              onChange={event => tagStore.UpdateEditedItem({...track, label: event.target.value})}
              className={S("form__input")}
            />
          </div>
          <div className={S("form__input-container")}>
            <FormTextInput
              label="Metadata Key"
              disabled
              value={track.key || ""}
              onChange={event => tagStore.UpdateEditedItem({...track, key: event.target.value})}
              className={S("form__input")}
            />
          </div>
          <div className={S("form__input-container")}>
            <FormColorInput
              label="Color"
              value={track.color}
              onChange={rgb => tagStore.UpdateEditedItem({...track, color: {...rgb, a: track.color.a}})}
              className={S("form__input")}
            />
          </div>
          <div className={S("form__input-container")}>
            <FormTextArea
              label="Description"
              value={track.description || ""}
              onChange={event => tagStore.UpdateEditedItem({...track, description: event.target.value})}
              className={S("form__input")}
            />
          </div>
        </div>
      </FocusTrap>
    </form>
  );
});

export const TrackDetails = observer(() => {
  const track = tagStore.selectedTrack;

  useEffect(() => {
    if(!track) {
      tagStore.ClearSelectedTrack();
    }
  }, [track]);

  if(!track) {
    return null;
  }

  return (
    <>
      <div key={`tag-details-${track.trackId}`} className={S("tag-details", "tag-details--track")}>
        <TrackActions track={track}/>
        <div className={S("tag-details__detail")}>
          <label>Category:</label>
          <span>{track.label || track.key}</span>
        </div>
        <div className={S("tag-details__detail")}>
          <label>Metadata Key:</label>
          <span className={S("ellipsis")}>{track.key}</span>
        </div>
        {
          !track.description ? null :
            <div className={S("tag-details__detail")}>
              <label>Description:</label>
              <span>{track.description || ""}</span>
            </div>
        }
        <div className={S("tag-details__detail")}>
          <label>Tags:</label>
          <span>{Object.keys(trackStore.TrackTags(track.trackId) || {}).length}</span>
        </div>
      </div>
      {
        !tagStore.editing ? null :
          <div className={S("side-panel-modal")}>
            <TrackForm/>
          </div>
      }
    </>
  );
});
