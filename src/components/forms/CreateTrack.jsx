import {observer} from "mobx-react";
import React, {useEffect, useState} from "react";
import {
  FormColorInput,
  FormTextArea,
  FormTextInput,
  IconButton,
  Modal
} from "@/components/common/Common.jsx";
import {tagStore, trackStore} from "@/stores/index.js";
import {CreateModuleClassMatcher, Slugify} from "@/utils/Utils.js";

import TrackIcon from "@/assets/icons/v2/track.svg";
import {Button, Tooltip} from "@mantine/core";

const S = CreateModuleClassMatcher();

const CreateTrackForm = observer(({Close}) => {
  const trackType = rootStore.view === "tags" ? "metadata" : "clip";
  const [track, setTrack] = useState({
    label: "",
    description: "",
    key: "",
    defaultKey: "",
    color: trackStore.colors[Math.floor(Math.random() * trackStore.colors.length)]
  });

  useEffect(() => {
    setTrack({...track, defaultKey: Slugify(track.label)});
  }, [track.label]);

  let valid = true, error;
  if(!track.label) {
    valid = false;
    error = "Category label is required";
  } else if(
    trackStore.tracks.find(otherTrack =>
      otherTrack.trackType === trackType && otherTrack.key === track.key
    )
  ) {
    valid = false;
    error = `Category with metadata key '${track.key}' already exists`;
  }

  return (
    <form
      key={`form-${track.tagId}`}
      onSubmit={event => event.preventDefault()}
      className={S("form")}
    >
      <div className={S("form__inputs")}>
        <div className={S("form__input-container")}>
          <FormTextInput
            data-autofocus
            label="Label"
            value={track.label || ""}
            onChange={event => setTrack({...track, label: event.target.value})}
            className={S("form__input")}
          />
        </div>
        <div className={S("form__input-container")}>
          <FormTextInput
            label="Metadata Key"
            value={track.key || ""}
            placeholder={track.defaultKey || ""}
            onChange={event => setTrack({...track, key: event.target.value})}
            className={S("form__input")}
          />
        </div>
        <div className={S("form__input-container")}>
          <FormColorInput
            label="Color"
            value={track.color}
            onChange={rgb => setTrack({...track, color: {...rgb, a: track.color.a}})}
            className={S("form__input")}
          />
        </div>
        <div className={S("form__input-container")}>
          <FormTextArea
            label="Description"
            value={track.description || ""}
            onChange={event => setTrack({...track, description: event.target.value})}
            className={S("form__input")}
          />
        </div>
      </div>
      <div className={S("form__actions")}>
        <Button
          variant="subtle"
          color="gray.5"
          onClick={() => Close()}
          className={S("form__action", "form__action--cancel")}
        >
          Cancel
        </Button>
        <Tooltip
          disabled={valid}
          label={error}
        >
          <Button
            disabled={!valid}
            title={error}
            onClick={() => {
              tagStore.AddTrack({
                trackType,
                label: track.label,
                key: track.key || track.defaultKey,
                description: track.description,
                color: track.color
              });
              Close();
            }}
            className={S("form__action", "form__action--submit")}
          >
            Create
          </Button>
        </Tooltip>
      </div>
    </form>
  );
});

export const CreateTrackButton = observer(({...props}) => {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <IconButton
        icon={TrackIcon}
        label="Add Category"
        {...props}
        onClick={() => setShowForm(true)}
      />
      <Modal
        title="Create New Category"
        opened={showForm}
        centered
        onClose={() => setShowForm(false)}
      >
        <CreateTrackForm Close={() => setShowForm(false)} />
      </Modal>
    </>
  );
});
