import DownloadStyles from "@/assets/stylesheets/modules/download.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {
  AsyncButton,
  Confirm,
  CopyableField,
  FormDateTimeInput,
  FormSelect,
  FormTextArea,
  FormTextInput,
  Icon,
  IconButton,
  Loader,
  Modal
} from "@/components/common/Common.jsx";
import {Copy, CreateModuleClassMatcher, ValidEmail} from "@/utils/Utils.js";
import {Button, FocusTrap, Tabs} from "@mantine/core";
import {DownloadFormFields, DownloadPreview} from "@/components/download/DownloadForm.jsx";
import {rootStore, downloadStore, compositionStore} from "@/stores/index.js";

import ShareIcon from "@/assets/icons/v2/share.svg";
import BackIcon from "@/assets/icons/v2/back.svg";
import XIcon from "@/assets/icons/X.svg";
import EditIcon from "@/assets/icons/Edit.svg";
import LinkIcon from "@/assets/icons/v2/link.svg";
import DownloadIcon from "@/assets/icons/v2/download.svg";

import TwitterIcon from "@/assets/icons/v2/twitter.svg";
import FacebookIcon from "@/assets/icons/v2/facebook.svg";
import LinkedInIcon from "@/assets/icons/v2/linkedin.svg";

const S = CreateModuleClassMatcher(DownloadStyles);

const ShareDownloadJobStatusChecker = observer(({share}) => {
  useEffect(() => {
    const jobId = share.downloadJobId;
    if(!jobId || !["download", "both"].includes(share.permissions)) {
      return;
    }

    const status = downloadStore.shareDownloadJobStatus[jobId];

    if(["completed", "failed"].includes(status?.status)) {
      return;
    }

    const CheckStatus = async () => downloadStore.ShareDownloadJobStatus({jobId, objectId: share.object_id || share.object_ids?.[0]});

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
  } else if(expiresAt.getTime() - Date.now() < 0) {
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
        {
          existingShare.recipient ?
            <FormTextInput
              value={existingShare.recipient}
              label="Recipient's Email Address"
              autoComplete="off"
              disabled
            /> :
             <FormTextInput
              value={existingShare.label}
              label="Label"
              autoComplete="off"
              disabled
            />
        }
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
            tooltip={error}
            disabled={!!error}
            autoContrast
            color="gray.1"
            onClick={async () => {
              await downloadStore.UpdateShare({
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

const ShareCreateForm = observer(({
  store,
  mode="recipients",
  downloadOptions,
  setDownloadOptions,
  setShowShareForm,
  setSelectedShare
}) => {
  const isComposition = rootStore.page === "compositions";
  const [submitErrorMessage, setSubmitErrorMessage] = useState(undefined);
  const [shareOptions, setShareOptions] = useState({
    type: mode,
    title: store.name,
    email: "",
    label: "",
    permissions: "stream",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    note: ""
  });

  useEffect(() => {
    if(
      !["download", "both"].includes(shareOptions.permissions) ||
      store.downloadOfferingKeys.includes(downloadOptions.offering)
    ) {
      return;
    }

    setDownloadOptions({...downloadOptions, offering: store.downloadOfferingKeys[0]});
  }, [shareOptions.permissions]);

  const days = Math.ceil((shareOptions.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  const invalidEmail = shareOptions.email.split(",").find(email => !ValidEmail(email.trim()));

  let error;
  if(mode === "recipients" && !shareOptions.email) {
    error = "You must enter a valid recipient email address";
  } else if(mode === "recipients" && invalidEmail) {
    error = `Invalid email address: ${invalidEmail}`;
  } else if(mode === "manual" && !shareOptions.label) {
    error = "You must specify a label for this share";
  } else if(!shareOptions.expiresAt) {
    error = "You must enter a valid expiration date";
  } else if(days < 0) {
    error = "Expiration date is in the past";
  } else if(!shareOptions.title) {
    error = "Please specify a title for this content";
  }

  const downloadDisabled = !store.channel && store.downloadOfferingKeys.length === 0;

  return (
    <form onSubmit={event => event.preventDefault()} className={S("share-form")}>
      <FocusTrap active>
        <div className={S("share-form__title")}>
          <IconButton icon={BackIcon} onClick={() => setShowShareForm(false)} />
          { mode === "recipients" ? "Share with Recipients" : "Share Manually" }
        </div>
        <div className={S("share-form__fields")}>
          {
            mode === "recipients" ?
              <FormTextInput
                data-autofocus
                autoFocus
                value={shareOptions.email}
                placeholder="Comma separated email addresses"
                label="Recipient Email Addresses"
                autoComplete="off"
                onChange={event => setShareOptions({...shareOptions, email: event.target.value})}
              /> :
              <FormTextInput
                data-autofocus
                autoFocus
                value={shareOptions.label}
                label="Label"
                placeholder="Specify a Label"
                autoComplete="off"
                onChange={event => setShareOptions({...shareOptions, label: event.target.value})}
              />
          }
          <FormSelect
            label="Permissions"
            value={shareOptions.permissions}
            onChange={value => setShareOptions({...shareOptions, permissions: value})}
            options={[
              { label: "Stream", value: "stream" },
              { label: "Download", value: "download", disabled: downloadDisabled },
              { label: "Stream & Download", value: "both", disabled: downloadDisabled },
            ]}
          />
          {
            !(downloadOptions.clipInFrame > 0 || downloadOptions.clipOutFrame < store.totalFrames - 1) ? null :
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
            label={mode === "recipients" ? "Note" : "Description"}
            onChange={event => setShareOptions({...shareOptions, note: event.target.value})}
          />
          {
            ["download", "both"].includes(shareOptions.permissions) ?
              <>
                <div className={S("share-form__subtitle")}>
                  Download Options
                </div>
                <DownloadFormFields
                  store={store}
                  options={downloadOptions}
                  setOptions={setDownloadOptions}
                />
              </> :
              // Stream case only needs offering and audio selected
              <DownloadFormFields
                store={store}
                options={downloadOptions}
                setOptions={setDownloadOptions}
                allowAllOfferings
                fields={{
                  offering: !isComposition,
                  audioRepresentation: true
                }}
              />
          }
        </div>
        <div className={S("share-form__actions")}>
          {
            !submitErrorMessage ? null :
              <div className={S("share-form__error")}>
                { submitErrorMessage }
              </div>
          }
          <AsyncButton
            tooltip={error}
            disabled={!!error}
            autoContrast
            color="gray.1"
            onClick={async () => {
              try {
                const options = {...downloadOptions};

                if(shareOptions.noClip || options.clipInFrame === 0) {
                  delete options.clipInFrame;
                }

                if(shareOptions.noClip || options.clipOutFrame >= store.totalFrames - 1) {
                  delete options.clipOutFrame;
                }

                let submittedShareOptions = {
                  ...shareOptions,
                  compositionKey: !isComposition ? undefined :
                    compositionStore.compositionObject.compositionKey,
                };

                if(mode === "recipients") {
                  delete submittedShareOptions.label;

                  const emails = shareOptions.email.split(",").map(email => email.trim());

                  for(const email of emails) {
                    await downloadStore.CreateShare({
                      store,
                      shareOptions: {
                        ...submittedShareOptions,
                        email
                      },
                      downloadOptions: options
                    });
                  }
                } else {
                  delete submittedShareOptions.email;

                  setSelectedShare(
                    await downloadStore.CreateShare({
                      store,
                      shareOptions: submittedShareOptions,
                      downloadOptions: options
                    })
                  );
                }

                setShowShareForm(false);
              } catch(error) {
                if(error.status === 400 && error?.body?.error?.op?.includes("Could not get share signing address")) {
                  setSubmitErrorMessage("Your tenancy is not set up for sharing. Please contact support.");
                } else {
                  setSubmitErrorMessage("Unable to create share");
                }

              }
            }}
            className={S("download__action", "download__action--secondary")}
          >
            {
              mode === "recipients" ?
                "Send" : "Create"
            }
          </AsyncButton>
        </div>
      </FocusTrap>
    </form>
  );
});

const Share = observer(({store, share, setEditingShare, setSelectedShare, Reload}) => {
  const jobStatus = downloadStore.shareDownloadJobStatus[share.downloadJobId];

  const active = !(share.revoked || share.expired);
  return (
    <div role="button" onClick={() => setSelectedShare(share)} key={share.share_id} className={S("recipient")}>
      {
        !active || !share.downloadJobId ? null :
          <ShareDownloadJobStatusChecker share={share} />
      }
      <div className={S("recipient__info")}>
        <div className={S("recipient__email")}>
          {share.recipient || share.label || share.share_id}
        </div>
        {
          !share.clipDetails.isClipped ? null :
            <div className={S("recipient__clip-info")}>
              {
                store.showTimecodeOffset ?
                  share.clipDetails.offsetString :
                  share.clipDetails.string
              }
            </div>
        }
        <div className={S("recipient__expiration")}>
          {
            share.revoked ? "Access Revoked" :
              `Access Expire${share.expired ? "d" : "s"} ${share.expiresAt.toLocaleString()}`
          }
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
          !active || !jobStatus ? null :
            <div className={S("recipient__download-status")}>
              {
                !jobStatus ? "" :
                  jobStatus?.status === "completed" ? "Download Available" :
                    jobStatus?.status === "failed" ? "Download Generation Failed" :
                      `Generating - ${(100 * jobStatus.progress / 100).toFixed(0)}%`
              }
            </div>
        }
      </div>
      <div className={S("recipient__actions")}>
        {
          share.revoked ? null :
            <IconButton
              small
              icon={EditIcon}
              label="Change Access"
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                setEditingShare(share);
              }}
            />
        }
        {
          !active ? null :
            <IconButton
              small
              icon={XIcon}
              label="Revoke Access"
              onClick={async event => {
                event.preventDefault();
                event.stopPropagation();

                await Confirm({
                  title: "Revoke Access",
                  text: `Are you sure you want to revoke access to this content from ${share.recipient || "this share"}?`,
                  onConfirm: async () => {
                    await downloadStore.RevokeShare({shareId: share.share_id});
                      Reload();
                  }
                });
              }}
            />
        }
      </div>
    </div>
  );
});

const Shares = observer(({store, setSelectedShare, setEditingShare}) => {
  const [shares, setShares] = useState(undefined);
  const [tab, setTab] = useState("active");
  const [key, setKey] = useState(0);

  const isComposition = rootStore.page === "compositions";

  useEffect(() => {
    setShares(undefined);

    downloadStore.Shares({
      store,
      compositionKey: isComposition ?
          compositionStore.compositionObject?.compositionKey : "main"
    })
      .then(s => setShares(s));
  }, [key, compositionStore.compositionObject]);

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
      <Tabs value={tab} mb="sm" fz="sm" color="gray.5" onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="active">
            Active
          </Tabs.Tab>
          <Tabs.Tab value="expired">
            Expired/Revoked
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>
      <div className={S("recipients__list")}>
        {
          shares.length > 0 ? null :
            <div className={S("recipients__empty")}>
              This content is not yet shared with anyone
            </div>
        }
        {
          shares
            .filter(share =>
              tab === "active" ?
                !(share.revoked || share.expired) :
                share.revoked || share.expired
            )
            .map(share =>
              <Share
                key={`share-${share.share_id}`}
                store={store}
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

const SharesInfo = observer(({store, setShowShareForm, setSelectedShare}) => {
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
      <div className={S("shares-info__actions")}>
        <Button
          color="gray.1"
          w={200}
          autoContrast
          onClick={() => setShowShareForm("recipients")}
        >
          Share with Recipients
        </Button>
        <Button
          variant="outline"
          color="gray.1"
          onClick={() => setShowShareForm("manual")}
        >
          Share to Anyone
        </Button>
      </div>
      <Shares
        store={store}
        setSelectedShare={setSelectedShare}
        setEditingShare={setEditingShare}
      />
    </div>
  );
});

// Shares list + share form
const ShareModalContent = observer(({store, downloadOptions, setDownloadOptions, setSelectedShare, Close}) => {
  const [showShareForm, setShowShareForm] = useState(false);

  return (
    <div className={S("share-container")}>
      <div className={S("share")}>
        <DownloadPreview store={store} options={downloadOptions}/>
        {
          showShareForm ?
            <ShareCreateForm
              store={store}
              mode={showShareForm}
              downloadOptions={downloadOptions}
              setDownloadOptions={setDownloadOptions}
              setShowShareForm={setShowShareForm}
              setSelectedShare={setSelectedShare}
            /> :
            <SharesInfo
              store={store}
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

const ShareSocialLinks = observer(({share, embedUrl}) => {
  if(!embedUrl) { return null; }

  const twitterUrl = new URL("https://twitter.com/intent/tweet");
  twitterUrl.searchParams.set("url", embedUrl.toString());
  if(share.title) {
    twitterUrl.searchParams.set("text", share.title);
  }

  const facebookUrl = new URL("https://www.facebook.com/sharer.php");
  facebookUrl.searchParams.set("u", embedUrl.toString());

  const linkedInUrl = new URL("https://www.linkedin.com/sharing/share-offsite/");
  linkedInUrl.searchParams.set("url", embedUrl.toString());

  return (
    <div className={S("share-details__social-links")}>
      <IconButton
        icon={TwitterIcon}
        onClick={() => rootStore.OpenExternalLink(twitterUrl.toString())}
        className={S("share-details__social-link")}
      />
      <IconButton
        icon={FacebookIcon}
        onClick={() => rootStore.OpenExternalLink(facebookUrl.toString())}
        className={S("share-details__social-link")}
      />
      <IconButton
        icon={LinkedInIcon}
        onClick={() => rootStore.OpenExternalLink(linkedInUrl.toString())}
        className={S("share-details__social-link")}
      />
    </div>
  );
});

// Detailed info about specific share
const ShareDetails = observer(({store, selectedShare, Back, Close}) => {
  const [shortUrls, setShortUrls] = useState({});

  useEffect(() => {
    setShortUrls({});

    // Load short URLs
    Promise.all(
      [selectedShare?.embedUrl, selectedShare?.downloadUrl].map(async url =>
        url && await downloadStore.CreateShortUrl(url)
      )
    )
      .then(([embedUrl, downloadUrl]) => setShortUrls({embedUrl, downloadUrl}));
  }, [selectedShare?.embedUrl, selectedShare?.downloadUrl]);

  const representations = store.ResolutionOptions(selectedShare.offering);
  const audioRepresentations = store.AudioOptions(selectedShare.offering);

  const resolutionLabel = representations?.find(rep => rep.key === selectedShare.downloadOptions?.representation)?.string;
  const audioTrackLabel = audioRepresentations?.find(rep => rep.key === selectedShare.downloadOptions?.audioRepresentation)?.label;

  const permissions = { both: "Stream & Download", stream: "Stream", download: "Download" };

  const jobStatus = downloadStore.shareDownloadJobStatus[selectedShare.downloadJobId];

  const embedUrl = shortUrls.embedUrl || selectedShare?.embedUrl;
  const downloadUrl = shortUrls.downloadUrl || selectedShare?.downloadUrl;

  return (
    <div className={S("share-container")}>
      {
        !selectedShare.downloadJobId ? null :
          <ShareDownloadJobStatusChecker share={selectedShare} />
      }
      <div className={S("share")}>
        <DownloadPreview store={store} options={selectedShare.downloadOptions || {}}/>
        <div className={S("share-details")}>
          <div className={S("share-details__title")}>
            <IconButton icon={BackIcon} onClick={Back}/>
            View Share Details
          </div>

          <div className={S("share-details__content")}>
            <div className={S("share-details__subtitle")}>
              Share Details
            </div>
            <div className={S("share-details__details")}>
              {
                selectedShare.recipient ?
                  <div className={S("share-details__detail")}>
                    <label>Recipient:</label>
                    <span>{selectedShare.recipient}</span>
                  </div> :
                  <div className={S("share-details__detail")}>
                    <label>Label:</label>
                    <span>{selectedShare.label}</span>
                  </div>
              }
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
                <label>Share ID:</label>
                <CopyableField value={selectedShare.share_id}  />
              </div>
              <div className={S("share-details__detail")}>
                <label>Note:</label>
                <span>{selectedShare.shareOptions?.note || ""}</span>
              </div>
            </div>
            <div className={S("share-details__links")}>
              {
                !["stream", "both"].includes(selectedShare.permissions) ? null :
                  <button onClick={() => Copy(embedUrl)} className={S("share-details__copy")}>
                    <Icon icon={LinkIcon}/>
                    Copy Streaming URL
                  </button>
              }
              {
                !["download", "both"].includes(selectedShare.permissions) ? null :
                  <button onClick={() => Copy(downloadUrl)} className={S("share-details__copy")}>
                    <Icon icon={DownloadIcon}/>
                    Copy Download URL
                  </button>
              }
            </div>
            {
              !embedUrl ? null :
                <ShareSocialLinks share={selectedShare} embedUrl={embedUrl}/>
            }
            <div style={{marginTop: 30}} className={S("share-details__subtitle")}>
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
              {
                store.channel ? null :
                  <>
                    <div className={S("share-details__detail")}>
                      <label>Start Time:</label>
                      <span className="monospace">
                        {store.FrameToSMPTE(selectedShare.clipDetails.clipInFrame || 0, true)}
                      </span>
                    </div>
                    <div className={S("share-details__detail")}>
                      <label>End Time:</label>
                      <span className="monospace">
                        {store.FrameToSMPTE(selectedShare.clipDetails.clipOutFrame || store.totalFrames - 1, true)}
                      </span>
                    </div>
                    <div className={S("share-details__detail")}>
                      <label>Duration:</label>
                      <span>{selectedShare.clipDetails.durationString}</span>
                    </div>
                  </>
              }
              {
                selectedShare.compositionKey === "main" ?
                  <div className={S("share-details__detail")}>
                    <label>Offering:</label>
                    <span>{selectedShare.offering === "default" ? "Default" : selectedShare.offering || "Default"}</span>
                  </div> :
                  <div className={S("share-details__detail")}>
                    <label>Composition:</label>
                    <span>{selectedShare.compositionKey }</span>
                  </div>
              }
              {
                !["download", "both"].includes(selectedShare.permissions) ? null :
                  <>
                    <div className={S("share-details__detail")}>
                      <label>Format:</label>
                      <span>{selectedShare.downloadOptions?.format}</span>
                    </div>
                    {
                      !resolutionLabel ? null :
                        <div className={S("share-details__detail")}>
                          <label>Resolution:</label>
                          <span>{resolutionLabel}</span>
                        </div>
                    }
                  </>
              }
              {
                !audioTrackLabel && !selectedShare.audioTrackLabel ? null :
                  <div className={S("share-details__detail")}>
                    <label>Audio:</label>
                    <span>{selectedShare.audioTrackLabel || audioTrackLabel}</span>
                  </div>
              }
            </div>
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

export const ShareModal = observer(({store, ...props}) => {
  const [selectedShare, setSelectedShare] = useState(undefined);
  const [downloadOptions, setDownloadOptions] = useState(undefined);

  useEffect(() => {
    setDownloadOptions({
      objectId: store.videoObject?.objectId,
      format: "mp4",
      title: store.name,
      filename: "",
      defaultFilename: "",
      representation: "",
      audioRepresentation: "",
      offering: store.offeringKey,
      clipInFrame: store.channel ? undefined : store.clipInFrame,
      clipOutFrame: store.channel ? undefined : store.clipOutFrame
    });
  }, [store.clipInFrame, store.clipOutFrame]);

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
            {
              selectedShare ?
                "Share Details" :
                rootStore.page === "compositions" ?
                  "Share Composition" : "Share Clip"
            }
          </div>
        </div>
      }
      padding={30}
      {...props}
    >
      {
        selectedShare ?
          <ShareDetails
            store={store}
            selectedShare={selectedShare}
            Back={() => setSelectedShare(undefined)}
            Close={props.onClose}
          /> :
          <ShareModalContent
            store={store}
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

const ShareModalButton = observer(({store, ...props}) => {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if(showModal) {
      store.PlayPause(true);
    }
  }, [showModal]);

  return (
    <>
      <IconButton
        icon={ShareIcon}
        label={props.label || "Share Current Clip"}
        onClick={() => setShowModal(true)}
        {...props}
      />
      {
        !showModal  ? null :
          <ShareModal
            store={store}
            opened={showModal}
            onClose={() => setShowModal(false)}
            alwaysOpened
          />
      }
    </>
  );
});

export default ShareModalButton;
