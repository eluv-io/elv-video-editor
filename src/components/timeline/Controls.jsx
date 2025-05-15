import TimelineStyles from "@/assets/stylesheets/modules/timeline.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {aiStore, compositionStore, editStore, videoStore} from "@/stores/index.js";
import {AsyncButton, Confirm, FormTextArea, IconButton, Modal} from "@/components/common/Common.jsx";
import PreviewThumbnail from "@/components/common/PreviewThumbnail.jsx";
import {Button, Checkbox} from "@mantine/core";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";

import ClipIcon from "@/assets/icons/v2/clip.svg";
import LiveToVodIcon from "@/assets/icons/v2/live-to-vod.svg";
import AggregateIcon from "@/assets/icons/v2/settings.svg";

const S = CreateModuleClassMatcher(TimelineStyles);

export const ClipModalButton = observer(() => {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName("");
    setSubmitting(false);
  }, [showModal]);

  const Submit = async () => {
    if(!name) { return; }

    setSubmitting(true);

    compositionStore.AddMyClip({
      clip: {
        name,
        libraryId: videoStore.videoObject.libraryId,
        objectId: videoStore.videoObject.objectId,
        versionHash: videoStore.videoObject.versionHash,
        offering: videoStore.offeringKey,
        clipInFrame: videoStore.clipInFrame || 0,
        clipOutFrame: videoStore.clipOutFrame || videoStore.totalFrames - 1
      }
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    setShowModal(false);
  };

  return (
    <>
      {
        !showModal ? null :
          <Modal
            title={<div className={S("form__title")}>Save to My Clips</div>}
            opened
            centered
            onClose={() => setShowModal(false)}
          >
            <div className={S("form", "clip-form")}>
              <PreviewThumbnail
                store={videoStore}
                startFrame={videoStore.clipInFrame}
                endFrame={videoStore.clipOutFrame}
                className={S("clip-form__preview")}
              />
              <div className={S("form__inputs")}>
                <div className={S("clip-form__title")}>
                  { videoStore.name }
                </div>
                <div className={S("clip-form__details")}>
                  <span>
                    {videoStore.FrameToSMPTE(videoStore.clipInFrame)}
                  </span>
                  <span>-</span>
                  <span>
                    {videoStore.FrameToSMPTE(videoStore.clipOutFrame)}
                  </span>
                  <span>
                    ({videoStore.videoHandler.FrameToString({frame: videoStore.clipOutFrame - videoStore.clipInFrame})})
                  </span>
                </div>
                <FormTextArea
                  autoFocus
                  label="Clip Description"
                  autosize
                  value={name}
                  onChange={event => setName(event.target.value)}
                  onKeyPress={event => {
                    if(event.key === "Enter") {
                      Submit();
                    }
                  }}
                />
                <div className={S("form__actions")}>
                  <Button
                    w={150}
                    color="gray.5"
                    onClick={() => setShowModal(false)}
                    variant="subtle"
                  >
                    Cancel
                  </Button>
                  <Button
                    w={150}
                    loading={submitting}
                    autoContrast
                    color="gray.5"
                    disabled={!name}
                    onClick={Submit}
                  >
                    Submit
                  </Button>
                </div>
              </div>
            </div>
          </Modal>
      }
      <IconButton
        icon={ClipIcon}
        disabled={!videoStore.clipInFrame && videoStore.clipOutFrame >= videoStore.totalFrames - 1}
        label="Save Clip"
        onClick={() => setShowModal(true)}
      />
    </>
  );
});

export const LiveToVodButton = observer(() => {
  if(!videoStore.videoObject?.objectId) { return null; }

  const progress = editStore.liveToVodProgress[videoStore.videoObject?.objectId];

  return (
    <IconButton
      icon={LiveToVodIcon}
      label="Update VoD from Live Stream"
      onClick={async () => {
        if(editStore.HasUnsavedChanges("tags") || editStore.HasUnsavedChanges("clips")) {
          let cancelled = false;
          await Confirm({
            title: "Regenerate Live to VoD",
            text: "Warning: You have unsaved changes. If you proceed in regenerating this VoD your changes will be lost",
            onConfirm: () => {
              editStore.ResetPage("tags");
              editStore.ResetPage("clips");
            },
            onCancel: () => cancelled = true
          });

          if(cancelled) {
            return;
          }
        }

        await Confirm({
          title: "Regenerate Live to VoD",
          text: "Are you sure you want to update this VoD from the live stream? This may take several minutes and will cause the content to reload when finished.",
          onConfirm: async () => {
            await editStore.RegenerateLiveToVOD({vodObjectId: videoStore.videoObject?.objectId});
          }
        });
      }}
      loadingProgress={progress}
    />
  );
});

const AggregateModal = observer(({indexes, setIndexes, Update, Close}) => {
  return (
    <Modal
      withCloseButton={false}
      title={<div className={S("form__title")}>Aggregate User Tags</div>}
      opened
      centered
      onClose={Close}
    >
      <div className={S("form__message")}>
        This will aggregate your user defined tags and update the specified search indexes so this content will be
        searchable based on your tags.
      </div>
      <div className={S("form__message")}>
        Note: Any unsaved changes will be saved before aggregation.
      </div>
      <div className={S("form__inputs")}>
        <div className={S("form__section-header")}>
          Search Indexes:
        </div>
        {
          aiStore.searchIndexes.map(index =>
            <Checkbox
              mb="sm"
              ml="sm"
              key={`index-${index.id}`}
              checked={indexes.includes(index.id)}
              label={index.name}
              onChange={() =>
                indexes.includes(index.id) ?
                  setIndexes(indexes.filter(i => i !== index.id)) :
                  setIndexes([...indexes, index.id])
              }
            />
          )
        }
      </div>
      <div className={S("form__actions")}>
        <Button
          variant="subtle"
          color="gray.5"
          onClick={Close}
        >
          Cancel
        </Button>
        <AsyncButton
          onClick={() => {
            Update(indexes);
            Close();
          }}
        >
          Confirm
        </AsyncButton>
      </div>
    </Modal>
  );
});

export const AggregateTagsButton = observer(() => {
  const [showModal, setShowModal] = useState(false);
  const [indexes, setIndexes] = useState([]);
  const [updating, setUpdating] = useState(false);

  let progress;
  if(updating) {
    progress = (
      aiStore.tagAggregationProgress +
      indexes.reduce((acc, indexId) => acc + (aiStore.searchIndexUpdateProgress[indexId] || 0), 0)
    ) / (indexes.length + 1);
  }

  return (
    <>
      <IconButton
        icon={AggregateIcon}
        label="Aggregate User Tags"
        onClick={() => setShowModal(true)}
        loadingProgress={Math.min(95, progress)}
      />
      {
        !showModal ? null :
          <AggregateModal
            indexes={indexes}
            setIndexes={setIndexes}
            Close={() => setShowModal(false)}
            Update={async indexIds => {
              setUpdating(true);

              try {
                if(editStore.HasUnsavedChanges("tags") || editStore.HasUnsavedChanges("clips")) {
                  await editStore.Save();
                }

                await aiStore.AggregateUserTags({objectId: videoStore.videoObject?.objectId});

                await Promise.all(
                  indexIds.map(async indexId =>
                    await aiStore.UpdateSearchIndex({
                      indexId,
                      aggregate: false
                    })
                  )
                );
              } catch(error) {
                // eslint-disable-next-line no-console
                console.error("Error aggregating or updating indexes: ");
                // eslint-disable-next-line no-console
                console.error(error);
              } finally {
                setUpdating(false);
              }
            }}
          />
      }
    </>
  );
});
