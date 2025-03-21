import DownloadStyles from "@/assets/stylesheets/modules/download.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {
  AsyncButton,
  FormDateTimeInput,
  FormSelect, FormTextArea,
  FormTextInput,
  Icon,
  IconButton, Loader,
  Modal
} from "@/components/common/Common.jsx";
import {Copy, CreateModuleClassMatcher, ValidEmail} from "@/utils/Utils.js";
import {Button, FocusTrap, Text, TextInput} from "@mantine/core";
import {DownloadFormFields, DownloadPreview} from "@/components/download/DownloadForm.jsx";
import {videoStore} from "@/stores/index.js";
import {modals} from "@mantine/modals";

import ShareIcon from "@/assets/icons/v2/share.svg";
import BackIcon from "@/assets/icons/v2/back.svg";
import XIcon from "@/assets/icons/X.svg";
import EditIcon from "@/assets/icons/Edit.svg";
import LinkIcon from "@/assets/icons/v2/link.svg";
import DownloadIcon from "@/assets/icons/v2/download.svg";

const S = CreateModuleClassMatcher(DownloadStyles);

const ShareDownloadJobStatusChecker = observer(({share}) => {
  useEffect(() => {
    const jobId = share.downloadJobId;
    if(!jobId || !["download", "both"].includes(share.permissions)) {
      return;
    }

    const status = videoStore.shareDownloadJobStatus[jobId];

    if(["completed", "failed"].includes(status?.status)) {
      return;
    }

    const CheckStatus = async () => videoStore.ShareDownloadJobStatus({jobId, objectId: share.object_id});

    const statusInterval = setInterval(CheckStatus, 5000);

    CheckStatus();

    return () => clearInterval(statusInterval);


  }, [share.downloadJobId]);

  return null;
});

const ShareEditForm = observer(({existingShare, setShowShareForm}) => {
  const [expiresAt, setExpiresAt] = useState(new Date(existingShare.end_time));

  const days = Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  let error;
  if(!expiresAt) {
    error = "You must enter a valid expiration date";
  } else if(days < 0) {
    error = "Expiration date is in the past";
  }

  return (
    <form onSubmit={event => event.preventDefault()} className={S("share-form")}>
      <FocusTrap active>
        <div className={S("share-form__title")}>
          <IconButton icon={BackIcon} onClick={() => setShowShareForm(false)} />
          Update Share Access
        </div>
        <FormDateTimeInput
          valueFormat={`MMMM D YYYY - hh:mm A z ${days > 0  ? `[(${days} day${days === 1 ? "" : "s"})]` : ""}`}
          data-autofocus
          autoFocus
          value={expiresAt}
          label="Expiration"
          onChange={value => setExpiresAt(value)}
        />
        <FormTextInput
          value={existingShare.recipient}
          label="Recipient's Email Address"
          autoComplete="off"
          disabled
        />
        <FormSelect
          label="Permissions"
          value={existingShare.permissions}
          disabled
          options={[
            { label: "Stream", value: "stream" },
            { label: "Download", value: "download" },
            { label: "Stream & Download", value: "both" },
          ]}
        />
        <FormTextArea
          value={existingShare.shareOptions?.note}
          label="Note"
          disabled
        />
        <div className={S("share-form__actions")}>
          <AsyncButton
            title={error}
            disabled={!!error}
            autoContrast
            color="gray.5"
            onClick={async () => {
              await videoStore.UpdateShare({
                shareId: existingShare.share_id,
                expiresAt
              });

              setShowShareForm(false);
            }}
            className={S("download__action", "download__action--secondary")}
          >
            Update
          </AsyncButton>
        </div>
      </FocusTrap>
    </form>
  );
});

const ShareCreateForm = observer(({downloadOptions, setDownloadOptions, setShowShareForm}) => {
  const [shareOptions, setShareOptions] = useState({
    title: "",
    email: "",
    permissions: "stream",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    note: ""
  });

  const days = Math.ceil((shareOptions.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  const invalidEmail = shareOptions.email.split(",").find(email => !ValidEmail(email.trim()));

  let error;
  if(!shareOptions.email) {
    error = "You must enter a valid recipient email address";
  } else if(invalidEmail) {
    error = `Invalid email address: ${invalidEmail}`;
  } else if(!shareOptions.expiresAt) {
    error = "You must enter a valid expiration date";
  } else if(days < 0) {
    error = "Expiration date is in the past";
  }

  return (
    <form onSubmit={event => event.preventDefault()} className={S("share-form")}>
      <FocusTrap active>
        <div className={S("share-form__title")}>
          <IconButton icon={BackIcon} onClick={() => setShowShareForm(false)} />
          Share Access
        </div>
        <div className={S("share-form__fields")}>
          <FormTextInput
            data-autofocus
            autoFocus
            value={shareOptions.email}
            placeholder="Comma separated email addresses"
            label="Recipient Email Addresses"
            autoComplete="off"
            onChange={event => setShareOptions({...shareOptions, email: event.target.value})}
          />
          <FormSelect
            label="Permissions"
            value={shareOptions.permissions}
            onChange={value => setShareOptions({...shareOptions, permissions: value})}
            options={[
              { label: "Stream", value: "stream" },
              { label: "Download", value: "download" },
              { label: "Stream & Download", value: "both" },
            ]}
          />
          {
            !(downloadOptions.clipInFrame > 0 || downloadOptions.clipOutFrame < videoStore.totalFrames - 1) ? null :
              <FormSelect
                label="Content"
                value={downloadOptions.noClip || ""}
                onChange={value => setDownloadOptions({...downloadOptions, noClip: value})}
                options={[
                  { label: "Selected Clip", value: "" },
                  { label: "Full Video", value: "full" },
                ]}
          />
          }
          <FormDateTimeInput
            valueFormat={`MMMM D YYYY - hh:mm A z ${days > 0  ? `[(${days} day${days === 1 ? "" : "s"})]` : ""}`}
            value={shareOptions.expiresAt}
            label="Expiration"
            onChange={value => setShareOptions({...shareOptions, expiresAt: value})}
          />
          <FormTextInput
            value={shareOptions.title || ""}
            label="Title"
            autoComplete="off"
            onChange={event => setShareOptions({...shareOptions, title: event.target.value})}
          />
          <FormTextArea
            value={shareOptions.note}
            label="Note"
            onChange={event => setShareOptions({...shareOptions, note: event.target.value})}
          />
          {
            ["download", "both"].includes(shareOptions.permissions) ?
              <>
                <div className={S("share-form__subtitle")}>
                  Download Options
                </div>
                <DownloadFormFields
                  options={downloadOptions}
                  setOptions={setDownloadOptions}
                />
              </> :
              // Stream case only needs offering selected
              <FormSelect
                label="Offering"
                name="offering"
                value={downloadOptions.offering}
                onChange={value => setDownloadOptions({...options, offering: value || options.offering})}
                data={
                  Object.keys(videoStore.availableOfferings).map(offeringKey => ({
                    label: offeringKey === "default" ? "Default" : videoStore.availableOfferings[offeringKey].display_name || offeringKey,
                    value: offeringKey,
                  }))
                }
              />
          }
        </div>
        <div className={S("share-form__actions")}>
          <AsyncButton
            title={error}
            disabled={!!error}
            autoContrast
            color="gray.5"
            onClick={async () => {
              const options = {...downloadOptions};

              if(shareOptions.noClip || options.clipInFrame === 0) {
                delete options.clipInFrame;
              }

              if(shareOptions.noClip || options.clipOutFrame >= videoStore.totalFrames - 1) {
                delete options.clipOutFrame;
              }

              const emails = shareOptions.email.split(",").map(email => email.trim());

              for(const email of emails) {
                await videoStore.CreateShare({
                  shareOptions: {
                    ...shareOptions,
                    email
                  },
                  downloadOptions: options
                });
              }

              setShowShareForm(false);
            }}
            className={S("download__action", "download__action--secondary")}
          >
            Send
          </AsyncButton>
        </div>
      </FocusTrap>
    </form>
  );
});

const Share = observer(({share, setEditingShare, setSelectedShare, Reload}) => {
  const jobStatus = videoStore.shareDownloadJobStatus[share.downloadJobId];

  return (
    <div role="button" onClick={() => setSelectedShare(share)} key={share.share_id} className={S("recipient")}>
      {
        !share.downloadJobId ? null :
          <ShareDownloadJobStatusChecker share={share} />
      }
      <div className={S("recipient__info")}>
        <div className={S("recipient__email")}>
          {share.recipient || share.share_id}
        </div>
        {
          !share.clipDetails.isClipped ? null :
            <div className={S("recipient__clip-info")}>
              {share.clipDetails.string}
            </div>
        }
        <div className={S("recipient__expiration")}>
          Access Expires {share.expiresAt.toLocaleString()}
        </div>
      </div>
      <div className={S("recipient__status")}>
        <div className={S("recipient__permissions")}>
          {
            share.permissions === "both" ? "Stream & Download" :
              share.permissions === "download" ? "Download" : "Stream"
          }
        </div>
        {
          !jobStatus ? null :
            <div className={S("recipient__download-status")}>
              {
                !jobStatus ? "" :
                  jobStatus?.status === "completed" ? "Download Available" :
                    jobStatus?.status === "failed" ? "Download Generation Failed" :
                      `Download Generating - ${(100 * jobStatus.progress / 100).toFixed(0)}%`
              }
            </div>
        }
      </div>
      <div className={S("recipient__actions")}>
        <IconButton
          small
          icon={EditIcon}
          title="Change Access"
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            setEditingShare(share);
          }}
        />
        <IconButton
          small
          icon={XIcon}
          title="Revoke Access"
          onClick={async event => {
            event.preventDefault();
            event.stopPropagation();

            await new Promise(resolve =>
              modals.openConfirmModal({
                title: "Revoke Access",
                centered: true,
                children: <Text fz="sm">Are you sure you want to revoke access to this content
                  from {share.recipient || "this person"}?</Text>,
                labels: {confirm: "Confirm", cancel: "Cancel"},
                onConfirm: async () => {
                  await videoStore.RevokeShare({shareId: share.share_id});
                  Reload();
                  resolve();
                },
                onCancel: () => resolve()
              })
            );
          }}
        />
      </div>
    </div>
  );
});

const Shares = observer(({setSelectedShare, setEditingShare}) => {
  const [shares, setShares] = useState(undefined);
  const [key, setKey] = useState(0);

  useEffect(() => {
    setShares(undefined);

    videoStore.Shares()
      .then(s => setShares(s));
  }, [key]);

  if(!shares) {
    return (
      <div className={S("share__loader")}>
        <Loader/>
      </div>
    );
  }

  return (
    <div className={S("recipients")}>
      <div className={S("recipients__header")}>
        People with Access
      </div>
      <div className={S("recipients__list")}>
        {
          shares.length > 0 ? null :
            <div className={S("recipients__empty")}>
              This content is not yet shared with anyone
            </div>
        }
        {
          shares.filter(share => !share.revoked).map(share =>
            <Share
              key={`share-${share.share_id}`}
              share={share}
              setSelectedShare={setSelectedShare}
              setEditingShare={setEditingShare}
              Reload={() => setKey(key + 1)}
            />
          )
        }
      </div>
    </div>
  );
});

const SharesInfo = observer(({setShowShareForm, setSelectedShare}) => {
  const [editingShare, setEditingShare] = useState(undefined);

  if(editingShare) {
    return (
      <ShareEditForm
        existingShare={editingShare}
        setShowShareForm={() => setEditingShare(undefined)}
      />
    );
  }

  return (
    <div className={S("shares-info")}>
      <form autoComplete="off" onSubmit={event => event.preventDefault()}>
        <TextInput
          autoComplete="off"
          onClick={() => setShowShareForm(true)}
          placeholder="Add New Recipients"
          classNames={{input: S("shares-info__dummy-input")}}
        />
      </form>
      <Shares setSelectedShare={setSelectedShare} setEditingShare={setEditingShare} />
    </div>
  );
});

// Shares list + share form
const ShareModalContent = observer(({downloadOptions, setDownloadOptions, setSelectedShare, Close}) => {
  const [showShareForm, setShowShareForm] = useState(false);

  return (
    <div className={S("share-container")}>
      <div className={S("share")}>
        <DownloadPreview options={downloadOptions}/>
        {
          showShareForm ?
            <ShareCreateForm
              downloadOptions={downloadOptions}
              setDownloadOptions={setDownloadOptions}
              setShowShareForm={setShowShareForm}
            /> :
            <SharesInfo
              setSelectedShare={setSelectedShare}
              setShowShareForm={setShowShareForm}
            />
        }
      </div>
      <div className={S("download__actions")}>
        <Button autoContrast color="gray.5" onClick={() => Close()} className={S("download__action")}>
          Done
        </Button>
      </div>
    </div>
  );
});


// Detailed info about specific share
const ShareDetails = observer(({selectedShare, Back, Close}) => {
  const representations = videoStore.ResolutionOptions(selectedShare.offering);
  const audioRepresentations = videoStore.AudioOptions(selectedShare.offering);

  const resolutionLabel = representations?.find(rep => rep.key === selectedShare.downloadOptions?.representation)?.string;
  const audioTrackLabel = audioRepresentations?.find(rep => rep.key === selectedShare.downloadOptions?.audioRepresentation)?.label;

  const permissions = { both: "Stream & Download", stream: "Stream", download: "Download" };

  const jobStatus = videoStore.shareDownloadJobStatus[selectedShare.downloadJobId];

  return (
    <div className={S("share-container")}>
      {
        !selectedShare.downloadJobId ? null :
          <ShareDownloadJobStatusChecker share={selectedShare} />
      }
      <div className={S("share")}>
        <DownloadPreview options={selectedShare.downloadOptions || {}}/>
        <div className={S("share-details")}>
          <div className={S("share-details__title")}>
            <IconButton icon={BackIcon} onClick={Back}/>
            View Share Details
          </div>

          <div className={S("share-details__subtitle")}>
            Share Details
          </div>
          <div className={S("share-details__details")}>
            <div className={S("share-details__detail")}>
              <label>Recipient:</label>
              <span>{selectedShare.recipient}</span>
            </div>
            <div className={S("share-details__detail")}>
              <label>Created:</label>
              <span>{new Date(selectedShare.updated).toLocaleString()}</span>
            </div>
            <div className={S("share-details__detail")}>
              <label>Expires At:</label>
              <span>{new Date(selectedShare.end_time).toLocaleString()}</span>
            </div>
            <div className={S("share-details__detail")}>
              <label>Permissions:</label>
              <span>{permissions[selectedShare.permissions] || "Stream"}</span>
            </div>
            <div className={S("share-details__detail")}>
              <label>Note:</label>
              <span>{selectedShare.shareOptions?.note || ""}</span>
            </div>
          </div>

          <div className={S("share-details__subtitle")}>
            Content Details
          </div>
          <div className={S("share-details__details")}>
            {
              !jobStatus ? null :
                <div className={S("share-details__detail")}>
                  <label>Download Status:</label>
                  <span>
                    {
                      !jobStatus ? "" :
                        jobStatus?.status === "completed" ? "Available" :
                          jobStatus?.status === "failed" ? "Download Generation Failed" :
                            `Generating - ${(100 * jobStatus.progress / 100).toFixed(0)}%`
                    }
                  </span>
                </div>
            }

            <div className={S("share-details__detail")}>
              <label>Start Time:</label>
              <span className="monospace">{videoStore.FrameToSMPTE(selectedShare.clipDetails.clipInFrame || 0)}</span>
            </div>
            <div className={S("share-details__detail")}>
              <label>End Time:</label>
              <span
                className="monospace">{videoStore.FrameToSMPTE(selectedShare.clipDetails.clipOutFrame || videoStore.totalFrames - 1)}</span>
            </div>
            <div className={S("share-details__detail")}>
              <label>Duration:</label>
              <span>{selectedShare.clipDetails.durationString}</span>
            </div>
            <div className={S("share-details__detail")}>
              <label>Offering:</label>
              <span>{selectedShare.offering === "default" ? "Default" : selectedShare.offering || "Default"}</span>
            </div>
            {
              !["download", "both"].includes(selectedShare.permissions) ? null :
                <>
                  {
                    !resolutionLabel ? null :
                      <div className={S("share-details__detail")}>
                        <label>Resolution:</label>
                        <span>{resolutionLabel}</span>
                      </div>
                  }
                  {
                    !audioTrackLabel ? null :
                      <div className={S("share-details__detail")}>
                        <label>Audio:</label>
                        <span>{audioTrackLabel}</span>
                      </div>
                  }
                  <div className={S("share-details__detail")}>
                    <label>Format:</label>
                    <span>{selectedShare.downloadOptions?.format}</span>
                  </div>
                </>
            }
          </div>
          <div className={S("share-details__links")}>
            {
              !["stream", "both"].includes(selectedShare.permissions) ? null :
                <button onClick={() => Copy(selectedShare.embedUrl)} className={S("share-details__copy")}>
                  <Icon icon={LinkIcon} />
                  Copy Streaming URL
                </button>
            }
            {
              !["download", "both"].includes(selectedShare.permissions) ? null :
                <button onClick={() => Copy(selectedShare.downloadUrl)} className={S("share-details__copy")}>
                  <Icon icon={DownloadIcon} />
                  Copy Download URL
                </button>
            }
          </div>
        </div>
      </div>
      <div className={S("download__actions")}>
      <Button
          variant="subtle"
          color="gray.5"
          onClick={Back}
          className={S("download__action")}
        >
          Back
        </Button>
        <Button autoContrast color="gray.5" onClick={Close} className={S("download__action")}>
          Done
        </Button>
      </div>
    </div>
  );
});

const ShareModal = observer(props => {
  const [selectedShare, setSelectedShare] = useState(undefined);
  const [downloadOptions, setDownloadOptions] = useState(undefined);

  useEffect(() => {
    setDownloadOptions({
      objectId: videoStore.videoObject?.objectId,
      format: "mp4",
      title: videoStore.name,
      filename: "",
      defaultFilename: "",
      representation: "",
      audioRepresentation: "",
      offering: videoStore.offeringKey,
      clipInFrame: videoStore.clipInFrame,
      clipOutFrame: videoStore.clipOutFrame
    });
  }, [videoStore.clipInFrame, videoStore.clipOutFrame]);

  if(!downloadOptions) {
    return null;
  }

  return (
    <Modal
      size={1000}
      title={
        <div className={S("header")}>
          <Icon icon={ShareIcon}/>
          <div className={S("header__text")}>
            { selectedShare ? "Share Details" : "Share Clip" }
          </div>
        </div>
      }
      padding={30}
      {...props}
    >
      {
        selectedShare ?
          <ShareDetails
            selectedShare={selectedShare}
            Back={() => setSelectedShare(undefined)}
            Close={props.onClose}
          /> :
          <ShareModalContent
            downloadOptions={downloadOptions}
            setDownloadOptions={setDownloadOptions}
            selectedShare={selectedShare}
            setSelectedShare={setSelectedShare}
            Close={props.onClose}
          />
      }
    </Modal>
  );
});

const ShareModalButton = observer(() => {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if(showModal) {
      videoStore.PlayPause(true);
    }
  }, [showModal]);

  return (
    <>
      <IconButton
        icon={ShareIcon}
        label="Share Current Clip"
        onClick={() => setShowModal(true)}
      />
      <ShareModal
        opened={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
});

export default ShareModalButton;
