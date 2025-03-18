import DownloadStyles from "@/assets/stylesheets/modules/download.module.scss";

import React, {useEffect, useState} from "react";
import {observer} from "mobx-react-lite";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {
  AsyncButton,
  CopyButton,
  FormSelect,
  FormTextInput,
  Icon,
  IconButton,
  Modal
} from "@/components/common/Common.jsx";
import {Button, Tabs, Text} from "@mantine/core";
import {videoStore} from "@/stores/index.js";
import {modals} from "@mantine/modals";
import PreviewThumbnail from "@/components/common/PreviewThumbnail.jsx";

import DownloadIcon from "@/assets/icons/download.svg";
import QuestionMarkIcon from "@/assets/icons/v2/question-mark.svg";
import XIcon from "@/assets/icons/X.svg";
import RetryIcon from "@/assets/icons/rotate-ccw.svg";

const S = CreateModuleClassMatcher(DownloadStyles);

const DownloadForm = observer(({options, setOptions, representations, audioRepresentations, Submit, Close}) => {
  return (
    <div className={S("download")}>
      <div className={S("preview")}>
        {
          !videoStore.thumbnailStore.thumbnailStatus.available ? null :
            <div style={{aspectRatio: videoStore.aspectRatio}} className={S("preview__thumbnail-container")}>
              <PreviewThumbnail
                startFrame={videoStore.clipInFrame}
                endFrame={videoStore.clipOutFrame}
                className={S("preview__thumbnail")}
              />
            </div>
        }
        <div className={S("preview__title")}>{videoStore.name}</div>
        <div className={S("preview__time")}>
            <span>
              {videoStore.videoHandler.FrameToSMPTE(videoStore.clipInFrame)}
            </span>
          <span>-</span>
          <span>
              {videoStore.videoHandler.FrameToSMPTE(videoStore.clipOutFrame)}
            </span>
          <span>
              (
            {videoStore.videoHandler.FrameToString({frame: videoStore.clipOutFrame - videoStore.clipInFrame})}
            )
            </span>
        </div>
        <div className={S("preview__object-id")}>
          {videoStore.videoObject.objectId}
          <CopyButton label="Copy Object ID" value={videoStore.videoObject.objectId} small/>
        </div>
        {
          !videoStore.metadata?.public?.description ? null :
            <div className={S("preview__description")}>
              {videoStore.metadata.public.description}
            </div>
        }
      </div>
      <div className={S("download__form")}>
        <FormTextInput
          label="Title"
          autoFocus
          name="title"
          value={options.filename}
          onChange={event => setOptions({...options, filename: event.target.value})}
          placeholder={options.defaultFilename}
        />

        <FormSelect
          label="Offering"
          name="offering"
          value={options.offering}
          onChange={value => setOptions({...options, offering: value || options.offering})}
          data={
            Object.keys(videoStore.availableOfferings).map(offeringKey => ({
              label: offeringKey === "default" ? "Default" : videoStore.availableOfferings[offeringKey].display_name || offeringKey,
              value: offeringKey,
            }))
          }
        />
        {
          !representations || representations.length === 0 ? null :
            <FormSelect
              label="Resolution"
              name="representation"
              value={options.representation}
              onChange={value => setOptions({...options, representation: value || options.representation})}
              data={representations.map(rep => ({label: rep.string, value: rep.key}))}
            />
        }
        {
          !audioRepresentations || audioRepresentations.length === 0 ? null :
            <FormSelect
              label="Audio"
              name="audioRepresentation"
              value={options.audioRepresentation}
              onChange={value => setOptions({...options, audioRepresentation: value || options.audioRepresentation})}
                data={audioRepresentations.map(rep => ({label: rep.string, value: rep.key}))}
              />
          }
          <FormSelect
            label="Format"
            name="format"
            value={options.format}
            onChange={value => setOptions({...options, format: value || options.format})}
            data={[{label: "MP4", value: "mp4"}, {label: "ProRes", value: "prores"}]}
          />

          <div className={S("download__actions")}>
            <Button variant="subtle" color="gray.5" onClick={() => Close()} className={S("download__action")}>
              Cancel
            </Button>
            <AsyncButton
              onClick={async () => await Submit(options)}
              className={S("download__action")}
            >
              Download
            </AsyncButton>
          </div>
      </div>
    </div>
  );
});

const JobActions = observer(({job, setConfirming, Reload}) => {
  const jobStatus = videoStore.downloadJobStatus[job.jobId];

  if(!jobStatus) {
    return null;
  } else if(jobStatus.status === "failed") {
    return (
      <div className={S("history-row__actions")}>
        <IconButton
          icon={RetryIcon}
          title="Retry"
          small
          onClick={() => {
            setConfirming(true);

            modals.openConfirmModal({
              title: "Retry Download",
              children: <Text fz={14}>Are you sure you want to retry this download?</Text>,
              centered: true,
              labels: { confirm: "Retry", cancel: "Cancel" },
              onConfirm: () => {
                const jobInfo = videoStore.downloadJobInfo[job.jobId];
                videoStore.RemoveDownloadJob({jobId: job.jobId});
                videoStore.StartDownloadJob({...jobInfo})
                  .then(() => Reload());
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
          onClick={() => {
            setConfirming(true);

            modals.openConfirmModal({
              title: "Remove Download",
              children: <Text fz={14}>Are you sure you want to remove this download from your history?</Text>,
              centered: true,
              labels: { confirm: "Remove", cancel: "Cancel" },
              onConfirm: () => {
                videoStore.RemoveDownloadJob({jobId: job.jobId});
                setConfirming(false);
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
          onClick={() => videoStore.SaveDownloadJob({jobId: job.jobId})}
        />
        <IconButton
          icon={XIcon}
          label="Remove Download"
          small
          onClick={() => {
            setConfirming(true);

            modals.openConfirmModal({
              title: "Remove Download",
              children: <Text fz={14}>Are you sure you want to remove this download from your history?</Text>,
              centered: true,
              labels: { confirm: "Remove", cancel: "Cancel" },
              onConfirm: () => {
                videoStore.RemoveDownloadJob({jobId: job.jobId});
                setConfirming(false);
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

const JobStatusTable = observer(({jobs, representations, audioRepresentations, setConfirming, Reload}) => (
  <div className={S("history")}>
    <div className={S("history-row", "history-row--header")}>
      <div>Name</div>
      <div>Duration</div>
      <div>Status</div>
      <div />
    </div>
    {
      jobs.map(job => {
        const jobStatus = videoStore.downloadJobStatus[job.jobId];
        const downloaded = videoStore.downloadedJobs[job.jobId];

        const startFrame = job.clipInFrame || 0;
        const endFrame = job.clipOutFrame || videoStore.totalFrames - 1;

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

const DownloadHistory = ({representations, audioRepresentations, highlightedJobId, setConfirming}) => {
  const [key, setKey] = useState(Math.random());

  const jobs = Object.keys(videoStore.downloadJobInfo)
    .map(jobId => ({
      ...videoStore.downloadJobInfo[jobId],
      highlighted: jobId === highlightedJobId,
      jobId,
      duration: videoStore.videoHandler.FrameToString({
        frame: videoStore.downloadJobInfo[jobId].clipOutFrame - videoStore.downloadJobInfo[jobId].clipInFrame
      })
    }))
    .filter(({versionHash}) => videoStore.versionHash === versionHash)
    .sort((a, b) => a.startedAt > b.startedAt ? -1 : 1);

  useEffect(() => {
    const UpdateStatus = async () => {
      await Promise.all(
        jobs
          .filter(({jobId}) => !videoStore.downloadJobStatus[jobId] || videoStore.downloadJobStatus[jobId]?.status === "processing")
          .map(async ({jobId}) => {
            try {
              await videoStore.DownloadJobStatus({jobId});
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
  }, []);

  return (
    jobs.length === 0 ?
      <div className={S("download__message")}>
        No Downloaded Clips
      </div> :
      <JobStatusTable
        key={`job-table-${key}`}
        representations={representations}
        audioRepresentations={audioRepresentations}
        jobs={jobs}
        setConfirming={setConfirming}
        Reload={() => setKey(Math.random())}
      />
  );
};

const DownloadModalContent = observer(({tab, setTab, setConfirming, Close}) => {
  const [jobId, setJobId] = useState(undefined);
  const [error, setError] = useState("");
  const [representations, setRepresentations] = useState(undefined);
  const [audioRepresentations, setAudioRepresentations] = useState(undefined);
  const [options, setOptions] = useState({
    format: "mp4",
    filename: "",
    defaultFilename: "",
    representation: "",
    audioRepresentation: "",
    offering: videoStore.offeringKey,
    clipInFrame: videoStore.clipInFrame,
    clipOutFrame: videoStore.clipOutFrame,
  });

  // Update
  useEffect(() => {
    const audioTrack = audioRepresentations?.find(rep => rep.key === options.audioRepresentation);
    const defaultFilename = videoStore.DownloadJobDefaultFilename({
      format: options.format,
      offering: options.offering,
      representationInfo: representations?.find(rep => rep.key === options.representation),
      audioRepresentationInfo: audioTrack,
      clipInFrame: videoStore.clipInFrame,
      clipOutFrame: videoStore.clipOutFrame
    });
    setOptions({
      ...options,
      defaultFilename,
      filename: options.filename === options.defaultFilename ?
        defaultFilename : options.filename
    });
  }, [options.format, options.offering, options.representation, options.audioRepresentation, options.clipInFrame, options.clipOutFrame]);

  // Load quality and audio options
  useEffect(() => {
    const repInfo = videoStore.ResolutionOptions(options.offering);

    const audioRepInfo = videoStore.AudioOptions(options.offering);

    setRepresentations(repInfo);
    setAudioRepresentations(audioRepInfo);

    setOptions({
      ...options,
      representation: repInfo[0]?.key || "",
      audioRepresentation:
        audioRepInfo.find(rep => rep.current)?.key ||
        audioRepInfo.find(rep => rep.default)?.key ||
        ""
    });
  }, [options.offering]);

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
        (await videoStore.StartDownloadJob({
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
          <DownloadForm
            options={options}
            setOptions={setOptions}
            representations={representations}
            audioRepresentations={audioRepresentations}
            Submit={Submit}
            Close={Close}
          /> :
          <DownloadHistory
            representations={representations}
            audioRepresentations={audioRepresentations}
            highlightedJobId={jobId}
            setConfirming={setConfirming}
          />
      }
    </div>
  );
});

const DownloadModal = observer(props => {
  const [confirming, setConfirming] = useState(false);
  const [tab, setTab] = useState("details");

  useEffect(() => {
    //setTab("details");
  }, [props.opened]);

  return (
    <Modal
      size={1000}
      onClose={() => !confirming && props.onClose()}
      title={
        <h1 className={S("header")}>
          <Icon icon={DownloadIcon}/>
          Generate and Download Clip
        </h1>
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

const Download = observer(() => {
  const [showModal, setShowModal] = useState(false);
  return (
    <>
      <IconButton
        icon={DownloadIcon}
        label="Download Current Clip"
        onClick={() => setShowModal(true)}
      />
      <DownloadModal
        opened={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
});

export default Download;
