import DownloadStyles from "@/assets/stylesheets/modules/download.module.scss";

import React, {useEffect, useState} from "react";
import {observer} from "mobx-react-lite";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {
  Confirm,
  Icon,
  IconButton,
  Modal
} from "@/components/common/Common.jsx";
import {Tabs} from "@mantine/core";
import {rootStore, downloadStore} from "@/stores/index.js";
import PreviewThumbnail from "@/components/common/PreviewThumbnail.jsx";
import DownloadForm from "@/components/download/DownloadForm.jsx";

import DownloadIcon from "@/assets/icons/download.svg";
import InfoIcon from "@/assets/icons/v2/info.svg";
import XIcon from "@/assets/icons/X.svg";
import RetryIcon from "@/assets/icons/rotate-ccw.svg";

const S = CreateModuleClassMatcher(DownloadStyles);

const JobActions = observer(({store, job, setConfirming, Reload}) => {
  const jobStatus = downloadStore.downloadJobStatus[job.jobId];

  if(!jobStatus) {
    return null;
  } else if(jobStatus.status === "failed") {
    return (
      <div className={S("history-row__actions")}>
        <IconButton
          icon={RetryIcon}
          title="Retry"
          small
          onClick={async () => {
            setConfirming(true);

            await Confirm({
              title: "Retry Download",
              text: "Are you sure you want to retry this download?",
              onConfirm: async () => {
                const jobInfo = downloadStore.downloadJobInfo[job.jobId];
                await downloadStore.RemoveDownloadJob({jobId: job.jobId});
                await downloadStore.StartDownloadJob({...jobInfo, store});
                Reload();

                setConfirming(false);
              },
              onCancel: () => setConfirming(false)
            });
          }}
        />
        <IconButton
          icon={XIcon}
          label="Remove"
          small
          onClick={async () => {
            setConfirming(true);

            await Confirm({
              title: "Remove Download",
              text: "Are you sure you want to remove this download from your history?",
              onConfirm: () => {
                downloadStore.RemoveDownloadJob({jobId: job.jobId});
                setConfirming(false);
                Reload();
              },
              onCancel: () => setConfirming(false)
            });
          }}
        />
      </div>
    );
  } else if(jobStatus.status === "completed") {
    return (
      <div className={S("history-row__actions")}>
        <IconButton
          icon={DownloadIcon}
          label="Download"
          small
          onClick={() => downloadStore.SaveDownloadJob({jobId: job.jobId})}
        />
        <IconButton
          icon={XIcon}
          label="Remove Download"
          small
          onClick={async () => {
            setConfirming(true);

            await Confirm({
              title: "Remove Download",
              text: "Are you sure you want to remove this download from your history?",
              onConfirm: () => {
                downloadStore.RemoveDownloadJob({jobId: job.jobId});
                setConfirming(false);
                Reload();
              },
              onCancel: () => setConfirming(false)
            });
          }}
        />
      </div>
    );
  } else if(jobStatus.status === "processing") {
    return (
      <div className={S("history-row__actions")} />
    );
  }
});

const JobStatusTable = observer(({store, jobs, setConfirming, Reload}) => (
  <div className={S("history")}>
    <div className={S("history-row", "history-row--header")}>
      <div>Name</div>
      <div className={S("center")}>Duration</div>
      <div className={S("center")}>Status</div>
      <div className={S("center")}>Actions</div>
    </div>
    {
      jobs.map(job => {
        const jobStatus = downloadStore.downloadJobStatus[job.jobId];
        const downloaded = downloadStore.downloadedJobs[job.jobId];

        const startFrame = job.clipInFrame || 0;
        const endFrame = job.clipOutFrame || store.totalFrames - 1;

        const representations = store.ResolutionOptions(job.offering);
        const audioRepresentations = store.AudioOptions(job.offering);

        const resolutionLabel = representations?.find(rep => rep.key === job.representation)?.string;
        const audioTrackLabel = audioRepresentations?.find(rep => rep.key === job.audioRepresentation)?.label;

        return (
          <div
            key={`row-${job.jobId}`}
            className={
              S(
                "history-row",
                "history-row--entry",
                job.highlighted ? "history-row--highlighted" : ""
              )
            }
          >
            <div className={S("history-row__cell", "history-row__cell--title")}>
              <IconButton
                icon={InfoIcon}
                className={S("history-row__details")}
                aria-label="Clip Details"
                withinPortal
                label={
                  <div className={S("job-details")}>
                    <div className={S("job-details__detail")}>
                      <label>Start Time:</label>
                      <span className="monospace">{store.FrameToSMPTE(startFrame, true)}</span>
                    </div>
                    <div className={S("job-details__detail")}>
                      <label>End Time:</label>
                      <span className="monospace">{store.FrameToSMPTE(endFrame, true)}</span>
                    </div>
                    <div className={S("job-details__detail")}>
                      <label>Duration:</label>
                      <span>{store.FrameToString({frame: endFrame - startFrame})}</span>
                    </div>
                    <div className={S("job-details__detail")}>
                      <label>Offering:</label>
                      <span>{job.offering === "default" ? "Default" : job.offering || "Default"}</span>
                    </div>
                    {
                      !resolutionLabel ? null :
                        <div className={S("job-details__detail")}>
                          <label>Resolution:</label>
                          <span>{resolutionLabel}</span>
                        </div>
                    }
                    {
                      !audioTrackLabel ? null :
                        <div className={S("job-details__detail")}>
                          <label>Audio:</label>
                          <span>{audioTrackLabel}</span>
                        </div>
                    }
                  </div>
                }
              />
              {
                !store.thumbnailStore.thumbnailStatus.available ? null :
                  <div style={{aspectRatio: store.aspectRatio}} className={S("history-row__thumbnail-container")}>
                    <PreviewThumbnail
                      store={store}
                      startFrame={startFrame}
                      endFrame={endFrame}
                      className={S("history-row__thumbnail")}
                    />
                  </div>
              }
              {job.filename}
            </div>
            <div className={S("history-row__cell", "center")}>
              {job?.duration}
            </div>
            <div className={S("history-row__cell", "center")}>
              {
                !jobStatus ? "" :
                  jobStatus?.status === "completed" ?
                    downloaded ? "Download Initiated" : "Available" :
                    jobStatus?.status === "failed" ? "Failed" :
                      <div className={S("history-row__status")}>
                        Generating...
                        <progress value={jobStatus.progress || 0} max={100} className={S("progress")}/>
                      </div>
              }
            </div>
            <div className={S("history-row__cell", "center")}>
              <JobActions store={store} job={job} setConfirming={setConfirming} Reload={Reload}/>
            </div>
          </div>
        );
      })
    }
  </div>
));

const DownloadHistory = ({store, highlightedJobId, setConfirming}) => {
  const [key, setKey] = useState(0);
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    setJobs(
      Object.keys(downloadStore.downloadJobInfo)
        .map(jobId => ({
          ...downloadStore.downloadJobInfo[jobId],
          highlighted: jobId === highlightedJobId,
          jobId,
          duration: store.FrameToString({
            frame: downloadStore.downloadJobInfo[jobId].clipOutFrame - downloadStore.downloadJobInfo[jobId].clipInFrame
          })
        }))
        .filter(({versionHash}) => store.videoObject.objectId === rootStore.client.utils.DecodeVersionHash(versionHash).objectId)
        .filter(job => {
          if(!store.channel) {
            // All non-composition downloads
            return !job.composition;
          } else {
            // Only downloads of this composition
            return job.composition && job.offering === store.offeringKey;
          }
        })
        .sort((a, b) => a.startedAt > b.startedAt ? -1 : 1)
    );
  }, [key, downloadStore.downloadJobInfo]);

  useEffect(() => {
    const UpdateStatus = async () => {
      await Promise.all(
        jobs
          .filter(({jobId}) => !downloadStore.downloadJobStatus[jobId] || downloadStore.downloadJobStatus[jobId]?.status === "processing")
          .map(async ({jobId}) => {
            try {
              await downloadStore.DownloadJobStatus({jobId});
            } catch(error) {
              // eslint-disable-next-line no-console
              console.log(`Unable to get status for download job ${jobId}:`);
              // eslint-disable-next-line no-console
              console.log(error);
            }
          })
      );
    };

    UpdateStatus();

    const statusUpdateInterval = setInterval(UpdateStatus, 5000);

    return () => clearInterval(statusUpdateInterval);
  }, [jobs]);

  return (
    jobs.length === 0 ?
      <div className={S("download__message")}>
        No Downloaded Clips
      </div> :
      <JobStatusTable
        store={store}
        key={`job-table-${key}`}
        jobs={jobs}
        setConfirming={setConfirming}
        Reload={() => setKey(key + 1)}
      />
  );
};

const DownloadModalContent = observer(({store, tab, setTab, setConfirming, Close}) => {
  const [jobId, setJobId] = useState(undefined);
  const [error, setError] = useState("");

  // Reset error
  useEffect(() => {
    setError("");
  }, [tab]);

  const Submit = async ({
    format,
    offering,
    clipInFrame,
    clipOutFrame,
    filename,
    defaultFilename,
    representation,
    audioRepresentation
  }) => {
    try {
      setJobId(
        (await downloadStore.StartDownloadJob({
          store,
          composition: store.channel,
          format,
          offering,
          clipInFrame,
          clipOutFrame,
          filename: filename || defaultFilename,
          representation,
          audioRepresentation
        })).jobId
      );
      setTab("history");
    } catch(error) {
      // eslint-disable-next-line no-console
      console.log(error);
      setError("Something went wrong, please try again");
    }
  };

  return (
    <div className={S("download-modal")}>
      {
        !error ? null :
          <div className={S("download__error")}>
            {error}
          </div>
      }
      {
        tab === "details" ?
          <DownloadForm store={store} Submit={Submit} Close={Close} /> :
          <DownloadHistory store={store} highlightedJobId={jobId} setConfirming={setConfirming} />
      }
    </div>
  );
});

export const DownloadModal = observer(({store, ...modalProps}) => {
  const [confirming, setConfirming] = useState(false);
  const [tab, setTab] = useState("details");

  useEffect(() => {
    setTab("details");
  }, [modalProps.opened]);

  return (
    <Modal
      size={1000}
      onClose={() => !confirming && props.onClose()}
      title={
        <div className={S("header")}>
          <Icon icon={DownloadIcon}/>
          Generate and Download Clip
        </div>
      }
      padding={30}
      {...modalProps}
    >
      <Tabs value={tab} mb="sm" color="gray.5" onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="details">
            Details
          </Tabs.Tab>
          <Tabs.Tab value="history">
            Download History
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>
      <DownloadModalContent
        store={store}
        tab={tab}
        setTab={setTab}
        setConfirming={setConfirming}
        Close={modalProps.onClose}
      />
    </Modal>
  );
});

const DownloadModalButton = observer(({store, label, disabled}) => {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if(showModal) {
      store.PlayPause(true);
    }
  }, [showModal]);

  disabled = disabled || (!store.channel && store.downloadOfferingKeys.length === 0);

  return (
    <>
      <IconButton
        disabled={disabled}
        icon={DownloadIcon}
        label={
          label ||
          (disabled ?
            "Download not available - No clear offerings for this content" :
            "Download Current Clip")
        }
        onClick={() => setShowModal(true)}
      />
      <DownloadModal
        store={store}
        opened={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
});

export default DownloadModalButton;
