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
import {rootStore, videoStore, downloadStore} from "@/stores/index.js";
import PreviewThumbnail from "@/components/common/PreviewThumbnail.jsx";
import DownloadForm from "@/components/download/DownloadForm.jsx";

import DownloadIcon from "@/assets/icons/download.svg";
import QuestionMarkIcon from "@/assets/icons/v2/question-mark.svg";
import XIcon from "@/assets/icons/X.svg";
import RetryIcon from "@/assets/icons/rotate-ccw.svg";

const S = CreateModuleClassMatcher(DownloadStyles);

const JobActions = observer(({job, setConfirming, Reload}) => {
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
                await downloadStore.StartDownloadJob({...jobInfo});
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
      <div className={S("history-row__actions")}>
        <progress value={jobStatus.progress} max={100} className={S("progress")} />
      </div>
    );
  }
});

const JobStatusTable = observer(({jobs, setConfirming, Reload}) => (
  <div className={S("history")}>
    <div className={S("history-row", "history-row--header")}>
      <div>Name</div>
      <div>Duration</div>
      <div>Status</div>
      <div />
    </div>
    {
      jobs.map(job => {
        const jobStatus = downloadStore.downloadJobStatus[job.jobId];
        const downloaded = downloadStore.downloadedJobs[job.jobId];

        const startFrame = job.clipInFrame || 0;
        const endFrame = job.clipOutFrame || videoStore.totalFrames - 1;

        const representations = videoStore.ResolutionOptions(job.offering);
        const audioRepresentations = videoStore.AudioOptions(job.offering);

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
              {
                !videoStore.thumbnailStore.thumbnailStatus.available ? null :
                  <div style={{aspectRatio: videoStore.aspectRatio}} className={S("history-row__thumbnail-container")}>
                    <PreviewThumbnail
                      store={videoStore}
                      startFrame={startFrame}
                      endFrame={endFrame}
                      className={S("history-row__thumbnail")}
                    />
                  </div>
              }
              {job.filename}
            </div>
            <div className={S("history-row__cell")}>
              {job?.duration}
            </div>
            <div className={S("history-row__cell")}>
              {
                !jobStatus ? "" :
                  jobStatus?.status === "completed" ?
                    downloaded ? "Download Initiated" : "Available" :
                    jobStatus?.status === "failed" ? "Failed" : "Generating..."
              }
            </div>
            <div className={S("history-row__cell")}>
              <JobActions job={job} setConfirming={setConfirming} Reload={Reload}/>
            </div>

            <IconButton
              icon={QuestionMarkIcon}
              className={S("history-row__details")}
              aria-label="Clip Details"
              withinPortal
              label={
                <div className={S("job-details")}>
                  <div className={S("job-details__detail")}>
                    <label>Start Time:</label>
                    <span className="monospace">{videoStore.FrameToSMPTE(startFrame)}</span>
                  </div>
                  <div className={S("job-details__detail")}>
                    <label>End Time:</label>
                    <span className="monospace">{videoStore.FrameToSMPTE(endFrame)}</span>
                  </div>
                  <div className={S("job-details__detail")}>
                    <label>Duration:</label>
                    <span>{videoStore.videoHandler.FrameToString({frame: endFrame - startFrame})}</span>
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
          </div>
        );
      })
    }
  </div>
));

const DownloadHistory = ({highlightedJobId, setConfirming}) => {
  const [key, setKey] = useState(0);
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    setJobs(
      Object.keys(downloadStore.downloadJobInfo)
        .map(jobId => ({
          ...downloadStore.downloadJobInfo[jobId],
          highlighted: jobId === highlightedJobId,
          jobId,
          duration: videoStore.videoHandler.FrameToString({
            frame: downloadStore.downloadJobInfo[jobId].clipOutFrame - downloadStore.downloadJobInfo[jobId].clipInFrame
          })
        }))
        .filter(({versionHash}) => videoStore.videoObject.objectId === rootStore.client.utils.DecodeVersionHash(versionHash).objectId)
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

    const statusUpdateInterval = setInterval(UpdateStatus, 3000);

    return () => clearInterval(statusUpdateInterval);
  }, [jobs]);

  return (
    jobs.length === 0 ?
      <div className={S("download__message")}>
        No Downloaded Clips
      </div> :
      <JobStatusTable
        key={`job-table-${key}`}
        jobs={jobs}
        setConfirming={setConfirming}
        Reload={() => setKey(key + 1)}
      />
  );
};

const DownloadModalContent = observer(({tab, setTab, setConfirming, Close}) => {
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
          <DownloadForm store={videoStore} Submit={Submit} Close={Close} /> :
          <DownloadHistory highlightedJobId={jobId} setConfirming={setConfirming} />
      }
    </div>
  );
});

const DownloadModal = observer(props => {
  const [confirming, setConfirming] = useState(false);
  const [tab, setTab] = useState("details");

  useEffect(() => {
    setTab("details");
  }, [props.opened]);

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
      {...props}
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
        tab={tab}
        setTab={setTab}
        setConfirming={setConfirming}
        Close={props.onClose}
      />
    </Modal>
  );
});

const DownloadModalButton = observer(() => {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if(showModal) {
      videoStore.PlayPause(true);
    }
  }, [showModal]);

  const disabled = videoStore.downloadOfferingKeys.length === 0;

  return (
    <>
      <IconButton
        disabled={disabled}
        icon={DownloadIcon}
        label={
        disabled ?
          "Download not available - No clear offerings for this content" :
          "Download Current Clip"
        }
        onClick={() => setShowModal(true)}
      />
      <DownloadModal
        opened={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
});

export default DownloadModalButton;
