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
import {CreateModuleClassMatcher, ValidEmail} from "@/utils/Utils.js";
import {Button, FocusTrap, Text, TextInput} from "@mantine/core";
import DownloadForm, {DownloadPreview} from "@/components/download/DownloadForm.jsx";
import {videoStore} from "@/stores/index.js";
import {modals} from "@mantine/modals";

import ShareIcon from "@/assets/icons/v2/share.svg";
import BackIcon from "@/assets/icons/v2/back.svg";
import XIcon from "@/assets/icons/X.svg";
import EditIcon from "@/assets/icons/Edit.svg";

const S = CreateModuleClassMatcher(DownloadStyles);


const ShareEditForm = observer(({existingShare, setShowShareForm}) => {
  const [expiration, setExpiration] = useState(new Date(existingShare.end_time * 1000));

  const days = Math.ceil((expiration.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  let error;
  if(!expiration) {
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
          value={expiration}
          label="Expiration"
          onChange={value => setExpiration(value)}
        />
        <FormTextInput
          value={existingShare?.details?.share_options.email}
          label="Recipient's Email Address"
          autoComplete="off"
          disabled
        />
        <FormSelect
          label="Permissions"
          value={existingShare?.details?.share_options.permissions}
          disabled
          options={[
            { label: "Stream", value: "stream" },
            { label: "Download", value: "download" },
            { label: "Stream & Download", value: "both" },
          ]}
        />
        <FormTextArea
          value={existingShare?.details?.share_options?.note}
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
                expiration: expiration
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

const ShareCreateForm = observer(({options, setShowShareForm}) => {
  const [shareOptions, setShareOptions] = useState({
    email: "",
    permissions: "stream",
    expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    note: "",
    noClip: ""
  });

  const days = Math.ceil((shareOptions.expiration.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  let error;
  if(!ValidEmail(shareOptions.email)) {
    error = "You must enter a valid recipient email address";
  } else if(!shareOptions.expiration) {
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
        <FormTextInput
          data-autofocus
          autoFocus
          value={shareOptions.email}
          label="Recipient's Email Address"
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
          !(options.clipInFrame > 0 || options.clipOutFrame < videoStore.totalFrames - 1) ? null :
            <FormSelect
              label="Content"
              value={shareOptions.noClip}
              onChange={value => setShareOptions({...shareOptions, noClip: value})}
              options={[
                { label: "Selected Clip", value: "" },
                { label: "Full Video", value: "full" },
              ]}
        />
        }
        <FormDateTimeInput
          valueFormat={`MMMM D YYYY - hh:mm A z ${days > 0  ? `[(${days} day${days === 1 ? "" : "s"})]` : ""}`}
          value={shareOptions.expiration}
          label="Expiration"
          onChange={value => setShareOptions({...shareOptions, expiration: value})}
        />
        <FormTextArea
          value={shareOptions.note}
          label="Note"
          onChange={event => setShareOptions({...shareOptions, note: event.target.value})}
        />
        <div className={S("share-form__actions")}>
          <AsyncButton
            title={error}
            disabled={!!error}
            autoContrast
            color="gray.5"
            onClick={async () => {
              options = {...options};

              if(shareOptions.noClip || options.clipInFrame === 0) {
                delete options.clipInFrame;
              }

              if(shareOptions.noClip || options.clipOutFrame >= videoStore.totalFrames - 1) {
                delete options.clipOutFrame;
              }

              await videoStore.CreateShare({
                clipInFrame: options.clipInFrame,
                clipOutFrame: options.clipOutFrame,
                offering: options.offering,
                expiration: shareOptions.expiration,
                attributes: {
                  source: ["evie"],
                  details: [JSON.stringify({
                    video_options: options,
                    share_options: shareOptions
                  })]
                }
              });

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

const Shares = observer(({setSelectedShare, setEditingShare}) => {
  const [shares, setShares] = useState(undefined);
  const [key, setKey] = useState(0);

  useEffect(() => {
    videoStore.Shares()
      .then(s => setShares(s));
  }, [key]);

  if(!shares) {
    return (
      <div className={S("share__loader")}>
        <Loader />
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
          shares.filter(share => !share.revoked).map(share =>
            <div role="button" onClick={() => setSelectedShare(share)} key={share.share_id} className={S("recipient")}>
              <div className={S("recipient__info")}>
                <div className={S("recipient__email")}>
                  { share.details?.share_options?.email || share.share_id }
                </div>
                {
                  !share.clipInfo ? null :
                    <div className={S("recipient__clip-info")}>
                      {share.clipInfo}
                    </div>
                }
                <div className={S("recipient__expiration")}>
                  Access Expires {share.expiresAt.toLocaleString()}
                </div>
              </div>
              <div className={S("recipient__permissions")}>
                {
                  share.details?.share_options?.permissions === "both" ? "Stream & Download" :
                    share.details?.share_options?.permissions === "download" ? "Download" : "Stream"
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
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    modals.openConfirmModal({
                      title: "Revoke Access",
                      centered: true,
                      children: <Text fz="sm">Are you sure you want to revoke access to this content from {share.recipient || "this person"}?</Text>,
                      labels: { confirm: "Confirm", cancel: "Cancel" },
                      onConfirm: async () => {
                        await videoStore.RevokeShare({shareId: share.share_id});
                        await new Promise(resolve => setTimeout(resolve, 500));
                        setKey(key + 1);
                      }
                    });
                  }}
                />
              </div>
            </div>
          )
        }
      </div>
    </div>
  );
});

const ShareDetails = observer(({selectedShare, setSelectedShare}) => {
  const videoOptions = selectedShare.details?.video_options || {};
  const shareOptions = selectedShare.details?.share_options || {};

  const representations = videoStore.ResolutionOptions(selectedShare.offering);
  const audioRepresentations = videoStore.AudioOptions(selectedShare.offering);

  const resolutionLabel = representations?.find(rep => rep.key === videoOptions.representation)?.string;
  const audioTrackLabel = audioRepresentations?.find(rep => rep.key === videoOptions.audioRepresentation)?.label;

  const permissions = { both: "Stream & Download", stream: "Stream", download: "Download" };

  return (
    <div className={S("share")}>
      <DownloadPreview options={selectedShare.details?.video_options || {}}/>
      <div className={S("share-details")}>
        <div className={S("share-details__title")}>
          <IconButton icon={BackIcon} onClick={() => setSelectedShare(undefined)}/>
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
            <label>Expiration:</label>
            <span>{new Date(selectedShare.end_time * 1000).toLocaleString()}</span>
          </div>
          <div className={S("share-details__detail")}>
            <label>Permissions:</label>
            <span>{permissions[shareOptions.permissions] || "Stream"}</span>
          </div>
          <div className={S("share-details__detail")}>
            <label>Note:</label>
            <span>{shareOptions.note || ""}</span>
          </div>
        </div>

        <div className={S("share-details__subtitle")}>
          Content Details
        </div>
        <div className={S("share-details__details")}>
          <div className={S("share-details__detail")}>
            <label>Start Time:</label>
            <span className="monospace">{videoStore.FrameToSMPTE(selectedShare.clipInFrame)}</span>
          </div>
          <div className={S("share-details__detail")}>
            <label>End Time:</label>
            <span className="monospace">{videoStore.FrameToSMPTE(selectedShare.clipOutFrame)}</span>
          </div>
          <div className={S("share-details__detail")}>
            <label>Duration:</label>
            <span>{videoStore.videoHandler.FrameToString({frame: selectedShare.clipOutFrame - selectedShare.clipInFrame})}</span>
          </div>
          <div className={S("share-details__detail")}>
            <label>Offering:</label>
            <span>{selectedShare.offering === "default" ? "Default" : selectedShare.offering || "Default"}</span>
          </div>
          {
            !["download", "both"].includes(shareOptions.permissions) ? null :
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
                  <span>{videoOptions.format}</span>
                </div>
              </>
          }
        </div>
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
          placeholder="Recipient's Email Address"
          classNames={{input: S("shares-info__dummy-input")}}
        />
      </form>
      <Shares setSelectedShare={setSelectedShare} setEditingShare={setEditingShare}/>
    </div>
  );
});

const ShareModalContent = observer(({options, selectedShare, setSelectedShare, setOptionsConfirmed, Close}) => {
  const [showShareForm, setShowShareForm] = useState(false);

  return (
    <div className={S("share-container")}>
      {
        selectedShare ?
          <ShareDetails selectedShare={selectedShare} setSelectedShare={setSelectedShare}/> :
          <div className={S("share")}>
            <DownloadPreview options={options}/>
            {
              showShareForm ?
                <ShareCreateForm options={options} setShowShareForm={setShowShareForm}/> :
                <SharesInfo setSelectedShare={setSelectedShare} setShowShareForm={setShowShareForm}/>
            }
          </div>
      }
      <div className={S("download__actions")}>
        <Button
          variant="subtle"
          color="gray.5"
          onClick={() => {
            selectedShare ?
              setSelectedShare(undefined) :
              setOptionsConfirmed(false);
          }}
          className={S("download__action")}
        >
          Back
        </Button>
        <Button autoContrast color="gray.5" onClick={() => Close()} className={S("download__action")}>
          Done
        </Button>
      </div>
    </div>
  );
});

const ShareModal = observer(props => {
  const [optionsConfirmed, setOptionsConfirmed] = useState(undefined);
  const [options, setOptions] = useState(undefined);
  const [selectedShare, setSelectedShare] = useState(undefined);

  useEffect(() => {
    setOptionsConfirmed(false);
    setOptions(undefined);
  }, [videoStore.clipInFrame, videoStore.clipOutFrame]);

  return (
    <Modal
      size={1000}
      title={
        <div className={S("header")}>
          <Icon icon={ShareIcon}/>
          <div className={S("header__text")}>
            {
              selectedShare ?
                "Share Details" :
                `Share Clip${optionsConfirmed ? ` - ${options.filename}` : ""}`
            }
          </div>
        </div>
      }
      padding={30}
      {...props}
    >
      {
        !optionsConfirmed ?
          <DownloadForm
            initialOptions={options}
            buttonText="Continue"
            Submit={newOptions => {
              setOptions(newOptions);
              setOptionsConfirmed(true);
            }}
            Close={props.onClose}
          /> :
          <ShareModalContent
            options={options}
            setOptionsConfirmed={setOptionsConfirmed}
            selectedShare={selectedShare}
            setSelectedShare={setSelectedShare}
            Close={props.onClose}
          />
      }
    </Modal>
  );
});

const Share = observer(() => {
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

export default Share;
