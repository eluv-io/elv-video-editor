import TimelineStyles from "@/assets/stylesheets/modules/timeline.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {aiStore, compositionStore, editStore, videoStore} from "@/stores/index.js";
import {
  AsyncButton,
  ClipTimeInfo,
  Confirm,
  FormTextArea,
  Icon,
  IconButton,
  Modal
} from "@/components/common/Common.jsx";
import PreviewThumbnail from "@/components/common/PreviewThumbnail.jsx";
import {Button, Checkbox, Tooltip} from "@mantine/core";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {DownloadModal} from "@/components/download/Download.jsx";
import {ShareModal} from "@/components/download/Share.jsx";

import ClipIcon from "@/assets/icons/v2/clip.svg";
import LiveToVodIcon from "@/assets/icons/v2/live-to-vod.svg";
import AggregateIcon from "@/assets/icons/v2/settings.svg";
import DeleteIcon from "@/assets/icons/trash.svg";
import DownloadIcon from "@/assets/icons/v2/download.svg";
import ShareIcon from "@/assets/icons/v2/share.svg";


const S = CreateModuleClassMatcher(TimelineStyles);

const MyClipsModal = observer(({opened, highlightedClipId, Close}) => {
  const [showDownload, setShowDownload] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [submodalOpened, setSubmodalOpened] = useState(false);

  useEffect(() => {
    if(!opened) {
      setShowDownload(false);
      setShowShare(false);
      setSubmodalOpened(false);
    }
  }, [opened]);

  useEffect(() => {
    if(showDownload || showShare) {
      setTimeout(() => setSubmodalOpened(true), 100);
    } else {
      setSubmodalOpened(false);
    }
  }, [showDownload, showShare]);

  const Seek = clip => {
    videoStore.SetClipMark({
      inFrame: clip.clipInFrame || 0,
      outFrame: clip.clipOutFrame || videoStore.totalFrames - 1
    });

    videoStore.Seek(clip.clipInFrame);
  };

  return (
    <>
      <Modal
        title={<div className={S("my-clips-modal__title")}><Icon icon={ClipIcon} /><span>My Clips</span></div>}
        opened={opened}
        centered
        onClose={Close}
        size={850}
      >
        <div className={S("my-clips-modal")}>
          {
            compositionStore.myClips.length === 0 ?
              <div className={S("my-clips-modal__empty")}>
                No saved clips for this content
              </div> :
              <div className={S("my-clips-modal__content")}>
                {
                  compositionStore.myClips.map(clip =>
                    <div
                      key={`my-clip-${clip.clipId}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        Seek(clip);
                        Close();
                      }}
                      className={S("my-clips-modal__item", clip.clipId === highlightedClipId ? "my-clips-modal__item--highlighted" : "")}
                    >
                      <PreviewThumbnail
                        store={videoStore}
                        startFrame={clip.clipInFrame}
                        endFrame={clip.clipOutFrame}
                        className={S("my-clips-modal__item-thumbnail")}
                      />
                      <div className={S("my-clips-modal__item-text")}>
                        <Tooltip label={clip.name} openDelay={500}>
                          <div className={S("my-clips-modal__item-title", "ellipsis")}>
                            { clip.name }
                          </div>
                        </Tooltip>
                        <ClipTimeInfo
                          store={videoStore}
                          clipInFrame={clip.clipInFrame}
                          clipOutFrame={clip.clipOutFrame}
                          className={S("my-clips-modal__item-duration")}
                        />
                      </div>
                      <div className={S("my-clips-modal__item-actions")}>
                        <IconButton
                          icon={DownloadIcon}
                          onClick={async event => {
                            event.stopPropagation();
                            event.preventDefault();
                            Seek(clip);
                            setShowDownload(true);
                          }}
                        />
                        <IconButton
                          icon={ShareIcon}
                          onClick={async event => {
                            event.stopPropagation();
                            event.preventDefault();
                            Seek(clip);
                            setShowShare(true);
                          }}
                        />
                        <IconButton
                          icon={DeleteIcon}
                          onClick={async event => {
                            event.stopPropagation();
                            event.preventDefault();

                            await Confirm({
                              title: "Remove Clip",
                              text: "Are you sure you want to remove this clip?",
                              onConfirm: async () => {
                                await compositionStore.RemoveMyClip(clip.clipId);
                              }
                            });
                          }}
                        />
                      </div>
                    </div>
                  )
                }
              </div>
          }
        </div>
      </Modal>
      {
        !showDownload ? null :
          <DownloadModal
            store={videoStore}
            opened={submodalOpened}
            onClose={() => setShowDownload(false)}
          />
      }
      {
        !showShare ? null :
          <ShareModal
            store={videoStore}
            opened={submodalOpened}
            onClose={() => setShowShare(false)}
          />
      }
    </>
  );
});

export const MyClipsButton = observer(() => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowModal(true)} className={S("my-clips-button")}>
        <Icon icon={ClipIcon} />
        <span>My Clips</span>
      </button>
      <MyClipsModal
        opened={showModal}
        Close={() => setShowModal(false)}
      />
    </>
  );
});

export const ClipModalButton = observer(() => {
  const [showModal, setShowModal] = useState(false);
  const [showMyClipsModal, setShowMyClipsModal] = useState(false);
  const [highlightedClipId, setHighlightedClipId] = useState(undefined);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName("");
    setSubmitting(false);
  }, [showModal]);

  const Submit = async () => {
    if(!name) { return; }

    setSubmitting(true);

    const clip = await compositionStore.AddMyClip({
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
    setShowMyClipsModal(true);
    setHighlightedClipId(clip.clipId);
  };

  return (
    <>
      {
        !showMyClipsModal ? null :
          <MyClipsModal
            opened
            highlightedClipId={highlightedClipId}
            Close={() => setShowMyClipsModal(false)}
          />
      }
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
                <ClipTimeInfo
                  store={videoStore}
                  clipInFrame={videoStore.clipInFrame}
                  clipOutFrame={videoStore.clipOutFrame}
                  className={S("clip-form__details")}
                />
                <FormTextArea
                  autoFocus
                  label="Clip Description"
                  autosize
                  value={name}
                  onChange={event => setName(event.target.value)}
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
